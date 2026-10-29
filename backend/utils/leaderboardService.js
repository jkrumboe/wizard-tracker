/**
 * LeaderboardService
 * Encapsulates all leaderboard calculation logic previously inlined in games.js route.
 * Computes player statistics across Wizard and Table games using the identity system.
 *
 * Reading every game is the expensive part, so it happens once per change, not
 * once per request: one pass builds a snapshot holding every player's stats for
 * every game type, and each filter / page is a cheap selection from it. The
 * snapshot is cached in Redis under `leaderboard:snapshot` and dropped by the
 * existing `leaderboard:*` invalidations whenever a game is finished, edited or
 * relinked. Concurrent cache misses in one process share a single build.
 */
const WizardGame = require('../models/WizardGame');
const TableGame = require('../models/TableGame');
const cache = require('./redis');
const { buildIdentityMaps } = require('./identityHelpers');
const {
  getWinnerIds,
  isPlayerWinner,
  resolveTableGameData,
  resolveTableGameLowIsBetter,
  getTableGameResult,
} = require('./gameHelpers');
const { normalizeGameType } = require('./eloService');
const { DEFAULT_ELO_RATING, LEADERBOARD_CACHE_TTL, LEADERBOARD_SNAPSHOT_TTL } = require('./constants');

const SNAPSHOT_CACHE_KEY = 'leaderboard:snapshot';
const WIZARD_LABEL = 'Wizard';
const TABLE_GAME_FALLBACK = 'Table Game';

// Only the player fields the leaderboard reads - not round data or scores per round
const PLAYER_FIELDS = ['id', 'originalId', 'name', 'identityId', 'points'];
const tablePlayerProjection = (prefix) =>
  Object.fromEntries(PLAYER_FIELDS.map(field => [`${prefix}.players.${field}`, 1]));
const tableGameDataProjection = (prefix) => ({
  ...tablePlayerProjection(prefix),
  [`${prefix}.winner_id`]: 1,
  [`${prefix}.winner_ids`]: 1,
  [`${prefix}.winner_name`]: 1,
  [`${prefix}.gameName`]: 1,
  [`${prefix}.lowIsBetter`]: 1,
});

/**
 * Read every finished game once and collect every player's stats per game type.
 *
 * @returns {Promise<Object>} { players, gameTypes, gameTypeSettings, totalGames }
 *   players[].gameTypes is keyed by normalized game type; gameTypes lists the
 *   label of each game type (one per game, whatever spellings it was saved under).
 */
async function buildLeaderboardSnapshot() {
  const {
    identityToPlayerKeyMap,
    playerKeyIsGuest,
    userDisplayNames,
    userEloByGameType,
  } = await buildIdentityMaps();

  const [wizardGames, tableGames] = await Promise.all([
    // Wizard games (only finished)
    WizardGame.find({
      $or: [
        { 'gameData.gameFinished': true },
        { 'gameData.winner_id': { $exists: true, $ne: null } },
        { 'gameData.winner_ids.0': { $exists: true } }
      ]
    }, {
      ...Object.fromEntries(PLAYER_FIELDS.map(field => [`gameData.players.${field}`, 1])),
      'gameData.winner_id': 1,
      'gameData.winner_ids': 1,
      'gameData.totals.winner_id': 1,
      'gameData.totals.winner_ids': 1,
      'gameData.final_scores': 1,
      'gameData.gameFinished': 1,
      'gameData.isPaused': 1,
      'createdAt': 1
    }).lean(),
    // Table games (only finished - an abandoned game is neither a win nor a loss)
    TableGame.find({
      $or: [
        { gameFinished: true },
        { 'gameData.gameFinished': true },
        { 'gameData.gameData.gameFinished': true }
      ]
    }, {
      ...tableGameDataProjection('gameData'),
      ...tableGameDataProjection('gameData.gameData'),
      'gameFinished': 1,
      'gameTypeName': 1,
      'lowIsBetter': 1,
      'createdAt': 1
    }).lean(),
  ]);

  // One label and one scoring direction per game type key
  const gameTypeLabels = new Map([[normalizeGameType(WIZARD_LABEL), WIZARD_LABEL]]);
  const gameTypeSettings = { [WIZARD_LABEL]: { lowIsBetter: false } };
  tableGames.forEach(game => {
    const name = game.gameTypeName || game.gameData?.gameName || TABLE_GAME_FALLBACK;
    const key = normalizeGameType(name);
    if (gameTypeLabels.has(key)) return;
    gameTypeLabels.set(key, name);
    if (name !== TABLE_GAME_FALLBACK) {
      gameTypeSettings[name] = { lowIsBetter: resolveTableGameLowIsBetter(game) };
    }
  });

  const playerStats = {};

  const recordResult = ({ identityId, playerName, gameTypeKey, won, score, playedAt }) => {
    if (!identityId) return;
    const playerKey = identityToPlayerKeyMap[identityId.toString()];
    if (!playerKey) return;

    if (!playerStats[playerKey]) {
      const isGuest = playerKeyIsGuest[playerKey] || false;
      playerStats[playerKey] = {
        id: playerKey,
        name: userDisplayNames[playerKey] || playerName,
        userId: isGuest ? null : playerKey,
        gameTypes: {},
        elo: {}
      };
    }

    const stats = playerStats[playerKey];
    const typeStats = (stats.gameTypes[gameTypeKey] ||= {
      label: gameTypeLabels.get(gameTypeKey),
      games: 0,
      wins: 0,
      totalScore: 0,
      lastPlayed: playedAt
    });
    typeStats.games++;
    if (won) typeStats.wins++;
    if (score !== undefined) typeStats.totalScore += score;
    if (playedAt && new Date(playedAt) > new Date(typeStats.lastPlayed)) {
      typeStats.lastPlayed = playedAt;
    }

    const eloData = userEloByGameType[playerKey]?.[gameTypeKey];
    if (eloData) stats.elo[gameTypeKey] = eloData.rating || DEFAULT_ELO_RATING;
  };

  // Process Wizard games
  const wizardKey = normalizeGameType(WIZARD_LABEL);
  wizardGames.forEach(game => {
    const gameData = game.gameData;
    if (!gameData || !gameData.players || !Array.isArray(gameData.players)) return;
    // Same rule as the profile: an explicitly unfinished or paused game doesn't count
    if (gameData.isPaused || gameData.gameFinished === false) return;

    const winnerIds = getWinnerIds(gameData);
    const finalScores = gameData.final_scores || gameData.totals?.final_scores || {};

    gameData.players.forEach(player => {
      recordResult({
        identityId: player.identityId,
        playerName: player.name,
        gameTypeKey: wizardKey,
        won: isPlayerWinner(player, winnerIds),
        score: finalScores[player.id],
        playedAt: game.createdAt
      });
    });
  });

  // Process Table games
  tableGames.forEach(game => {
    const gameData = resolveTableGameData(game);
    if (!gameData || !gameData.players || !Array.isArray(gameData.players)) return;

    const gameTypeKey = normalizeGameType(game.gameTypeName || game.gameData?.gameName || TABLE_GAME_FALLBACK);
    // Scores decide the winner; stored winner ids/names only when there are none
    const { finalScores, isWinner } = getTableGameResult(game, gameData);

    gameData.players.forEach((player, index) => {
      recordResult({
        identityId: player.identityId,
        playerName: player.name,
        gameTypeKey,
        won: isWinner(player, index),
        score: finalScores[`player_${index}`],
        playedAt: game.createdAt
      });
    });
  });

  return {
    players: Object.values(playerStats),
    gameTypes: Array.from(gameTypeLabels.values()).filter(label => label !== TABLE_GAME_FALLBACK).sort(),
    gameTypeSettings,
    totalGames: wizardGames.length + tableGames.length
  };
}

/**
 * One page of the leaderboard, optionally for a single game type.
 *
 * @param {Object} snapshot - From buildLeaderboardSnapshot
 * @param {Object} options - { gameType, page, limit }
 * @returns {Object} { leaderboard, gameTypes, gameTypeSettings, totalGames, pagination }
 */
function selectLeaderboard(snapshot, { gameType, page = 1, limit = 50 } = {}) {
  const typeKey = gameType ? normalizeGameType(gameType) : null;
  const selectedLabel = typeKey
    ? snapshot.gameTypes.find(label => normalizeGameType(label) === typeKey) || gameType
    : null;

  const leaderboard = [];
  snapshot.players.forEach(player => {
    const types = typeKey
      ? (player.gameTypes[typeKey] ? { [typeKey]: player.gameTypes[typeKey] } : {})
      : player.gameTypes;
    const entries = Object.values(types);
    if (entries.length === 0) return;

    const totalGames = entries.reduce((sum, t) => sum + t.games, 0);
    const wins = entries.reduce((sum, t) => sum + t.wins, 0);
    const totalScore = entries.reduce((sum, t) => sum + t.totalScore, 0);
    const lastPlayed = entries
      .map(t => t.lastPlayed)
      .reduce((latest, date) => (!latest || new Date(date) > new Date(latest) ? date : latest), null);

    leaderboard.push({
      id: player.id,
      name: player.name,
      userId: player.userId,
      totalGames,
      wins,
      totalScore,
      // Keyed by label, as the API always returned it
      gameTypes: Object.fromEntries(
        Object.values(types).map(({ label, games, wins: typeWins, totalScore: typeScore }) =>
          [label, { games, wins: typeWins, totalScore: typeScore }])
      ),
      lastPlayed,
      winRate: totalGames > 0 ? parseFloat(((wins / totalGames) * 100).toFixed(1)) : 0,
      avgScore: totalGames > 0 ? parseFloat((totalScore / totalGames).toFixed(1)) : 0,
      // A rating only means something within one game type
      elo: Math.round(typeKey ? player.elo[typeKey] || DEFAULT_ELO_RATING : DEFAULT_ELO_RATING)
    });
  });

  const selectedGameLowIsBetter = selectedLabel
    ? snapshot.gameTypeSettings[selectedLabel]?.lowIsBetter || false
    : false;

  // Sort by ELO -> wins -> avgScore -> winRate
  leaderboard.sort((a, b) => {
    if (b.elo !== a.elo) return b.elo - a.elo;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.avgScore !== b.avgScore) {
      return selectedGameLowIsBetter
        ? a.avgScore - b.avgScore
        : b.avgScore - a.avgScore;
    }
    return b.winRate - a.winRate;
  });

  // Pagination
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 50, 100);
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;

  return {
    leaderboard: leaderboard.slice(startIndex, endIndex),
    gameTypes: snapshot.gameTypes,
    gameTypeSettings: snapshot.gameTypeSettings,
    totalGames: snapshot.totalGames,
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(leaderboard.length / limitNum),
      totalPlayers: leaderboard.length,
      hasNextPage: endIndex < leaderboard.length,
      hasPrevPage: pageNum > 1
    }
  };
}

// Without Redis, the snapshot is kept here for the normal (short) cache TTL,
// since nothing can invalidate it across processes
let localSnapshot = null;
let localSnapshotExpiresAt = 0;
let pendingBuild = null;

/**
 * The current snapshot: Redis, else this process's copy, else a fresh build
 * (shared by every request that misses at the same time).
 */
async function getLeaderboardSnapshot() {
  if (cache.isConnected) {
    const cached = await cache.get(SNAPSHOT_CACHE_KEY);
    if (cached) return cached;
  } else if (localSnapshot && Date.now() < localSnapshotExpiresAt) {
    return localSnapshot;
  }

  if (!pendingBuild) {
    pendingBuild = (async () => {
      const snapshot = await buildLeaderboardSnapshot();
      if (cache.isConnected) {
        await cache.set(SNAPSHOT_CACHE_KEY, snapshot, LEADERBOARD_SNAPSHOT_TTL);
      } else {
        localSnapshot = snapshot;
        localSnapshotExpiresAt = Date.now() + LEADERBOARD_CACHE_TTL * 1000;
      }
      return snapshot;
    })().finally(() => {
      pendingBuild = null;
    });
  }
  return pendingBuild;
}

/**
 * Drop the cached leaderboard after a change to games or identities.
 */
async function invalidateLeaderboard() {
  localSnapshot = null;
  if (cache.isConnected) {
    await cache.delPattern('leaderboard:*');
  }
}

/**
 * Calculate the full leaderboard.
 *
 * @param {Object} options
 * @param {string} [options.gameType] - Filter by game type (any spelling)
 * @param {number} [options.page=1]
 * @param {number} [options.limit=50]
 * @returns {Object} { leaderboard, gameTypes, gameTypeSettings, totalGames, pagination }
 */
async function calculateLeaderboard(options = {}) {
  return selectLeaderboard(await getLeaderboardSnapshot(), options);
}

module.exports = {
  calculateLeaderboard,
  buildLeaderboardSnapshot,
  selectLeaderboard,
  invalidateLeaderboard,
};
