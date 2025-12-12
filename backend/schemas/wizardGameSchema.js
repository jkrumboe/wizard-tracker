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
  
  // Validate winner_id if present
  if (gameData.winner_id) {
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
 * Normalizes winner_id to always be an array
 * @param {string|Array} winnerId - Winner ID(s)
 * @returns {Array} Array of winner IDs
 */
function normalizeWinnerId(winnerId) {
  if (!winnerId) return [];
  if (Array.isArray(winnerId)) return winnerId;
  return [winnerId];
}

module.exports = {
  WIZARD_GAME_SCHEMA,
  validateWizardGameData,
  normalizeWinnerId
};
