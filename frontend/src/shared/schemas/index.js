// Game Schema exports
export { default as gameSchema } from './gameSchema.js';
export { default as gameJsonSchema } from './gameJsonSchema.js';
export { default as gameSchemaExamples } from './gameSchemaExamples.js';

// Re-export commonly used functions and constants
export {
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
} from './gameSchema.js';

export {
  GAME_JSON_SCHEMA,
  validateWithJsonSchema
} from './gameJsonSchema.js';

export {
  EXAMPLE_GAME_NEW_SCHEMA,
  EXAMPLE_PAUSED_GAME_NEW_SCHEMA,
  COMPARISON_OLD_VS_NEW
} from './gameSchemaExamples.js';
