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
 * - Score margin bonus for winners, capped penalty for losers
 * - Player count scaling (normalized to 4-player baseline)
 * - Provisional player dampening
 */

const mongoose = require('mongoose');

// ELO Configuration
const CONFIG = {
  DEFAULT_RATING: 1000,
  MIN_RATING: 100,            // Floor to prevent negative ratings
  
  // K-factor determines rating volatility
  K_FACTOR: {
    NEW_PLAYER: 40,           // < 10 games: high volatility for placement
    DEVELOPING: 32,           // 10-30 games: still calibrating
    ESTABLISHED: 24,          // 30-100 games: stable
    VETERAN: 16               // 100+ games: minimal change
  },
  
  // Thresholds for K-factor
  GAMES_THRESHOLD: {
    NEW: 10,
    DEVELOPING: 30,
    ESTABLISHED: 100
  },
  
  // Score margin bonus (percentage of base change) — applied to winners
  MARGIN_BONUS: {
    BLOWOUT: 0.25,            // Win by 50+ points: +25% bonus
    DECISIVE: 0.15,           // Win by 30-49 points: +15% bonus
    CLOSE: 0.05               // Win by 10-29 points: +5% bonus
  },
  
  // Loss margin penalty cap (losers never get more than -10% regardless of margin)
  MARGIN_LOSS_MAX: 0.10,
  
  // Player count scaling: normalize to a 4-player baseline
  // 6 players = 1.5x, 3 players = 0.75x
  PLAYER_COUNT_BASELINE: 4,
  
  // Provisional player dampening
  // Reduces rating impact when established players face provisional (<10 games) players
  PROVISIONAL_DAMPENING: 0.5,
  
  // Minimum games to appear on leaderboard
  MIN_GAMES_FOR_RANKING: 5,
  
  // Known game types (for normalization)
  GAME_TYPES: {
    WIZARD: 'wizard',
    TABLE_PREFIX: 'table-'    // Table games will be "table-flip-7", "table-dutch", etc.
  }
};

/**
 * Normalize game type string for consistent storage
 * @param {string} gameType - Raw game type
 * @returns {string} Normalized game type key
 */
function normalizeGameType(gameType) {
  if (!gameType) return 'unknown';
  return gameType.toLowerCase().trim().replace(/\s+/g, '-');
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
  return {
    rating: CONFIG.DEFAULT_RATING,
    peak: CONFIG.DEFAULT_RATING,
    floor: CONFIG.DEFAULT_RATING,
    gamesPlayed: 0,
    streak: 0,
    lastUpdated: null,
    history: []
  };
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
 * Calculate score margin multiplier
 * Winners get full bonus, losers get capped penalty (max MARGIN_LOSS_MAX)
 */
function getMarginMultiplier(playerScore, opponentScore, won) {
  const margin = Math.abs(playerScore - opponentScore);
  
  let bonus = 0;
  if (margin >= 50) bonus = CONFIG.MARGIN_BONUS.BLOWOUT;
  else if (margin >= 30) bonus = CONFIG.MARGIN_BONUS.DECISIVE;
  else if (margin >= 10) bonus = CONFIG.MARGIN_BONUS.CLOSE;
  
  if (won) {
    return 1 + bonus;
  } else {
    // Cap loss penalty at MARGIN_LOSS_MAX (e.g. -10% max instead of -25%)
    return 1 - Math.min(bonus, CONFIG.MARGIN_LOSS_MAX);
  }
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
  if (!gameData.gameFinished) {
    return [];
  }
  
  const normalizedGameType = normalizeGameType(gameType);
  const players = gameData.players || [];
  const finalScores = gameData.final_scores || {};
  const winnerId = gameData.winner_id;
  
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
  
  for (const player of rankedPlayers) {
    if (!player.identityId) continue;
    
    const identity = playerIdentities.get(player.identityId.toString());
    if (!identity) continue;
    
    // Get ELO for this specific game type
    const playerElo = getEloForGameType(identity, normalizedGameType);
    const currentRating = playerElo.rating || CONFIG.DEFAULT_RATING;
    const gamesPlayed = playerElo.gamesPlayed || 0;
    const kFactor = getKFactor(gamesPlayed);
    
    // Calculate expected and actual scores against all opponents
    let expectedTotal = 0;
    let actualTotal = 0;
    let marginMultiplier = 1;
    
    for (const opponent of rankedPlayers) {
      if (opponent.id === player.id || !opponent.identityId) continue;
      
      const opponentIdentity = playerIdentities.get(opponent.identityId.toString());
      const opponentElo = getEloForGameType(opponentIdentity, normalizedGameType);
      const opponentRating = opponentElo?.rating || CONFIG.DEFAULT_RATING;
      const opponentGamesPlayed = opponentElo?.gamesPlayed || 0;
      
      // Provisional dampening: reduce impact when established players face new players
      const provisionalFactor = getProvisionalDampening(gamesPlayed, opponentGamesPlayed);
      
      // Expected score against this opponent (dampened for provisional matchups)
      expectedTotal += getExpectedScore(currentRating, opponentRating) * provisionalFactor;
      
      // Placement-based actual score (not binary win/loss)
      // Gives fractional credit based on placement gap
      actualTotal += getPlacementScore(player.placement, opponent.placement, numPlayers) * provisionalFactor;
      
      // Score margin multiplier (full bonus for winners, capped penalty for losers)
      // For lowIsBetter games, having a lower score means beating the opponent
      const playerBeatOpponent = lowIsBetter 
        ? player.score < opponent.score 
        : player.score > opponent.score;
      const opponentBeatPlayer = lowIsBetter
        ? player.score > opponent.score
        : player.score < opponent.score;
      if (playerBeatOpponent) {
        marginMultiplier *= getMarginMultiplier(player.score, opponent.score, true);
      } else if (opponentBeatPlayer) {
        marginMultiplier *= getMarginMultiplier(player.score, opponent.score, false);
      }
    }
    
    // Normalize margin multiplier across all opponents
    marginMultiplier = Math.pow(marginMultiplier, 1 / (numPlayers - 1));
    
    // Calculate base rating change
    const won = player.placement === 1;
    let ratingChange = kFactor * (actualTotal - expectedTotal) * marginMultiplier;
    
    // Player count scaling: normalize to 4-player baseline using square root
    // Provides diminishing returns so large games don't produce runaway values
    // 3p=0.87x, 4p=1.0x, 5p=1.12x, 6p=1.22x, 8p=1.41x
    const playerCountFactor = Math.sqrt(numPlayers / CONFIG.PLAYER_COUNT_BASELINE);
    ratingChange *= playerCountFactor;
    
    // Round to integer
    ratingChange = Math.round(ratingChange);
    
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
  const gameData = game.gameData;
  
  if (!gameData?.gameFinished) {
    return [];
  }
  
  const normalizedGameType = normalizeGameType(gameType);
  
  // Get all player identities
  const identityIds = (gameData.players || [])
    .filter(p => p.identityId)
    .map(p => p.identityId);
  
  if (identityIds.length === 0) {
    return [];
  }
  
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
      
      const identities = await PlayerIdentity.find({
        _id: { $in: identityIds },
        isDeleted: false
      });
      
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
        
        // Initialize eloByGameType map if needed
        if (!identity.eloByGameType) {
          identity.eloByGameType = new Map();
        }
        
        // Get or create ELO entry for this game type
        let gameTypeElo = identity.eloByGameType.get(normalizedGameType);
        if (!gameTypeElo) {
          gameTypeElo = {
            rating: CONFIG.DEFAULT_RATING,
            peak: CONFIG.DEFAULT_RATING,
            floor: CONFIG.DEFAULT_RATING,
            gamesPlayed: 0,
            streak: 0,
            lastUpdated: null,
            history: []
          };
        }
        
        // Update ELO fields
        gameTypeElo.rating = change.newRating;
        gameTypeElo.gamesPlayed = (gameTypeElo.gamesPlayed || 0) + 1;
        gameTypeElo.lastUpdated = new Date();
        
        // Update peak/floor
        if (change.newRating > (gameTypeElo.peak || CONFIG.DEFAULT_RATING)) {
          gameTypeElo.peak = change.newRating;
        }
        if (change.newRating < (gameTypeElo.floor || CONFIG.DEFAULT_RATING)) {
          gameTypeElo.floor = change.newRating;
        }
        
        // Update streak
        if (change.won) {
          gameTypeElo.streak = Math.max(1, (gameTypeElo.streak || 0) + 1);
        } else {
          gameTypeElo.streak = Math.min(-1, (gameTypeElo.streak || 0) - 1);
        }
        
        // Add to history (keep last 50 entries)
        if (!gameTypeElo.history) {
          gameTypeElo.history = [];
        }
        gameTypeElo.history.unshift({
          rating: change.newRating,
          change: change.change,
          gameId: game._id,
          opponents: change.opponents,
          placement: change.placement,
          date: game.gameData?.created_at ? new Date(game.gameData.created_at) : (game.createdAt || new Date())
        });
        
        if (gameTypeElo.history.length > 50) {
          gameTypeElo.history = gameTypeElo.history.slice(0, 50);
        }
        
        // Save back to map
        identity.eloByGameType.set(normalizedGameType, gameTypeElo);
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

/**
 * Recalculate ELO ratings for all players from scratch
 * Processes all finished games chronologically for all game types
 * 
 * @param {Object} options - Options for recalculation
 * @param {boolean} options.dryRun - If true, don't save changes
 * @param {string} options.gameType - If specified, only recalculate for this game type
 * @param {Function} options.onProgress - Progress callback (current, total)
 * @returns {Object} Summary of recalculation
 */
async function recalculateAllElo(options = {}) {
  const { dryRun = false, gameType = null, onProgress = null } = options;
  
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
  
  console.log('🎯 Starting ELO recalculation...');
  
  // Build identity merge map to consolidate linked/merged identities
  const mergeMap = await buildIdentityMergeMap();
  if (mergeMap.size > 0) {
    console.log(`✓ Built identity merge map: ${mergeMap.size} identities will be consolidated`);
  }
  
  // Reset all ELO ratings if not dry run
  if (!dryRun) {
    if (gameType) {
      // Reset only specific game type
      const normalizedType = normalizeGameType(gameType);
      console.log(`✓ Resetting ELO for game type: ${normalizedType}`);
      
      const identities = await PlayerIdentity.find({ isDeleted: false });
      for (const identity of identities) {
        if (identity.eloByGameType && identity.eloByGameType.has(normalizedType)) {
          identity.eloByGameType.delete(normalizedType);
          identity.markModified('eloByGameType');
          await identity.save();
        }
      }
    } else {
      // Reset all game types
      await PlayerIdentity.updateMany(
        { isDeleted: false },
        { $set: { eloByGameType: {} } }
      );
      console.log('✓ Reset all player ELO ratings');
    }
  }
  
  // Collect all games to process
  const allGames = [];
  
  // Get Wizard games
  const wizardGames = await WizardGame.find({
    'gameData.gameFinished': true
  }).lean();
  
  for (const game of wizardGames) {
    allGames.push({
      game,
      gameType: 'wizard',
      date: new Date(game.gameData?.created_at || game.createdAt || 0)
    });
  }
  
  // Get Table games
  if (TableGame) {
    const tableGames = await TableGame.find({
      $or: [
        { gameFinished: true },
        { 'gameData.gameFinished': true }
      ]
    }).lean();
    
    for (const game of tableGames) {
      // Table game type is stored in gameTypeName or gameData.gameType or game.gameType
      const tableGameType = game.gameTypeName || game.gameData?.gameType || game.gameType || 'table';
      allGames.push({
        game,
        gameType: normalizeGameType(tableGameType),
        date: new Date(game.gameData?.created_at || game.createdAt || 0)
      });
    }
  }
  
  // Sort all games chronologically
  allGames.sort((a, b) => a.date - b.date);
  
  // Filter by game type if specified
  const gamesToProcess = gameType 
    ? allGames.filter(g => g.gameType === normalizeGameType(gameType))
    : allGames;
  
  console.log(`📊 Processing ${gamesToProcess.length} finished games...`);
  
  let processed = 0;
  let playersUpdated = 0;
  const errors = [];
  const gameTypeCounts = {};
  
  for (const { game, gameType: gt } of gamesToProcess) {
    try {
      gameTypeCounts[gt] = (gameTypeCounts[gt] || 0) + 1;
      
      // Remap identity IDs for merged/linked players so they share one ELO
      const remappedGameData = remapGameIdentities(game.gameData, mergeMap);
      const remappedGame = { ...game, gameData: remappedGameData };
      
      if (!dryRun) {
        const updates = await updateRatingsForGame(remappedGame, gt);
        playersUpdated += updates.length;
      } else {
        // Dry run: just calculate
        const identityIds = (remappedGameData.players || [])
          .filter(p => p.identityId)
          .map(p => p.identityId);
        
        const identities = await PlayerIdentity.find({
          _id: { $in: identityIds },
          isDeleted: false
        });
        
        const identityMap = new Map(
          identities.map(i => [i._id.toString(), i])
        );
        
        const changes = calculateGameEloChanges(remappedGameData, identityMap, gt);
        playersUpdated += changes.length;
      }
      
      processed++;
      
      if (onProgress) {
        onProgress(processed, gamesToProcess.length);
      }
      
      if (processed % 100 === 0) {
        console.log(`   Progress: ${processed}/${gamesToProcess.length} (${((processed / gamesToProcess.length) * 100).toFixed(1)}%)`);
      }
    } catch (error) {
      errors.push({ gameId: game._id, gameType: gt, error: error.message });
    }
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
      winRate: item.identity.stats?.totalGames > 0 
        ? ((item.identity.stats.totalWins / item.identity.stats.totalGames) * 100).toFixed(1)
        : '0.0'
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
  calculateGameEloChanges,
  buildIdentityMergeMap,
  remapGameIdentities,
  updateRatingsForGame,
  recalculateAllElo,
  getEloRankings,
  getEloHistory,
  getAllEloForIdentity
};
