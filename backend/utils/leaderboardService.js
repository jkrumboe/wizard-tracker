/**
 * LeaderboardService
 * Encapsulates all leaderboard calculation logic previously inlined in games.js route.
 * Computes player statistics across Wizard and Table games using the identity system.
 */
const WizardGame = require('../models/WizardGame');
const TableGame = require('../models/TableGame');
const { buildIdentityMaps } = require('./identityHelpers');
const {
  getWinnerIds,
  isPlayerWinner,
  calculateTableGameScores,
  calculateWinnersByScore,
  resolveTableGameData,
  resolveTableGameLowIsBetter,
} = require('./gameHelpers');
const { DEFAULT_ELO_RATING } = require('./constants');

/**
 * Normalize a game type string for ELO lookup (e.g. "Flip-7" -> "flip-7").
 */
function normalizeGameType(type) {
  if (!type) return 'wizard';
  return type.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Calculate the full leaderboard.
 *
 * @param {Object} options
 * @param {string} [options.gameType] - Filter by game type
 * @param {number} [options.page=1]
 * @param {number} [options.limit=50]
 * @returns {Object} { leaderboard, gameTypes, gameTypeSettings, totalGames, pagination }
 */
async function calculateLeaderboard({ gameType, page = 1, limit = 50 } = {}) {
  const {
    identityToPlayerKeyMap,
    playerKeyIsGuest,
    userDisplayNames,
    userEloByGameType,
  } = await buildIdentityMaps();

  // Fetch wizard games (only finished)
  const wizardGames = await WizardGame.find({
    $or: [
      { 'gameData.gameFinished': true },
      { 'gameData.winner_id': { $exists: true, $ne: null } },
      { 'gameData.winner_ids.0': { $exists: true } }
    ]
  }, {
    'gameData.players': 1,
    'gameData.winner_id': 1,
    'gameData.winner_ids': 1,
    'gameData.final_scores': 1,
    'userId': 1,
    'createdAt': 1
  }).lean();

  // Fetch table games
  const tableGames = await TableGame.find({}, {
    'gameData': 1,
    'gameTypeName': 1,
    'lowIsBetter': 1,
    'createdAt': 1
  }).lean();

  const playerStats = {};
  const gameTypeSet = new Set(['Wizard']);
  const gameTypeSettings = { 'Wizard': { lowIsBetter: false } };

  // Collect game types from table games
  tableGames.forEach(game => {
    const gameMode = game.gameTypeName || game.gameData?.gameName || 'Table Game';
    if (gameMode && gameMode !== 'Table Game') {
      gameTypeSet.add(gameMode);
      if (!gameTypeSettings[gameMode]) {
        gameTypeSettings[gameMode] = { lowIsBetter: resolveTableGameLowIsBetter(game) };
      }
    }
  });

  // Process Wizard games
  wizardGames.forEach(game => {
    const gameData = game.gameData;
    if (!gameData || !gameData.players || !Array.isArray(gameData.players)) return;

    const gameMode = 'Wizard';
    const winnerIds = getWinnerIds(gameData);
    const finalScores = gameData.final_scores || gameData.totals?.final_scores || {};

    gameData.players.forEach(player => {
      const identityId = player.identityId;
      if (!identityId) return;
      if (gameType && gameType !== gameMode) return;

      const identityIdStr = identityId.toString();
      const playerKey = identityToPlayerKeyMap[identityIdStr];
      if (!playerKey) return;

      const displayName = userDisplayNames[playerKey] || player.name;
      const isGuest = playerKeyIsGuest[playerKey] || false;

      if (!playerStats[playerKey]) {
        playerStats[playerKey] = {
          id: playerKey,
          name: displayName,
          userId: isGuest ? null : playerKey,
          totalGames: 0,
          wins: 0,
          totalScore: 0,
          gameTypes: {},
          lastPlayed: game.createdAt
        };
      }

      const stats = playerStats[playerKey];
      stats.totalGames++;

      if (isPlayerWinner(player, winnerIds)) {
        stats.wins++;
      }

      if (finalScores[player.id] !== undefined) {
        stats.totalScore += finalScores[player.id];
      }

      if (!stats.gameTypes[gameMode]) {
        stats.gameTypes[gameMode] = { games: 0, wins: 0, totalScore: 0 };
      }
      stats.gameTypes[gameMode].games++;
      if (isPlayerWinner(player, winnerIds)) {
        stats.gameTypes[gameMode].wins++;
      }
      if (finalScores[player.id] !== undefined) {
        stats.gameTypes[gameMode].totalScore += finalScores[player.id];
      }

      if (game.createdAt && new Date(game.createdAt) > new Date(stats.lastPlayed)) {
        stats.lastPlayed = game.createdAt;
      }
    });
  });

  // Process Table games
  tableGames.forEach(game => {
    const gameData = resolveTableGameData(game);
    if (!gameData || !gameData.players || !Array.isArray(gameData.players)) return;

    const gameMode = game.gameTypeName || game.gameData?.gameName || 'Table Game';
    const finalScores = calculateTableGameScores(gameData.players);
    const lowIsBetter = resolveTableGameLowIsBetter(game);
    const winnerIds = calculateWinnersByScore(finalScores, lowIsBetter);

    // Fallback winner name
    const winnerName = gameData.winner_name || game.gameData?.winner_name;
    const winnerNameLower = winnerName ? winnerName.toLowerCase() : null;

    gameData.players.forEach((player, index) => {
      const playerId = `player_${index}`;
      const identityId = player.identityId;
      if (!identityId) return;
      if (gameType && gameType !== gameMode) return;

      const identityIdStr = identityId.toString();
      const playerKey = identityToPlayerKeyMap[identityIdStr];
      if (!playerKey) return;

      const displayName = userDisplayNames[playerKey] || player.name;
      const isGuest = playerKeyIsGuest[playerKey] || false;

      if (!playerStats[playerKey]) {
        playerStats[playerKey] = {
          id: playerKey,
          name: displayName,
          userId: isGuest ? null : playerKey,
          totalGames: 0,
          wins: 0,
          totalScore: 0,
          gameTypes: {},
          lastPlayed: game.createdAt
        };
      }

      const stats = playerStats[playerKey];
      stats.totalGames++;

      const isWinnerById = winnerIds.includes(playerId);
      const isWinnerByName = winnerNameLower && player.name && player.name.toLowerCase() === winnerNameLower;
      if (isWinnerById || isWinnerByName) {
        stats.wins++;
      }

      if (finalScores[playerId] !== undefined) {
        stats.totalScore += finalScores[playerId];
      }

      if (!stats.gameTypes[gameMode]) {
        stats.gameTypes[gameMode] = { games: 0, wins: 0, totalScore: 0 };
      }
      stats.gameTypes[gameMode].games++;
      if (isWinnerById || isWinnerByName) {
        stats.gameTypes[gameMode].wins++;
      }
      if (finalScores[playerId] !== undefined) {
        stats.gameTypes[gameMode].totalScore += finalScores[playerId];
      }

      if (game.createdAt && new Date(game.createdAt) > new Date(stats.lastPlayed)) {
        stats.lastPlayed = game.createdAt;
      }
    });
  });

  // Build leaderboard array with derived stats
  const selectedGameLowIsBetter = gameType
    ? gameTypeSettings[gameType]?.lowIsBetter || false
    : false;

  const leaderboard = Object.values(playerStats).map(player => {
    const winRate = player.totalGames > 0
      ? ((player.wins / player.totalGames) * 100).toFixed(1)
      : 0;
    const avgScore = player.totalGames > 0
      ? (player.totalScore / player.totalGames).toFixed(1)
      : 0;

    let elo = DEFAULT_ELO_RATING;
    const userElo = userEloByGameType[player.id];
    if (userElo && gameType) {
      const normalizedType = normalizeGameType(gameType);
      const eloData = userElo[normalizedType] || userElo.get?.(normalizedType);
      if (eloData) {
        elo = eloData.rating || DEFAULT_ELO_RATING;
      }
    }

    return {
      ...player,
      winRate: parseFloat(winRate),
      avgScore: parseFloat(avgScore),
      elo: Math.round(elo)
    };
  });

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
  const gameTypes = Array.from(gameTypeSet).sort();
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 50, 100);
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;
  const paginatedLeaderboard = leaderboard.slice(startIndex, endIndex);

  return {
    leaderboard: paginatedLeaderboard,
    gameTypes,
    gameTypeSettings,
    totalGames: wizardGames.length + tableGames.length,
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(leaderboard.length / limitNum),
      totalPlayers: leaderboard.length,
      hasNextPage: endIndex < leaderboard.length,
      hasPrevPage: pageNum > 1
    }
  };
}

module.exports = { calculateLeaderboard };
