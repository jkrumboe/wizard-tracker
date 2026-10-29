/**
 * ELO Rating Service
 * 
 * Implements a multi-player ELO rating system for card games.
 * Uses pairwise comparison where each player's rating change is calculated
 * against all other players in the game.
 * 
 * Key Features:
 * - Multi-player support (3-6 players)
 * - Game-type-specific ratings (Wizard, Flip 7, Dutch, etc.)
 * - Dynamic K-factor based on games played
 * - Placement-based scoring (not binary win/loss)
 * - Per-opponent score margin multiplier (scale-aware, capped for losers)
 * - Normalized by the number of rated opponents
 * - Provisional player dampening
 */

const mongoose = require('mongoose');
const { resolveTableGameLowIsBetter } = require('./gameHelpers');

// ELO Configuration
const CONFIG = {
  DEFAULT_RATING: 1000,
  MIN_RATING: 100,            // Floor to prevent negative ratings
  
  // K-factor determines rating volatility
  // These represent the approximate max rating change per game (after normalization)
  K_FACTOR: {
    NEW_PLAYER: 32,           // < 10 games: calibrating quickly
    DEVELOPING: 24,           // 10-30 games: still settling
    ESTABLISHED: 20,          // 30-100 games: stable
    VETERAN: 16               // 100+ games: minimal change
  },
  
  // Thresholds for K-factor
  GAMES_THRESHOLD: {
    NEW: 10,
    DEVELOPING: 30,
    ESTABLISHED: 100
  },
  
  // Score margin bonus, applied per opponent to the result it reinforces:
  // a winner's gain grows by the full bonus, a loser's loss by at most MARGIN_LOSS_MAX
  MARGIN_BONUS: {
    BLOWOUT: 0.15,            // +15%
    DECISIVE: 0.10,           // +10%
    CLOSE: 0.05               // +5%
  },
  
  // Wizard scores share one scale, so its margins are absolute points
  WIZARD_MARGIN_POINTS: {
    BLOWOUT: 50,
    DECISIVE: 30,
    CLOSE: 10
  },
  
  // Other games score on arbitrary scales (Dutch ends in single digits, others in
  // the thousands), so their margins are relative to the larger of the two scores
  RELATIVE_MARGIN_RATIO: {
    BLOWOUT: 0.5,
    DECISIVE: 0.3,
    CLOSE: 0.1
  },
  
  // A blowout makes a loser's loss at most 10% larger
  MARGIN_LOSS_MAX: 0.10,
  
  // Per-game rating change cap (absolute value)
  // Prevents extreme outlier swings regardless of K-factor
  MAX_CHANGE_PER_GAME: 50,
  
  // Provisional player dampening
  // Reduces rating impact when established players face provisional (<10 games) players
  PROVISIONAL_DAMPENING: 0.5,
  
  // Minimum games to appear on leaderboard
  MIN_GAMES_FOR_RANKING: 5,
  
  // Rating history entries kept per player and game type
  MAX_HISTORY: 50,
  
  // Identities written per bulkWrite during a full recalculation
  RECALC_WRITE_BATCH: 500,
  
  // A recalculation lock nobody refreshed for this long belongs to a crashed run
  RECALC_LOCK_TTL_MS: 10 * 60 * 1000,
  
  // Known game types (for normalization)
  GAME_TYPES: {
    WIZARD: 'wizard',
    TABLE_PREFIX: 'table-'    // Table games will be "table-flip-7", "table-dutch", etc.
  }
};

/**
 * Determine if a game's data indicates it is finished.
 * Checks gameFinished flag first, then falls back to heuristics:
 * having winner_id/winner_ids AND final_scores or points data.
 */
function isGameFinished(gameData) {
  if (!gameData) return false;
  if (gameData.gameFinished === true) return true;
  
  // Heuristic: game has winners and scoring data → treat as finished
  const hasWinner = !!(gameData.winner_id || (gameData.winner_ids && gameData.winner_ids.length > 0));
  const hasFinalScores = gameData.final_scores && Object.keys(gameData.final_scores).length > 0;
  const hasPoints = (gameData.players || []).some(p => Array.isArray(p.points) && p.points.length > 0);
  
  return hasWinner && (hasFinalScores || hasPoints);
}

/**
 * Normalize game type string for consistent storage
 *
 * Table games only carry the name they were played under, so "Flip 7",
 * "Flip7" and "flip-7" are one game typed three ways. The key ignores case,
 * spacing, punctuation and accents so they share one rating ("Flip 7" ->
 * "flip7"). Being letters and digits only, it is also always a valid Mongoose
 * Map key (no '.' or '$'). Must match getGameTypeKey in
 * frontend/src/shared/utils/gameTypes.js.
 *
 * @param {string} gameType - Raw game type
 * @returns {string} Normalized game type key
 */
function normalizeGameType(gameType) {
  if (!gameType) return 'unknown';
  const normalized = String(gameType)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
  return normalized || 'unknown';
}

/**
 * Get ELO data for a specific game type from identity
 * @param {Object} identity - PlayerIdentity document
 * @param {string} gameType - Game type key
 * @returns {Object} ELO data for the game type
 */
function getEloForGameType(identity, gameType) {
  const normalized = normalizeGameType(gameType);
  const eloMap = identity.eloByGameType || new Map();
  
  if (eloMap.has(normalized)) {
    return eloMap.get(normalized);
  }
  
  // Return default ELO structure
  return createEloEntry();
}

/**
 * Calculate K-factor based on games played
 */
function getKFactor(gamesPlayed) {
  if (gamesPlayed < CONFIG.GAMES_THRESHOLD.NEW) {
    return CONFIG.K_FACTOR.NEW_PLAYER;
  }
  if (gamesPlayed < CONFIG.GAMES_THRESHOLD.DEVELOPING) {
    return CONFIG.K_FACTOR.DEVELOPING;
  }
  if (gamesPlayed < CONFIG.GAMES_THRESHOLD.ESTABLISHED) {
    return CONFIG.K_FACTOR.ESTABLISHED;
  }
  return CONFIG.K_FACTOR.VETERAN;
}

/**
 * Calculate expected score against a single opponent
 * Standard ELO formula: E = 1 / (1 + 10^((Rb - Ra) / 400))
 */
function getExpectedScore(playerRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/**
 * Score margin bonus for one pairwise result (0 to MARGIN_BONUS.BLOWOUT).
 * Wizard uses absolute point gaps; every other game a gap relative to its scores.
 */
function getMarginBonus(scoreA, scoreB, gameType) {
  const margin = Math.abs(scoreA - scoreB);
  const isWizard = normalizeGameType(gameType) === CONFIG.GAME_TYPES.WIZARD;
  const thresholds = isWizard ? CONFIG.WIZARD_MARGIN_POINTS : CONFIG.RELATIVE_MARGIN_RATIO;
  const value = isWizard ? margin : margin / Math.max(Math.abs(scoreA), Math.abs(scoreB), 1);
  
  if (value >= thresholds.BLOWOUT) return CONFIG.MARGIN_BONUS.BLOWOUT;
  if (value >= thresholds.DECISIVE) return CONFIG.MARGIN_BONUS.DECISIVE;
  if (value >= thresholds.CLOSE) return CONFIG.MARGIN_BONUS.CLOSE;
  return 0;
}

/**
 * Calculate placement-based actual score for a pairwise comparison.
 * Instead of binary 1/0, gives fractional scores based on placement gap.
 * 
 * Examples (6-player game):
 *   2nd vs 1st: 0.4  (close finish, small penalty)
 *   6th vs 1st: 0.0  (last vs first, full penalty)
 *   1st vs 6th: 1.0  (first vs last, full credit)
 *   3rd vs 5th: 0.7  (moderate gap, moderate credit)
 */
function getPlacementScore(playerPlacement, opponentPlacement, numPlayers) {
  if (playerPlacement === opponentPlacement) return 0.5;
  const maxGap = numPlayers - 1;
  if (playerPlacement < opponentPlacement) {
    // Player ranked higher (better) — score between 0.5 and 1.0
    const gap = opponentPlacement - playerPlacement;
    return 0.5 + (gap / maxGap) * 0.5;
  } else {
    // Player ranked lower (worse) — score between 0.0 and 0.5
    const gap = playerPlacement - opponentPlacement;
    return 0.5 - (gap / maxGap) * 0.5;
  }
}

/**
 * Calculate provisional dampening factor.
 * Reduces rating impact when an established player faces a provisional (new) player.
 * This prevents new players with volatile K-factors from heavily disrupting established ratings.
 * 
 * @param {number} playerGames - Games played by the player being calculated
 * @param {number} opponentGames - Games played by the opponent
 * @returns {number} Dampening factor (0.0-1.0, where 1.0 = no dampening)
 */
function getProvisionalDampening(playerGames, opponentGames) {
  const playerIsNew = playerGames < CONFIG.GAMES_THRESHOLD.NEW;
  const opponentIsNew = opponentGames < CONFIG.GAMES_THRESHOLD.NEW;
  
  // If established player vs provisional opponent, reduce impact on established player
  if (!playerIsNew && opponentIsNew) {
    return CONFIG.PROVISIONAL_DAMPENING;
  }
  
  return 1.0;
}

/**
 * Calculate ELO changes for all players in a finished game
 * Uses pairwise comparison - each player is compared to every other player
 * 
 * @param {Object} gameData - The game's gameData object
 * @param {Map} playerIdentities - Map of player ID -> PlayerIdentity document
 * @param {string} gameType - Game type for ELO lookup
 * @returns {Array} Array of { identityId, oldRating, newRating, change, placement }
 */
function calculateGameEloChanges(gameData, playerIdentities, gameType) {
  if (!isGameFinished(gameData)) {
    return [];
  }
  
  const normalizedGameType = normalizeGameType(gameType);
  const players = gameData.players || [];
  const finalScores = gameData.final_scores || {};
  
  if (players.length < 2) {
    return [];
  }
  
  // Sort players by score to determine placement
  // For table games, scores are in player.points arrays; for wizard games, in final_scores map
  // Respect lowIsBetter: if true, lowest score wins (e.g., Dutch)
  const lowIsBetter = gameData.lowIsBetter === true;
  const rankedPlayers = players
    .map(p => {
      let score = 0;
      if (finalScores && p.id && finalScores[p.id] != null) {
        // Wizard game format: final_scores[playerId]
        score = finalScores[p.id];
      } else if (Array.isArray(p.points) && p.points.length > 0) {
        // Table game format: sum of points array
        score = p.points.reduce((sum, val) => sum + (Number(val) || 0), 0);
      }
      return {
        id: p.id,
        name: p.name,
        identityId: p.identityId,
        score
      };
    })
    .sort((a, b) => lowIsBetter ? a.score - b.score : b.score - a.score);
  
  // Assign placements (handle ties)
  // Players are already sorted best-to-worst, so just check if score differs from previous
  let currentPlacement = 1;
  rankedPlayers.forEach((player, index) => {
    if (index > 0 && player.score !== rankedPlayers[index - 1].score) {
      currentPlacement = index + 1;
    }
    player.placement = currentPlacement;
  });
  
  const results = [];
  const numPlayers = rankedPlayers.length;

  // Only players whose identity was loaded can be rated or rated against. A
  // missing one (deleted, or never resolved) still holds its placement, but
  // must not count as an opponent - looking up its rating used to throw and
  // abort the update for the whole game.
  const ratedPlayers = rankedPlayers.filter(
    p => p.identityId && playerIdentities.get(p.identityId.toString())
  );

  for (const player of ratedPlayers) {
    const identity = playerIdentities.get(player.identityId.toString());

    // Get ELO for this specific game type
    const playerElo = getEloForGameType(identity, normalizedGameType);
    const currentRating = playerElo.rating || CONFIG.DEFAULT_RATING;
    const gamesPlayed = playerElo.gamesPlayed || 0;
    const kFactor = getKFactor(gamesPlayed);

    // Sum of (actual - expected) over all rated opponents
    let weightedDiff = 0;
    let numOpponents = 0;

    for (const opponent of ratedPlayers) {
      if (opponent === player) continue;
      numOpponents++;

      const opponentIdentity = playerIdentities.get(opponent.identityId.toString());
      const opponentElo = getEloForGameType(opponentIdentity, normalizedGameType);
      const opponentRating = opponentElo.rating || CONFIG.DEFAULT_RATING;
      const opponentGamesPlayed = opponentElo.gamesPlayed || 0;

      // Provisional dampening: reduce impact when established players face new players
      const provisionalFactor = getProvisionalDampening(gamesPlayed, opponentGamesPlayed);

      // Placement-based actual score (not binary win/loss) against the expected one
      const pairDiff = getPlacementScore(player.placement, opponent.placement, numPlayers)
        - getExpectedScore(currentRating, opponentRating);

      // The score margin only reinforces the result it belongs to: a big win
      // grows a gain, a big loss grows a loss (capped). It never flips into
      // the other direction - multiplying the net change made a blowout winner
      // who still underperformed lose more, and a crushed loser lose less.
      // For lowIsBetter games, having a lower score means beating the opponent.
      const playerBeatOpponent = lowIsBetter
        ? player.score < opponent.score
        : player.score > opponent.score;
      const opponentBeatPlayer = lowIsBetter
        ? player.score > opponent.score
        : player.score < opponent.score;
      let marginMultiplier = 1;
      if (playerBeatOpponent && pairDiff > 0) {
        marginMultiplier += getMarginBonus(player.score, opponent.score, normalizedGameType);
      } else if (opponentBeatPlayer && pairDiff < 0) {
        marginMultiplier += Math.min(
          getMarginBonus(player.score, opponent.score, normalizedGameType),
          CONFIG.MARGIN_LOSS_MAX
        );
      }

      weightedDiff += pairDiff * marginMultiplier * provisionalFactor;
    }

    // Nobody rated to compare against - nothing to learn from this game
    if (numOpponents === 0) continue;

    // Normalize by number of opponents so K represents max change per game,
    // not per opponent. Without this, 6-player games produce ~3x the change
    // of 2-player games just from having more pairwise comparisons.
    const won = player.placement === 1;
    let ratingChange = kFactor * (weightedDiff / numOpponents);
    
    // Round to integer
    ratingChange = Math.round(ratingChange);
    
    // Apply per-game cap to prevent extreme outlier swings
    ratingChange = Math.max(-CONFIG.MAX_CHANGE_PER_GAME, Math.min(CONFIG.MAX_CHANGE_PER_GAME, ratingChange));
    
    // Apply minimum rating floor
    const newRating = Math.max(CONFIG.MIN_RATING, currentRating + ratingChange);
    
    results.push({
      identityId: player.identityId,
      playerName: player.name,
      placement: player.placement,
      score: player.score,
      oldRating: currentRating,
      newRating: newRating,
      change: newRating - currentRating,
      won: won,
      gameType: normalizedGameType,
      opponents: rankedPlayers
        .filter(p => p.id !== player.id)
        .map(p => p.name)
    });
  }
  
  return results;
}

/**
 * Build a map that resolves any identity ID to its primary (canonical) identity ID.
 * Handles two cases:
 * 1. Explicitly merged identities (mergedInto is set)
 * 2. Multiple unmerged identities for the same userId (picks the 'user' type one as primary)
 * 
 * @returns {Map<string, string>} Maps identityId string → primary identityId string
 */
async function buildIdentityMergeMap() {
  const PlayerIdentity = mongoose.model('PlayerIdentity');
  
  // Load ALL identities (including deleted/merged ones) to build the full map
  const allIdentities = await PlayerIdentity.find({}, {
    _id: 1, userId: 1, mergedInto: 1, type: 1, isDeleted: 1, displayName: 1
  }).lean();
  
  const mergeMap = new Map(); // identityId → primaryIdentityId
  
  // Step 1: Handle explicit mergedInto chains
  const mergedIntoMap = new Map();
  for (const identity of allIdentities) {
    const idStr = identity._id.toString();
    if (identity.mergedInto) {
      mergedIntoMap.set(idStr, identity.mergedInto.toString());
    }
  }
  
  // Resolve chains (A → B → C becomes A → C, B → C)
  function resolveChain(id) {
    const visited = new Set();
    let current = id;
    while (mergedIntoMap.has(current) && !visited.has(current)) {
      visited.add(current);
      current = mergedIntoMap.get(current);
    }
    return current;
  }
  
  for (const identity of allIdentities) {
    const idStr = identity._id.toString();
    if (identity.mergedInto) {
      mergeMap.set(idStr, resolveChain(idStr));
    }
  }
  
  // Step 2: For identities sharing the same userId, consolidate to the primary (type='user') identity
  const userIdentities = new Map(); // userId → [identities]
  for (const identity of allIdentities) {
    if (identity.userId && !identity.isDeleted) {
      const userIdStr = identity.userId.toString();
      if (!userIdentities.has(userIdStr)) {
        userIdentities.set(userIdStr, []);
      }
      userIdentities.get(userIdStr).push(identity);
    }
  }
  
  for (const [, identities] of userIdentities) {
    if (identities.length <= 1) continue;
    
    // Pick the 'user' type identity as primary, fallback to the first one
    const primary = identities.find(i => i.type === 'user') || identities[0];
    const primaryIdStr = primary._id.toString();
    
    for (const identity of identities) {
      const idStr = identity._id.toString();
      if (idStr !== primaryIdStr) {
        // Only set if not already mapped by mergedInto
        if (!mergeMap.has(idStr)) {
          mergeMap.set(idStr, primaryIdStr);
        }
      }
    }
  }
  
  // Step 3: Map unlinked guests that share the same displayName as a user identity
  // This handles cases like SönkeSoffmann: guest identity not linked but same name as user identity
  const nameToUserIdentity = new Map(); // normalized name → primary identity id
  for (const identity of allIdentities) {
    if (identity.displayName && identity.userId && !identity.isDeleted && identity.type === 'user') {
      const normalizedName = identity.displayName.trim().toLowerCase();
      const primaryId = mergeMap.get(identity._id.toString()) || identity._id.toString();
      nameToUserIdentity.set(normalizedName, primaryId);
    }
  }
  
  for (const identity of allIdentities) {
    const idStr = identity._id.toString();
    // Skip if already mapped
    if (mergeMap.has(idStr)) continue;
    // Only target unlinked guest identities (no userId, no mergedInto)
    if (identity.type !== 'guest' || identity.userId || identity.mergedInto) continue;
    if (!identity.displayName) continue;
    
    const normalizedName = identity.displayName.trim().toLowerCase();
    if (nameToUserIdentity.has(normalizedName)) {
      mergeMap.set(idStr, nameToUserIdentity.get(normalizedName));
    }
  }
  
  return mergeMap;
}

/**
 * Remap game data player identityIds using a merge map.
 * Returns a shallow copy of gameData with remapped identityIds.
 * 
 * @param {Object} gameData - The game's gameData object
 * @param {Map<string, string>} mergeMap - Identity merge map
 * @returns {Object} gameData with remapped identityIds
 */
function remapGameIdentities(gameData, mergeMap) {
  if (!gameData?.players || mergeMap.size === 0) return gameData;
  
  const remappedPlayers = gameData.players.map(player => {
    if (!player.identityId) return player;
    
    const idStr = player.identityId.toString();
    const resolvedId = mergeMap.get(idStr);
    
    if (resolvedId && resolvedId !== idStr) {
      return {
        ...player,
        identityId: resolvedId, // Use the primary identity
        originalIdentityId: player.identityId // Preserve original for reference
      };
    }
    return player;
  });
  
  // Deduplicate: if two players now map to the same identity, that's a problem
  // This shouldn't happen in practice (same person shouldn't be in the same game twice)
  // but log a warning if it does
  const seen = new Set();
  const deduped = [];
  for (const player of remappedPlayers) {
    const key = player.identityId?.toString();
    if (key && seen.has(key)) {
      console.warn(`[ELO] Duplicate identity ${key} in game after merge resolution — skipping duplicate`);
      continue;
    }
    if (key) seen.add(key);
    deduped.push(player);
  }
  
  return { ...gameData, players: deduped };
}

/**
 * Fresh ELO entry for a player's first game of a type
 */
function createEloEntry() {
  return {
    rating: CONFIG.DEFAULT_RATING,
    peak: CONFIG.DEFAULT_RATING,
    floor: CONFIG.DEFAULT_RATING,
    gamesPlayed: 0,
    wins: 0,
    streak: 0,
    lastUpdated: null,
    history: []
  };
}

/**
 * When a game was played - orders the recalculation and dates the history
 */
function getGameDate(game) {
  return new Date(game.gameData?.created_at || game.createdAt || Date.now());
}

/**
 * The game data ELO is calculated from. Table games may nest the real data one
 * level deeper (gameData.gameData) and keep lowIsBetter / gameFinished on the
 * document itself, which reading game.gameData alone missed.
 *
 * @param {Object} game - WizardGame or TableGame document (or plain object)
 * @returns {Object|null}
 */
function getRatableGameData(game) {
  const outer = game?.gameData;
  if (!outer) return null;
  const inner = Array.isArray(outer.gameData?.players) ? outer.gameData : outer;
  return {
    ...inner,
    lowIsBetter: resolveTableGameLowIsBetter(game),
    gameFinished: inner.gameFinished === true || outer.gameFinished === true || game.gameFinished === true
  };
}

/**
 * Apply one calculated change to a player's ELO entry for a game type.
 * Shared by the live update and the full recalculation so both produce
 * identical entries.
 *
 * @param {Object} entry - Plain ELO entry (see createEloEntry), mutated
 * @param {Object} change - One result from calculateGameEloChanges
 * @param {Object} game - The game the change came from
 * @returns {Object} the updated entry
 */
function applyEloChange(entry, change, game) {
  // Entries written before wins were tracked have no count to add to; leave
  // them without one rather than start a wrong tally (a recalculation fills it)
  if (typeof entry.wins === 'number' || !entry.gamesPlayed) {
    entry.wins = (entry.wins || 0) + (change.won ? 1 : 0);
  }
  entry.rating = change.newRating;
  entry.gamesPlayed = (entry.gamesPlayed || 0) + 1;
  entry.lastUpdated = new Date();
  entry.peak = Math.max(entry.peak || CONFIG.DEFAULT_RATING, change.newRating);
  entry.floor = Math.min(entry.floor || CONFIG.DEFAULT_RATING, change.newRating);
  entry.streak = change.won
    ? Math.max(1, (entry.streak || 0) + 1)
    : Math.min(-1, (entry.streak || 0) - 1);

  // Newest first, capped
  entry.history = [{
    rating: change.newRating,
    change: change.change,
    gameId: game._id,
    opponents: change.opponents,
    placement: change.placement,
    date: getGameDate(game)
  }, ...(entry.history || [])].slice(0, CONFIG.MAX_HISTORY);

  return entry;
}

/**
 * Resolve identities that were merged into another one (following chains), so
 * a game recorded before the merge still rates the surviving identity instead
 * of a soft-deleted one.
 *
 * @param {Array} identityIds
 * @returns {Promise<Map<string, string>>} Only the ids that resolve elsewhere
 */
async function resolveMergedIdentities(identityIds) {
  const PlayerIdentity = mongoose.model('PlayerIdentity');
  const ids = identityIds.map(String);
  const mergedInto = new Map();
  const seen = new Set();
  let pending = ids;

  while (pending.length > 0) {
    pending.forEach(id => seen.add(id));
    const merged = await PlayerIdentity.find(
      { _id: { $in: pending }, mergedInto: { $ne: null } },
      { mergedInto: 1 }
    ).lean();
    pending = [];
    for (const identity of merged) {
      const target = identity.mergedInto.toString();
      mergedInto.set(identity._id.toString(), target);
      if (!seen.has(target)) pending.push(target);
    }
  }

  const mergeMap = new Map();
  for (const id of ids) {
    let current = id;
    const visited = new Set();
    while (mergedInto.has(current) && !visited.has(current)) {
      visited.add(current);
      current = mergedInto.get(current);
    }
    if (current !== id) mergeMap.set(id, current);
  }
  return mergeMap;
}

/**
 * Update player ELO ratings after a game
 * Uses MongoDB transactions when available to ensure atomic updates across all players
 * Falls back to non-transactional updates if transactions aren't supported
 *
 * @param {Object} game - WizardGame or TableGame document
 * @param {string} gameType - Game type (e.g., 'wizard', 'flip-7', 'dutch')
 * @param {Object} options - Optional settings
 * @param {number} options.maxRetries - Max retry attempts on failure (default: 3)
 * @returns {Array} Array of updated identities
 */
async function updateRatingsForGame(game, gameType, options = {}) {
  const { maxRetries = 3 } = options;
  const PlayerIdentity = mongoose.model('PlayerIdentity');
  let gameData = getRatableGameData(game);

  if (!isGameFinished(gameData)) {
    return [];
  }

  // A running recalculation would overwrite this update - let it apply the game afterwards
  if (await deferLiveUpdate(game, gameType)) {
    console.log(`[ELO] Recalculation running - game ${game._id} will be rated when it finishes`);
    return [];
  }

  const normalizedGameType = normalizeGameType(gameType);

  const recordedIdentityIds = (gameData.players || [])
    .filter(p => p.identityId)
    .map(p => p.identityId);

  if (recordedIdentityIds.length === 0) {
    console.warn(`[ELO] No player identities found for game ${game._id} (${gameData.players?.length || 0} players) — skipping ELO update`);
    return [];
  }

  // Rate the identities players were merged into, not the merged-away ones
  gameData = remapGameIdentities(gameData, await resolveMergedIdentities(recordedIdentityIds));
  const identityIds = gameData.players
    .filter(p => p.identityId)
    .map(p => p.identityId);

  // Check if transactions are supported (requires replica set)
  // Try transactional update first, fall back to non-transactional if unsupported
  let useTransactions = true;

  // Retry logic for transient failures
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let session = null;

    try {
      if (useTransactions) {
        session = await mongoose.startSession();
        session.startTransaction({
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' }
        });
      }

      // Read inside the transaction so the idempotency check and the ratings
      // it calculates from are the ones that get committed against
      const identities = await PlayerIdentity.find({
        _id: { $in: identityIds },
        isDeleted: false
      }).session(session);

      // Idempotency guard: check if ELO for this game was already applied
      // by looking for the gameId in any player's history
      const gameIdStr = game._id.toString();
      const alreadyApplied = identities.some(identity => {
        const gameTypeElo = identity.eloByGameType?.get(normalizedGameType);
        return gameTypeElo?.history?.some(h => h.gameId?.toString() === gameIdStr);
      });

      if (alreadyApplied) {
        if (session) {
          await session.abortTransaction();
          session.endSession();
        }
        console.log(`[ELO] Skipping game ${game._id} - ratings already applied`);
        return [];
      }

      const identityMap = new Map(
        identities.map(i => [i._id.toString(), i])
      );

      // Calculate ELO changes for this game type
      const changes = calculateGameEloChanges(gameData, identityMap, normalizedGameType);

      // Apply changes to identities within transaction
      const updatedIdentities = [];

      for (const change of changes) {
        const identity = identityMap.get(change.identityId.toString());
        if (!identity) continue;

        if (!identity.eloByGameType) {
          identity.eloByGameType = new Map();
        }

        // Map values are subdocuments - update a plain copy and set it back
        const stored = identity.eloByGameType.get(normalizedGameType);
        const entry = stored
          ? (stored.toObject ? stored.toObject() : { ...stored })
          : createEloEntry();
        identity.eloByGameType.set(normalizedGameType, applyEloChange(entry, change, game));
        identity.markModified('eloByGameType');

        // Save with or without session
        if (session) {
          await identity.save({ session });
        } else {
          await identity.save();
        }

        updatedIdentities.push({
          identity,
          change,
          gameType: normalizedGameType
        });
      }

      // Commit transaction if using one
      if (session) {
        await session.commitTransaction();
        session.endSession();
      }

      return updatedIdentities;

    } catch (error) {
      // Clean up session if it exists
      if (session) {
        try {
          await session.abortTransaction();
          session.endSession();
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }

      lastError = error;

      // Check if transactions aren't supported (standalone MongoDB)
      const isTransactionNotSupported =
        error.message?.includes('Transaction numbers are only allowed') ||
        error.message?.includes('not supported') ||
        error.codeName === 'IllegalOperation' ||
        error.code === 20; // IllegalOperation

      if (isTransactionNotSupported && useTransactions) {
        console.warn('MongoDB transactions not supported (standalone mode), falling back to non-transactional updates');
        useTransactions = false;
        // Retry immediately without transactions
        continue;
      }

      // Check if it's a transient error worth retrying
      const isTransient = error.hasErrorLabel?.('TransientTransactionError') ||
        error.code === 112 || // WriteConflict
        error.code === 251;   // TransactionCoordinatorSteppingDown

      if (isTransient && attempt < maxRetries) {
        console.warn(`ELO update attempt ${attempt} failed with transient error, retrying...`, error.message);
        // Exponential backoff: 100ms, 200ms, 400ms
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
        continue;
      }

      // Non-transient error or max retries reached
      console.error(`ELO update failed for game ${game._id} after ${attempt} attempt(s):`, error.message);
      throw error;
    }
  }

  // Should not reach here, but just in case
  throw lastError || new Error('ELO update failed after max retries');
}

// ============================================
// Recalculation lock
// ============================================
//
// A recalculation replays every game in memory and then overwrites every
// identity's ratings. A live update written in between would be lost, so while
// the lock is held live updates queue their game instead of applying it, and
// the queue is applied once the recalculation has written its results. The
// lock is one document in Mongo so it holds across backend instances; it
// expires so a crashed run can't block ratings forever.

const RECALC_LOCK_ID = 'elo-recalculation';

function getLockCollection() {
  return mongoose.connection.collection('elolocks');
}

/** Driver 5 wraps findOneAndX results in { value }, driver 6 doesn't. */
function unwrapFindAndModify(result) {
  return result && typeof result === 'object' && 'value' in result && 'ok' in result
    ? result.value
    : result;
}

/**
 * Take the lock. Returns false when another recalculation holds it.
 */
async function acquireRecalculationLock() {
  const now = new Date();
  try {
    await getLockCollection().updateOne(
      // Only a missing or expired lock can be taken
      { _id: RECALC_LOCK_ID, expiresAt: { $lte: now } },
      {
        $set: { startedAt: now, expiresAt: new Date(now.getTime() + CONFIG.RECALC_LOCK_TTL_MS), rerun: false },
        $setOnInsert: { pending: [] }
      },
      { upsert: true }
    );
    return true;
  } catch (error) {
    // The upsert collided with a live lock's _id
    if (error.code === 11000) return false;
    throw error;
  }
}

/** Keep a long recalculation's lock from expiring. */
async function extendRecalculationLock() {
  await getLockCollection().updateOne(
    { _id: RECALC_LOCK_ID },
    { $set: { expiresAt: new Date(Date.now() + CONFIG.RECALC_LOCK_TTL_MS) } }
  );
}

/**
 * Ask the running recalculation to run once more when it finishes - its replay
 * may have read the games before the change that prompted this request.
 * Returns false when no recalculation is running.
 */
async function requestRecalculationRerun() {
  const result = await getLockCollection().updateOne(
    { _id: RECALC_LOCK_ID, expiresAt: { $gt: new Date() } },
    { $set: { rerun: true } }
  );
  return result.matchedCount > 0;
}

/** Clear and return the rerun flag, keeping the lock. */
async function takeRerunRequest() {
  const lock = unwrapFindAndModify(await getLockCollection().findOneAndUpdate(
    { _id: RECALC_LOCK_ID },
    { $set: { rerun: false } }
  ));
  return lock?.rerun === true;
}

/**
 * Release the lock and return the games queued while it was held. Atomic with
 * deferLiveUpdate: a game is either in the returned queue or applied live.
 */
async function releaseRecalculationLock() {
  const lock = unwrapFindAndModify(await getLockCollection().findOneAndDelete({ _id: RECALC_LOCK_ID }));
  return lock?.pending || [];
}

/**
 * Queue a finished game while a recalculation holds the lock.
 * Returns true when the game was queued and must not be applied now.
 */
async function deferLiveUpdate(game, gameType) {
  const modelName = game?.constructor?.modelName;
  // Only documents can be reloaded later; anything else is applied right away
  if (!modelName || !game._id) return false;
  const result = await getLockCollection().updateOne(
    { _id: RECALC_LOCK_ID, expiresAt: { $gt: new Date() } },
    { $addToSet: { pending: { gameId: game._id, modelName, gameType } } }
  );
  return result.matchedCount > 0;
}

/** Apply the live updates that waited for a recalculation. */
async function applyDeferredUpdates(pending) {
  for (const { gameId, modelName, gameType } of pending) {
    try {
      const game = await mongoose.model(modelName).findById(gameId);
      // Already counted if the replay saw it - the idempotency guard skips those
      if (game) await updateRatingsForGame(game, gameType);
    } catch (error) {
      console.error(`[ELO] Failed to apply deferred update for ${modelName} ${gameId}:`, error.message);
    }
  }
}

/**
 * Recalculate ELO ratings for all players from scratch
 * Replays all finished games chronologically in memory, then writes every
 * identity's result in bulk. A dry run replays the same way without writing,
 * so its numbers are the ones a real run would produce.
 *
 * Only one recalculation runs at a time (see the lock above). Asking for one
 * while another runs makes the running one go again when it finishes, and
 * returns right away with `queued: true`.
 *
 * @param {Object} options - Options for recalculation
 * @param {boolean} options.dryRun - If true, don't save changes
 * @param {string} options.gameType - If specified, only recalculate for this game type
 * @param {Function} options.onProgress - Progress callback (current, total)
 * @returns {Object} Summary of recalculation
 */
async function recalculateAllElo(options = {}) {
  if (options.dryRun) {
    return replayAllGames(options);
  }

  if (!(await acquireRecalculationLock())) {
    if (await requestRecalculationRerun()) {
      console.log('[ELO] Recalculation already running - it will run again when finished');
      return { gamesProcessed: 0, playerUpdates: 0, gameTypeStats: {}, errors: [], dryRun: false, queued: true };
    }
    // The other run finished in the meantime
    return recalculateAllElo(options);
  }

  let pending = [];
  try {
    let result = await replayAllGames({ ...options, heartbeat: extendRecalculationLock });
    // Changes made during the run asked for another; a full one covers any game type
    while (await takeRerunRequest()) {
      console.log('[ELO] Running the recalculation again for changes made while it ran');
      result = await replayAllGames({ ...options, gameType: null, heartbeat: extendRecalculationLock });
    }
    return result;
  } finally {
    pending = await releaseRecalculationLock();
    if (pending.length > 0) {
      console.log(`[ELO] Applying ${pending.length} game(s) finished during the recalculation`);
      await applyDeferredUpdates(pending);
    }
  }
}

/**
 * The replay behind recalculateAllElo - no locking.
 * @param {Function} [options.heartbeat] - Called periodically during long runs
 */
async function replayAllGames(options = {}) {
  const { dryRun = false, gameType = null, onProgress = null, heartbeat = null } = options;

  const PlayerIdentity = mongoose.model('PlayerIdentity');
  const WizardGame = mongoose.model('WizardGame');

  // Try to load TableGame model if it exists
  let TableGame;
  try {
    TableGame = mongoose.model('TableGame');
  } catch (e) {
    // TableGame model not loaded
    TableGame = null;
  }

  const onlyGameType = gameType ? normalizeGameType(gameType) : null;

  console.log('🎯 Starting ELO recalculation...');

  // Build identity merge map to consolidate linked/merged identities
  const mergeMap = await buildIdentityMergeMap();
  if (mergeMap.size > 0) {
    console.log(`✓ Built identity merge map: ${mergeMap.size} identities will be consolidated`);
  }

  // Collect all games to process
  const allGames = [];

  // Get Wizard games (non-lean so we can update identities if needed)
  // Include games that are finished OR have completion indicators (winner + scores)
  const wizardGames = await WizardGame.find({
    $or: [
      { 'gameData.gameFinished': true },
      { 'gameData.winner_id': { $exists: true, $ne: null } },
      { 'gameData.winner_ids.0': { $exists: true } }
    ]
  });

  for (const game of wizardGames) {
    allGames.push({ game, gameType: 'wizard', date: getGameDate(game) });
  }

  // Get Table games (non-lean so we can update identities if needed)
  if (TableGame) {
    const tableGames = await TableGame.find({
      $or: [
        { gameFinished: true },
        { 'gameData.gameFinished': true },
        { 'gameData.gameData.gameFinished': true }
      ]
    });

    for (const game of tableGames) {
      // Table game type is stored in gameTypeName or gameData.gameType or game.gameType
      const tableGameType = game.gameTypeName || game.gameData?.gameType || game.gameType || 'table';
      allGames.push({
        game,
        gameType: normalizeGameType(tableGameType),
        date: getGameDate(game)
      });
    }
  }

  // Sort all games chronologically
  allGames.sort((a, b) => a.date - b.date);

  // Phase: Normalize gameFinished and resolve missing identities on games
  if (!dryRun) {
    let gamesNormalized = 0;
    let identitiesResolved = 0;
    for (const { game } of allGames) {
      if (!game.gameData?.players) continue;
      let needsSave = false;

      // Normalize gameFinished: set to true if missing but game is clearly finished
      if (!game.gameData.gameFinished && isGameFinished(game.gameData)) {
        game.gameData.gameFinished = true;
        needsSave = true;
        gamesNormalized++;
      }

      for (const player of game.gameData.players) {
        if (!player.identityId && player.name) {
          try {
            const identity = await PlayerIdentity.findOrCreateByName(player.name, { type: 'guest' });
            player.identityId = identity._id;
            needsSave = true;
            identitiesResolved++;
          } catch (err) {
            console.warn(`[ELO recalc] Failed to resolve identity for "${player.name}":`, err.message);
          }
        }
      }
      if (needsSave) {
        try {
          // Use updateOne to avoid triggering post-save hooks during recalculation
          const GameModel = game.constructor;
          await GameModel.updateOne(
            { _id: game._id },
            { $set: {
              'gameData.players': game.gameData.players,
              'gameData.gameFinished': game.gameData.gameFinished
            } }
          );
        } catch (err) {
          console.warn(`[ELO recalc] Failed to save game ${game._id} after normalization:`, err.message);
        }
      }
    }
    if (gamesNormalized > 0) {
      console.log(`✓ Normalized gameFinished on ${gamesNormalized} games`);
    }
    if (identitiesResolved > 0) {
      console.log(`✓ Resolved ${identitiesResolved} missing player identities across games`);
    }
  }

  // Filter by game type if specified
  const gamesToProcess = onlyGameType
    ? allGames.filter(g => g.gameType === onlyGameType)
    : allGames;

  console.log(`📊 Processing ${gamesToProcess.length} finished games...`);

  // Everyone starts from a clean slate; ratings live in memory until the end.
  // Loaded after the normalization phase so identities it created are included.
  const identities = await PlayerIdentity.find({ isDeleted: false }, { _id: 1, eloByGameType: 1 }).lean();
  const ratingState = new Map(
    identities.map(i => [i._id.toString(), { _id: i._id, eloByGameType: new Map() }])
  );

  let processed = 0;
  let playersUpdated = 0;
  const errors = [];
  const gameTypeCounts = {};

  for (const { game: gameDoc, gameType: gt } of gamesToProcess) {
    try {
      gameTypeCounts[gt] = (gameTypeCounts[gt] || 0) + 1;

      // Convert Mongoose document to plain object for processing
      const game = gameDoc.toObject ? gameDoc.toObject() : gameDoc;

      // Remap identity IDs for merged/linked players so they share one ELO
      const gameData = remapGameIdentities(getRatableGameData(game), mergeMap);
      const changes = calculateGameEloChanges(gameData, ratingState, gt);

      for (const change of changes) {
        const state = ratingState.get(change.identityId.toString());
        const entry = state.eloByGameType.get(gt) || createEloEntry();
        state.eloByGameType.set(gt, applyEloChange(entry, change, game));
      }
      playersUpdated += changes.length;

      processed++;

      if (onProgress) {
        onProgress(processed, gamesToProcess.length);
      }

      if (processed % 100 === 0) {
        console.log(`   Progress: ${processed}/${gamesToProcess.length} (${((processed / gamesToProcess.length) * 100).toFixed(1)}%)`);
        if (heartbeat) await heartbeat();
      }
    } catch (error) {
      errors.push({ gameId: gameDoc._id, gameType: gt, error: error.message });
    }
  }

  if (!dryRun) {
    const ops = [];
    for (const identity of identities) {
      const computed = ratingState.get(identity._id.toString()).eloByGameType;
      const stored = identity.eloByGameType || {};
      const filter = { _id: identity._id };

      if (onlyGameType) {
        // Leave every other game type untouched
        const key = `eloByGameType.${onlyGameType}`;
        if (computed.has(onlyGameType)) {
          ops.push({ updateOne: { filter, update: { $set: { [key]: computed.get(onlyGameType) } } } });
        } else if (stored[onlyGameType]) {
          ops.push({ updateOne: { filter, update: { $unset: { [key]: '' } } } });
        }
      } else if (computed.size > 0 || Object.keys(stored).length > 0) {
        ops.push({ updateOne: { filter, update: { $set: { eloByGameType: Object.fromEntries(computed) } } } });
      }
    }

    for (let i = 0; i < ops.length; i += CONFIG.RECALC_WRITE_BATCH) {
      await PlayerIdentity.bulkWrite(ops.slice(i, i + CONFIG.RECALC_WRITE_BATCH), { ordered: false });
    }
    console.log(`✓ Saved ELO for ${ops.length} identities`);
  }

  console.log(`✅ ELO recalculation complete!`);
  console.log(`   Games processed: ${processed}`);
  console.log(`   Player updates: ${playersUpdated}`);
  console.log(`   Errors: ${errors.length}`);
  console.log(`   Games by type:`, gameTypeCounts);

  return {
    gamesProcessed: processed,
    playerUpdates: playersUpdated,
    gameTypeStats: gameTypeCounts,
    errors,
    dryRun
  };
}

/**
 * Win rate (percent, one decimal) for a player in one game type.
 * Uses the per-type win count; entries from before it was tracked fall back
 * to the identity's overall stats until the next recalculation.
 */
function getWinRate(elo, overallStats) {
  if (typeof elo.wins === 'number' && elo.gamesPlayed > 0) {
    return ((elo.wins / elo.gamesPlayed) * 100).toFixed(1);
  }
  return overallStats?.totalGames > 0
    ? ((overallStats.totalWins / overallStats.totalGames) * 100).toFixed(1)
    : '0.0';
}

/**
 * Get ELO rankings (leaderboard) for a specific game type
 * @param {Object} options - Query options
 * @param {string} options.gameType - Game type to get rankings for (required)
 */
async function getEloRankings(options = {}) {
  const { 
    gameType = 'wizard',
    page = 1, 
    limit = 50, 
    minGames = CONFIG.MIN_GAMES_FOR_RANKING 
  } = options;
  
  const PlayerIdentity = mongoose.model('PlayerIdentity');
  const normalizedGameType = normalizeGameType(gameType);
  
  const skip = (page - 1) * limit;
  
  // Find all identities that have ELO for this game type
  const identities = await PlayerIdentity.find({
    isDeleted: false,
    [`eloByGameType.${normalizedGameType}`]: { $exists: true }
  })
    .select(`displayName userId type eloByGameType.${normalizedGameType} stats`)
    .populate('userId', 'username');
  
  // Filter by minGames and sort
  const filtered = identities
    .map(identity => {
      const elo = identity.eloByGameType?.get(normalizedGameType);
      return {
        identity,
        elo: elo || { rating: CONFIG.DEFAULT_RATING, gamesPlayed: 0 }
      };
    })
    .filter(item => item.elo.gamesPlayed >= minGames)
    .sort((a, b) => {
      if (b.elo.rating !== a.elo.rating) return b.elo.rating - a.elo.rating;
      return b.elo.gamesPlayed - a.elo.gamesPlayed;
    });
  
  const total = filtered.length;
  const paged = filtered.slice(skip, skip + limit);
  
  return {
    gameType: normalizedGameType,
    rankings: paged.map((item, index) => ({
      rank: skip + index + 1,
      identityId: item.identity._id,
      displayName: item.identity.displayName,
      username: item.identity.userId?.username || null,
      type: item.identity.type,
      rating: item.elo.rating || CONFIG.DEFAULT_RATING,
      peak: item.elo.peak || CONFIG.DEFAULT_RATING,
      floor: item.elo.floor || CONFIG.DEFAULT_RATING,
      gamesPlayed: item.elo.gamesPlayed || 0,
      streak: item.elo.streak || 0,
      winRate: getWinRate(item.elo, item.identity.stats)
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    config: {
      minGamesForRanking: minGames,
      defaultRating: CONFIG.DEFAULT_RATING
    }
  };
}

/**
 * Get ELO history for a specific identity and game type
 * @param {string} identityId - Identity ID
 * @param {Object} options - Query options
 * @param {string} options.gameType - Game type (default: 'wizard')
 * @param {number} options.limit - Max history entries
 */
async function getEloHistory(identityId, options = {}) {
  const { gameType = 'wizard', limit = 20 } = options;
  
  const PlayerIdentity = mongoose.model('PlayerIdentity');
  const normalizedGameType = normalizeGameType(gameType);
  
  const identity = await PlayerIdentity.findById(identityId)
    .select('displayName eloByGameType stats');
  
  if (!identity) {
    return null;
  }
  
  const elo = identity.eloByGameType?.get(normalizedGameType);
  
  // Get all game types this player has ELO for
  const allGameTypes = identity.eloByGameType 
    ? Array.from(identity.eloByGameType.keys())
    : [];
  
  return {
    identityId: identity._id,
    displayName: identity.displayName,
    gameType: normalizedGameType,
    allGameTypes,
    currentRating: elo?.rating || CONFIG.DEFAULT_RATING,
    peak: elo?.peak || CONFIG.DEFAULT_RATING,
    floor: elo?.floor || CONFIG.DEFAULT_RATING,
    gamesPlayed: elo?.gamesPlayed || 0,
    streak: elo?.streak || 0,
    history: (elo?.history || []).slice(0, limit)
  };
}

/**
 * Get all ELO ratings for an identity across all game types
 * @param {string} identityId - Identity ID
 */
async function getAllEloForIdentity(identityId) {
  const PlayerIdentity = mongoose.model('PlayerIdentity');
  
  const identity = await PlayerIdentity.findById(identityId)
    .select('displayName eloByGameType stats');
  
  if (!identity) {
    return null;
  }
  
  const eloByType = {};
  if (identity.eloByGameType) {
    for (const [gameType, elo] of identity.eloByGameType.entries()) {
      eloByType[gameType] = {
        rating: elo.rating || CONFIG.DEFAULT_RATING,
        peak: elo.peak || CONFIG.DEFAULT_RATING,
        floor: elo.floor || CONFIG.DEFAULT_RATING,
        gamesPlayed: elo.gamesPlayed || 0,
        streak: elo.streak || 0,
        lastUpdated: elo.lastUpdated,
        historyCount: (elo.history || []).length
      };
    }
  }
  
  return {
    identityId: identity._id,
    displayName: identity.displayName,
    eloByGameType: eloByType,
    gameTypes: Object.keys(eloByType)
  };
}

module.exports = {
  CONFIG,
  normalizeGameType,
  getKFactor,
  getEloForGameType,
  getPlacementScore,
  getProvisionalDampening,
  getMarginBonus,
  getRatableGameData,
  applyEloChange,
  calculateGameEloChanges,
  buildIdentityMergeMap,
  remapGameIdentities,
  updateRatingsForGame,
  recalculateAllElo,
  // Recalculation lock steps, exposed for tests
  acquireRecalculationLock,
  releaseRecalculationLock,
  applyDeferredUpdates,
  getEloRankings,
  getEloHistory,
  getAllEloForIdentity
};
