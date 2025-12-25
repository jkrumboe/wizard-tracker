/**
 * Wizard Game Schema for MongoDB Storage
 * This schema defines the structure for Wizard card game data
 * stored in the gameData field of the Game model.
 */

const WIZARD_GAME_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "Wizard Game Data Schema",
  description: "Schema for Wizard card game data (version 3.0)",
  type: "object",
  required: ["version", "created_at", "duration_seconds", "total_rounds", "players", "round_data"],
  properties: {
    version: {
      type: "string",
      const: "3.0",
      description: "Schema version - must be 3.0"
    },
    created_at: {
      type: "string",
      format: "date-time",
      description: "Timestamp when the game was created (ISO 8601 format)"
    },
    duration_seconds: {
      type: "number",
      minimum: 0,
      description: "Total duration of the game in seconds"
    },
    total_rounds: {
      type: "integer",
      minimum: 1,
      maximum: 60,
      description: "Total number of rounds played"
    },
    players: {
      type: "array",
      minItems: 2,
      maxItems: 10,
      description: "Array of players in the game (2-10 players)",
      items: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: {
            type: "string",
            description: "Unique identifier for the player"
          },
          name: {
            type: "string",
            minLength: 1,
            maxLength: 100,
            description: "Player's display name"
          },
          identityId: {
            type: "string",
            description: "Reference to PlayerIdentity document for user management"
          },
          isDealer: {
            type: "boolean",
            description: "Whether this player was the dealer"
          },
          isCaller: {
            type: "boolean",
            description: "Whether this player was the caller"
          }
        }
      }
    },
    winner_id: {
      oneOf: [
        {
          type: "array",
          items: { type: "string" },
          description: "Array of player IDs who won (for ties)"
        },
        {
          type: "string",
          description: "Single winner player ID"
        }
      ]
    },
    gameFinished: {
      type: "boolean",
      description: "Whether the game is finished or paused"
    },
    final_scores: {
      type: "object",
      description: "Final scores for each player, keyed by player ID",
      patternProperties: {
        "^[a-zA-Z0-9_-]+$": {
          type: "number",
          description: "Final score for this player"
        }
      }
    },
    round_data: {
      type: "array",
      minItems: 1,
      description: "Array of round data",
      items: {
        type: "object",
        required: ["players"],
        properties: {
          players: {
            type: "array",
            description: "Player data for this round",
            items: {
              type: "object",
              required: ["id", "made", "score"],
              properties: {
                id: {
                  type: "string",
                  description: "Player ID"
                },
                call: {
                  type: "integer",
                  minimum: 0,
                  description: "Number of tricks bid"
                },
                made: {
                  type: "integer",
                  minimum: 0,
                  description: "Number of tricks actually made"
                },
                score: {
                  type: "number",
                  description: "Score for this round"
                }
              }
            }
          }
        }
      }
    }
  }
};

/**
 * Validates wizard game data against the schema
 * @param {Object} gameData - The game data to validate
 * @returns {{isValid: boolean, errors: Array}} Validation result
 */
function validateWizardGameData(gameData) {
  const errors = [];
  
  if (!gameData || typeof gameData !== 'object') {
    errors.push('Game data must be an object');
    return { isValid: false, errors };
  }
  
  // Check required fields
  if (!gameData.created_at) errors.push('created_at is required');
  if (gameData.duration_seconds === undefined) errors.push('duration_seconds is required');
  if (!gameData.total_rounds) errors.push('total_rounds is required');
  if (!gameData.players) errors.push('players array is required');
  if (!gameData.round_data) errors.push('round_data array is required');
  
  // Validate players
  if (gameData.players) {
    if (!Array.isArray(gameData.players)) {
      errors.push('players must be an array');
    } else if (gameData.players.length < 2) {
      errors.push('At least 2 players required');
    } else if (gameData.players.length > 10) {
      errors.push('Maximum 10 players allowed');
    } else {
      gameData.players.forEach((player, idx) => {
        if (!player.id) errors.push(`Player ${idx}: id is required`);
        if (!player.name) errors.push(`Player ${idx}: name is required`);
      });
    }
  }
  
  // Validate round_data
  if (gameData.round_data) {
    if (!Array.isArray(gameData.round_data)) {
      errors.push('round_data must be an array');
    } else {
      gameData.round_data.forEach((round, roundIdx) => {
        if (!round.players || !Array.isArray(round.players)) {
          errors.push(`Round ${roundIdx}: players array is required`);
        } else {
          round.players.forEach((playerRound, pIdx) => {
            if (!playerRound.id) errors.push(`Round ${roundIdx}, Player ${pIdx}: id is required`);
            if (playerRound.made === undefined) errors.push(`Round ${roundIdx}, Player ${pIdx}: made is required`);
            if (playerRound.score === undefined) errors.push(`Round ${roundIdx}, Player ${pIdx}: score is required`);
          });
        }
      });
    }
  }
  
  // Validate final_scores if present
  if (gameData.final_scores && typeof gameData.final_scores !== 'object') {
    errors.push('final_scores must be an object');
  }
  
  // Validate winner_ids if present (array for handling ties)
  if (gameData.winner_ids) {
    if (!Array.isArray(gameData.winner_ids)) {
      errors.push('winner_ids must be an array of strings');
    } else if (!gameData.winner_ids.every(id => typeof id === 'string')) {
      errors.push('winner_ids must contain only strings');
    }
  }
  // Legacy support: also validate winner_id (singular) and convert to array
  if (gameData.winner_id && !gameData.winner_ids) {
    const isValidString = typeof gameData.winner_id === 'string';
    const isValidArray = Array.isArray(gameData.winner_id) && 
                        gameData.winner_id.every(id => typeof id === 'string');
    if (!isValidString && !isValidArray) {
      errors.push('winner_id must be a string or array of strings');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Normalizes winner_id/winner_ids to always be an array
 * @param {Object} gameData - Game data with winner_id or winner_ids
 * @returns {Array} Array of winner IDs
 */
function normalizeWinnerId(gameData) {
  // Prefer winner_ids (new format)
  if (gameData.winner_ids) {
    return Array.isArray(gameData.winner_ids) ? gameData.winner_ids : [gameData.winner_ids];
  }
  // Fallback to winner_id (legacy format)
  if (gameData.winner_id) {
    return Array.isArray(gameData.winner_id) ? gameData.winner_id : [gameData.winner_id];
  }
  return [];
}

module.exports = {
  WIZARD_GAME_SCHEMA,
  validateWizardGameData,
  normalizeWinnerId
};
