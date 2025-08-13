/**
 * Improved Game Schema for Wizard Tracker
 * Based on best practices for JSON data design
 * 
 * Features:
 * - Single source of truth
 * - Consistent naming (snake_case for JSON, camelCase for JS)
 * - Strong typing
 * - Versioning support
 * - Validation ready
 * - Separation of events vs derived totals
 */

export const GAME_SCHEMA_VERSION = 1;
export const GAME_SCHEMA_NAME = "wizard-tracker@1";

/**
 * Game Status Enum
 */
export const GameStatus = {
  CREATED: "created",
  IN_PROGRESS: "in_progress", 
  PAUSED: "paused",
  COMPLETED: "completed",
  ABANDONED: "abandoned"
};

/**
 * Game Mode Enum
 */
export const GameMode = {
  LOCAL: "local",
  ONLINE: "online",
  TOURNAMENT: "tournament"
};

/**
 * Creates a new game schema object
 * @param {Object} gameData - Basic game information
 * @returns {Object} - Structured game object
 */
export function createGameSchema(gameData = {}) {
  const now = new Date().toISOString();
  
  return {
    // Schema metadata
    version: GAME_SCHEMA_VERSION,
    schema: GAME_SCHEMA_NAME,
    
    // Core identifiers
    id: gameData.id || generateGameId(),
    name: gameData.name || `Game - ${new Date().toLocaleDateString()}`,
    
    // Game configuration
    mode: gameData.mode || GameMode.LOCAL,
    status: gameData.status || GameStatus.CREATED,
    
    // Timestamps (RFC 3339 format)
    created_at: gameData.created_at || now,
    updated_at: gameData.updated_at || now,
    started_at: gameData.started_at || null,
    finished_at: gameData.finished_at || null,
    duration_seconds: gameData.duration_seconds || null,
    
    // Players array (source of truth)
    players: gameData.players || [],
    
    // Rounds array (source of truth for all game events)
    rounds: gameData.rounds || [],
    
    // Derived totals (computed from rounds)
    totals: {
      final_scores: gameData.final_scores || {},
      winner_id: gameData.winner_id || null,
      total_rounds: gameData.total_rounds || 0
    },
    
    // Metadata
    metadata: {
      is_local: gameData.mode === GameMode.LOCAL || gameData.is_local || true,
      notes: gameData.notes || null,
      tags: gameData.tags || [],
      rules: gameData.rules || null,
      seat_order: gameData.seat_order || null
    }
  };
}

/**
 * Creates a round schema object
 * @param {Object} roundData - Round information
 * @returns {Object} - Structured round object
 */
export function createRoundSchema(roundData = {}) {
  return {
    number: roundData.number || 1,
    cards: roundData.cards || 1,
    bids: roundData.bids || {},
    tricks: roundData.tricks || {},
    points: roundData.points || {}
  };
}

/**
 * Creates a player schema object
 * @param {Object} playerData - Player information
 * @returns {Object} - Structured player object
 */
export function createPlayerSchema(playerData = {}) {
  return {
    id: playerData.id || generatePlayerId(),
    name: playerData.name || "Unknown Player",
    is_host: playerData.is_host || false,
    seat_position: playerData.seat_position || null,
    avatar: playerData.avatar || null
  };
}

/**
 * Validates game schema structure
 * @param {Object} game - Game object to validate
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
export function validateGameSchema(game) {
  const errors = [];
  
  // Check version compatibility
  if (game.version !== GAME_SCHEMA_VERSION) {
    errors.push(`Unsupported schema version: ${game.version}`);
  }
  
  // Check required fields
  if (!game.id) errors.push("Missing required field: id");
  if (!game.name) errors.push("Missing required field: name");
  if (!game.created_at) errors.push("Missing required field: created_at");
  
  // Validate enums
  if (!Object.values(GameMode).includes(game.mode)) {
    errors.push(`Invalid game mode: ${game.mode}`);
  }
  
  if (!Object.values(GameStatus).includes(game.status)) {
    errors.push(`Invalid game status: ${game.status}`);
  }
  
  // Validate players
  if (!Array.isArray(game.players)) {
    errors.push("Players must be an array");
  } else if (game.players.length === 0) {
    errors.push("Game must have at least one player");
  } else {
    game.players.forEach((player, index) => {
      if (!player.id) errors.push(`Player ${index} missing id`);
      if (!player.name) errors.push(`Player ${index} missing name`);
    });
  }
  
  // Validate rounds
  if (!Array.isArray(game.rounds)) {
    errors.push("Rounds must be an array");
  } else {
    game.rounds.forEach((round, index) => {
      if (typeof round.number !== 'number') {
        errors.push(`Round ${index} missing or invalid number`);
      }
      if (typeof round.cards !== 'number') {
        errors.push(`Round ${index} missing or invalid cards`);
      }
      if (typeof round.bids !== 'object') {
        errors.push(`Round ${index} missing or invalid bids`);
      }
      if (typeof round.tricks !== 'object') {
        errors.push(`Round ${index} missing or invalid tricks`);
      }
      if (typeof round.points !== 'object') {
        errors.push(`Round ${index} missing or invalid points`);
      }
    });
  }
  
  // Validate timestamps are ISO strings
  const timestampFields = ['created_at', 'updated_at', 'started_at', 'finished_at'];
  timestampFields.forEach(field => {
    if (game[field] && !isValidISOString(game[field])) {
      errors.push(`Invalid timestamp format for ${field}`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Migrates old game format to new schema
 * @param {Object} oldGame - Old format game
 * @returns {Object} - New schema game
 */
export function migrateToNewSchema(oldGame) {
  // Handle different old formats
  const gameState = oldGame.gameState || oldGame;
  
  // Extract player data
  const players = (gameState.players || []).map(player => 
    createPlayerSchema({
      id: player.id,
      name: player.name,
      is_host: player.isHost || false
    })
  );
  
  // Convert round data
  const rounds = (gameState.roundData || gameState.round_data || []).map((round, index) => {
    const roundSchema = createRoundSchema({
      number: index + 1,
      cards: round.cards || index + 1
    });
    
    // Convert player round data to bids/tricks/points objects
    if (round.players) {
      round.players.forEach(playerRound => {
        roundSchema.bids[playerRound.id] = playerRound.bid || 0;
        roundSchema.tricks[playerRound.id] = playerRound.tricks || 0;
        roundSchema.points[playerRound.id] = playerRound.score || 0;
      });
    }
    
    return roundSchema;
  });
  
  // Determine status
  let status = GameStatus.CREATED;
  if (oldGame.isPaused || gameState.isPaused) {
    status = GameStatus.PAUSED;
  } else if (oldGame.gameFinished || gameState.gameFinished || oldGame.finished_at) {
    status = GameStatus.COMPLETED;
  } else if (gameState.gameStarted) {
    status = GameStatus.IN_PROGRESS;
  }
  
  // Create new schema
  return createGameSchema({
    id: oldGame.id || gameState.id,
    name: oldGame.name || `Migrated Game - ${new Date(oldGame.created_at || oldGame.savedAt || Date.now()).toLocaleDateString()}`,
    mode: GameMode.LOCAL,
    status,
    created_at: oldGame.created_at || oldGame.savedAt || new Date().toISOString(),
    updated_at: oldGame.lastPlayed || oldGame.updated_at || new Date().toISOString(),
    started_at: oldGame.started_at || (gameState.gameStarted ? oldGame.created_at : null),
    finished_at: oldGame.finished_at || (status === GameStatus.COMPLETED ? oldGame.lastPlayed : null),
    duration_seconds: oldGame.duration_seconds || gameState.duration_seconds,
    players,
    rounds,
    final_scores: oldGame.final_scores || gameState.final_scores || {},
    winner_id: oldGame.winner_id || gameState.winner_id,
    total_rounds: oldGame.total_rounds || gameState.maxRounds || rounds.length,
    is_local: true,
    notes: oldGame.notes,
    tags: oldGame.tags || []
  });
}

/**
 * Computes derived totals from rounds data
 * @param {Object} game - Game object
 * @returns {Object} - Updated game with computed totals
 */
export function computeDerivedTotals(game) {
  const finalScores = {};
  let winnerId = null;
  let highestScore = -Infinity;
  
  // Initialize scores for all players
  game.players.forEach(player => {
    finalScores[player.id] = 0;
  });
  
  // Calculate total scores from rounds
  game.rounds.forEach(round => {
    Object.entries(round.points).forEach(([playerId, points]) => {
      if (finalScores[playerId] !== undefined) {
        finalScores[playerId] += points;
      }
    });
  });
  
  // Find winner (highest score)
  Object.entries(finalScores).forEach(([playerId, score]) => {
    if (score > highestScore) {
      highestScore = score;
      winnerId = playerId;
    }
  });
  
  // Update game totals
  game.totals = {
    final_scores: finalScores,
    winner_id: winnerId,
    total_rounds: game.rounds.length
  };
  
  return game;
}

/**
 * Converts game schema to legacy format for backward compatibility
 * @param {Object} game - New schema game
 * @returns {Object} - Legacy format game
 */
export function toLegacyFormat(game) {
  // Convert rounds back to old roundData format
  const roundData = game.rounds.map(round => ({
    cards: round.cards,
    players: game.players.map(player => ({
      id: player.id,
      name: player.name,
      bid: round.bids[player.id] || 0,
      tricks: round.tricks[player.id] || 0,
      score: round.points[player.id] || 0
    }))
  }));
  
  return {
    id: game.id,
    name: game.name,
    gameState: {
      players: game.players,
      currentRound: game.rounds.length + (game.status === GameStatus.COMPLETED ? 0 : 1),
      maxRounds: game.totals.total_rounds,
      roundData,
      gameStarted: game.started_at !== null,
      gameFinished: game.status === GameStatus.COMPLETED,
      isPaused: game.status === GameStatus.PAUSED,
      mode: game.mode,
      isLocal: game.metadata.is_local,
      final_scores: game.totals.final_scores,
      winner_id: game.totals.winner_id,
      duration_seconds: game.duration_seconds
    },
    savedAt: game.updated_at,
    lastPlayed: game.updated_at,
    created_at: game.created_at,
    playerCount: game.players.length,
    roundsCompleted: game.rounds.length,
    totalRounds: game.totals.total_rounds,
    mode: game.mode,
    isPaused: game.status === GameStatus.PAUSED,
    gameFinished: game.status === GameStatus.COMPLETED,
    winner_id: game.totals.winner_id,
    final_scores: game.totals.final_scores,
    player_ids: game.players.map(p => p.id),
    round_data: roundData,
    total_rounds: game.totals.total_rounds,
    duration_seconds: game.duration_seconds,
    game_mode: game.mode,
    is_local: game.metadata.is_local
  };
}

// Utility functions
function generateGameId() {
  return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generatePlayerId() {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function isValidISOString(str) {
  try {
    return new Date(str).toISOString() === str;
  } catch {
    return false;
  }
}

export default {
  GAME_SCHEMA_VERSION,
  GAME_SCHEMA_NAME,
  GameStatus,
  GameMode,
  createGameSchema,
  createRoundSchema,
  createPlayerSchema,
  validateGameSchema,
  migrateToNewSchema,
  computeDerivedTotals,
  toLegacyFormat
};
