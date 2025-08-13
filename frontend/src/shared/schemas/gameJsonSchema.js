/**
 * JSON Schema Definition for Wizard Tracker Game Data
 * Implements JSON Schema Draft 2020-12
 * Use with libraries like Ajv for validation
 */

export const GAME_JSON_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://wizard-tracker.app/schemas/game.json",
  "title": "Wizard Tracker Game",
  "description": "A complete Wizard card game record",
  "type": "object",
  "required": ["version", "schema", "id", "name", "mode", "status", "created_at", "updated_at", "players", "rounds", "totals", "metadata"],
  "properties": {
    "version": {
      "type": "integer",
      "const": 1,
      "description": "Schema version number"
    },
    "schema": {
      "type": "string",
      "const": "wizard-tracker@1",
      "description": "Schema identifier"
    },
    "id": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9_-]+$",
      "minLength": 1,
      "maxLength": 100,
      "description": "Unique game identifier"
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100,
      "description": "Human-readable game name"
    },
    "mode": {
      "type": "string",
      "enum": ["local", "online", "tournament"],
      "description": "Game mode"
    },
    "status": {
      "type": "string",
      "enum": ["created", "in_progress", "paused", "completed", "abandoned"],
      "description": "Current game status"
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "description": "Game creation timestamp (RFC 3339)"
    },
    "updated_at": {
      "type": "string",
      "format": "date-time",
      "description": "Last update timestamp (RFC 3339)"
    },
    "started_at": {
      "type": ["string", "null"],
      "format": "date-time",
      "description": "Game start timestamp (RFC 3339)"
    },
    "finished_at": {
      "type": ["string", "null"],
      "format": "date-time",
      "description": "Game finish timestamp (RFC 3339)"
    },
    "duration_seconds": {
      "type": ["integer", "null"],
      "minimum": 0,
      "maximum": 86400,
      "description": "Game duration in seconds"
    },
    "players": {
      "type": "array",
      "minItems": 1,
      "maxItems": 20,
      "items": {
        "$ref": "#/$defs/player"
      },
      "description": "Array of players in the game"
    },
    "rounds": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/round"
      },
      "description": "Array of completed rounds"
    },
    "totals": {
      "type": "object",
      "required": ["final_scores", "winner_id", "total_rounds"],
      "properties": {
        "final_scores": {
          "type": "object",
          "patternProperties": {
            "^[a-zA-Z0-9_-]+$": {
              "type": "integer",
              "minimum": -1000000,
              "maximum": 1000000
            }
          },
          "additionalProperties": false,
          "description": "Final scores by player ID"
        },
        "winner_id": {
          "type": ["string", "null"],
          "pattern": "^[a-zA-Z0-9_-]+$",
          "description": "ID of the winning player"
        },
        "total_rounds": {
          "type": "integer",
          "minimum": 0,
          "maximum": 1000,
          "description": "Total number of rounds in the game"
        }
      },
      "additionalProperties": false
    },
    "metadata": {
      "type": "object",
      "required": ["is_local"],
      "properties": {
        "is_local": {
          "type": "boolean",
          "description": "Whether this is a local game"
        },
        "notes": {
          "type": ["string", "null"],
          "maxLength": 1000,
          "description": "Optional game notes"
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string",
            "maxLength": 50
          },
          "maxItems": 10,
          "description": "Game tags for categorization"
        },
        "rules": {
          "type": ["object", "null"],
          "description": "Custom rule configurations"
        },
        "seat_order": {
          "type": ["array", "null"],
          "items": {
            "type": "string",
            "pattern": "^[a-zA-Z0-9_-]+$"
          },
          "description": "Turn order by player ID"
        }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false,
  "$defs": {
    "player": {
      "type": "object",
      "required": ["id", "name", "is_host"],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-zA-Z0-9_-]+$",
          "minLength": 1,
          "maxLength": 100,
          "description": "Unique player identifier"
        },
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 50,
          "description": "Player display name"
        },
        "is_host": {
          "type": "boolean",
          "description": "Whether this player is the game host"
        },
        "seat_position": {
          "type": ["integer", "null"],
          "minimum": 0,
          "maximum": 19,
          "description": "Player's seat position (0-based)"
        },
        "avatar": {
          "type": ["string", "null"],
          "format": "uri",
          "description": "Player avatar URL"
        }
      },
      "additionalProperties": false
    },
    "round": {
      "type": "object",
      "required": ["number", "cards", "bids", "tricks", "points"],
      "properties": {
        "number": {
          "type": "integer",
          "minimum": 1,
          "maximum": 1000,
          "description": "Round number (1-based)"
        },
        "cards": {
          "type": "integer",
          "minimum": 1,
          "maximum": 60,
          "description": "Number of cards dealt this round"
        },
        "bids": {
          "type": "object",
          "patternProperties": {
            "^[a-zA-Z0-9_-]+$": {
              "type": "integer",
              "minimum": 0,
              "maximum": 60
            }
          },
          "additionalProperties": false,
          "description": "Bids by player ID"
        },
        "tricks": {
          "type": "object",
          "patternProperties": {
            "^[a-zA-Z0-9_-]+$": {
              "type": "integer",
              "minimum": 0,
              "maximum": 60
            }
          },
          "additionalProperties": false,
          "description": "Tricks won by player ID"
        },
        "points": {
          "type": "object",
          "patternProperties": {
            "^[a-zA-Z0-9_-]+$": {
              "type": "integer",
              "minimum": -1000,
              "maximum": 1000
            }
          },
          "additionalProperties": false,
          "description": "Points scored by player ID"
        }
      },
      "additionalProperties": false
    }
  }
};

/**
 * Validates a game object against the JSON schema
 * Note: This is a basic validation. For full JSON Schema validation,
 * use a library like Ajv with the GAME_JSON_SCHEMA
 */
export function validateWithJsonSchema(gameData) {
  // Basic structural validation
  const errors = [];
  
  // Check required top-level fields
  const requiredFields = ['version', 'schema', 'id', 'name', 'mode', 'status', 'created_at', 'updated_at', 'players', 'rounds', 'totals', 'metadata'];
  requiredFields.forEach(field => {
    if (!(field in gameData)) {
      errors.push(`Missing required field: ${field}`);
    }
  });
  
  // Validate version and schema
  if (gameData.version !== 1) {
    errors.push(`Invalid version: expected 1, got ${gameData.version}`);
  }
  
  if (gameData.schema !== 'wizard-tracker@1') {
    errors.push(`Invalid schema: expected 'wizard-tracker@1', got ${gameData.schema}`);
  }
  
  // Validate enums
  const validModes = ['local', 'online', 'tournament'];
  if (!validModes.includes(gameData.mode)) {
    errors.push(`Invalid mode: ${gameData.mode}`);
  }
  
  const validStatuses = ['created', 'in_progress', 'paused', 'completed', 'abandoned'];
  if (!validStatuses.includes(gameData.status)) {
    errors.push(`Invalid status: ${gameData.status}`);
  }
  
  // Validate players array
  if (!Array.isArray(gameData.players)) {
    errors.push('Players must be an array');
  } else {
    if (gameData.players.length === 0) {
      errors.push('At least one player is required');
    }
    
    gameData.players.forEach((player, index) => {
      if (!player.id) errors.push(`Player ${index} missing id`);
      if (!player.name) errors.push(`Player ${index} missing name`);
      if (typeof player.is_host !== 'boolean') errors.push(`Player ${index} missing or invalid is_host`);
    });
  }
  
  // Validate rounds array
  if (!Array.isArray(gameData.rounds)) {
    errors.push('Rounds must be an array');
  } else {
    gameData.rounds.forEach((round, index) => {
      if (typeof round.number !== 'number') errors.push(`Round ${index} missing number`);
      if (typeof round.cards !== 'number') errors.push(`Round ${index} missing cards`);
      if (typeof round.bids !== 'object') errors.push(`Round ${index} missing bids object`);
      if (typeof round.tricks !== 'object') errors.push(`Round ${index} missing tricks object`);
      if (typeof round.points !== 'object') errors.push(`Round ${index} missing points object`);
    });
  }
  
  // Validate totals
  if (!gameData.totals) {
    errors.push('Missing totals object');
  } else {
    if (typeof gameData.totals.final_scores !== 'object') {
      errors.push('Totals missing final_scores object');
    }
    if (typeof gameData.totals.total_rounds !== 'number') {
      errors.push('Totals missing total_rounds number');
    }
  }
  
  // Validate metadata
  if (!gameData.metadata) {
    errors.push('Missing metadata object');
  } else {
    if (typeof gameData.metadata.is_local !== 'boolean') {
      errors.push('Metadata missing is_local boolean');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export default {
  GAME_JSON_SCHEMA,
  validateWithJsonSchema
};
