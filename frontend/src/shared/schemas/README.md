# Improved Game Schema for Wizard Tracker

This document describes the new, improved game data schema designed to eliminate duplication, ensure consistency, and provide better validation and future compatibility.

## Overview

The new schema addresses several issues with the previous data structure:

1. **Eliminates duplication** - Single source of truth for all data
2. **Consistent naming** - Uses snake_case for JSON storage, camelCase for JavaScript
3. **Strong typing** - Proper data types throughout
4. **RFC 3339 timestamps** - Standardized date/time format
5. **Versioning** - Schema version and identifier for migration support
6. **Validation ready** - Structured for JSON Schema validation
7. **Event sourcing** - Separates source events from derived totals

## Schema Structure

### Core Schema Object

```javascript
{
  // Schema metadata
  "version": 1,
  "schema": "wizard-tracker@1",
  
  // Core identifiers  
  "id": "game_1754865120481193_abc123def",
  "name": "Finished Game - 2025-08-11",
  
  // Game configuration
  "mode": "local",           // "local" | "online" | "tournament"
  "status": "completed",     // "created" | "in_progress" | "paused" | "completed" | "abandoned"
  
  // Timestamps (RFC 3339 format)
  "created_at": "2025-08-10T22:32:05.068Z",
  "updated_at": "2025-08-10T22:32:15.634Z", 
  "started_at": "2025-08-10T22:32:05.068Z",
  "finished_at": "2025-08-10T22:32:15.634Z",
  "duration_seconds": 10,
  
  // Players array (source of truth)
  "players": [...],
  
  // Rounds array (source of truth for all game events)  
  "rounds": [...],
  
  // Derived totals (computed from rounds)
  "totals": {...},
  
  // Metadata
  "metadata": {...}
}
```

### Player Schema

```javascript
{
  "id": "player_1754865120481193_bailey",
  "name": "Bailey",
  "is_host": true,
  "seat_position": 0,        // Optional: 0-based seating
  "avatar": null             // Optional: avatar URL
}
```

### Round Schema

```javascript
{
  "number": 1,               // Round number (1-based)
  "cards": 1,                // Number of cards dealt
  "bids": {                  // Bids by player ID
    "player_id_1": 0,
    "player_id_2": 1
  },
  "tricks": {                // Tricks won by player ID
    "player_id_1": 1,
    "player_id_2": 0  
  },
  "points": {                // Points scored by player ID
    "player_id_1": 30,
    "player_id_2": -10
  }
}
```

### Totals Schema (Derived Data)

```javascript
{
  "final_scores": {          // Final scores by player ID
    "player_id_1": 50,
    "player_id_2": 30
  },
  "winner_id": "player_id_1", // ID of winning player
  "total_rounds": 3           // Total rounds played
}
```

### Metadata Schema

```javascript
{
  "is_local": true,          // Whether this is a local game
  "notes": null,             // Optional game notes
  "tags": ["casual"],        // Optional categorization tags
  "rules": null,             // Optional custom rules
  "seat_order": [...]        // Optional turn order by player ID
}
```

## Key Improvements

### 1. Single Source of Truth

**Before (with duplication):**

```javascript
{
  "gameState": {
    "final_scores": {"player1": 50},
    "winner_id": "player1"
  },
  "final_scores": {"player1": 50},    // Duplicate!
  "winner_id": "player1"              // Duplicate!
}
```

**After (no duplication):**

```javascript
{
  "rounds": [...],                    // Source data
  "totals": {
    "final_scores": {"player1": 50},  // Computed once
    "winner_id": "player1"
  }
}
```

### 2. Consistent Types

**Before (inconsistent):**

```javascript
{
  "id": true,                         // Boolean instead of string!
  "gameId": "123",                   // Sometimes string
  "player_ids": [true, false]        // Booleans instead of IDs!
}
```

**After (consistent):**

```javascript
{
  "id": "game_123_abc",              // Always string
  "players": [
    {"id": "player_456_def", ...}    // Always proper ID strings
  ]
}
```

### 3. Better Timestamps

**Before (inconsistent):**

```javascript
{
  "created_at": "2025-08-10T22:32:05.068Z",
  "savedAt": "2025-08-10 22:32:15",  // Different format!
  "lastPlayed": 1754865120481193     // Timestamp as number!
}
```

**After (RFC 3339 everywhere):**

```javascript
{
  "created_at": "2025-08-10T22:32:05.068Z",
  "updated_at": "2025-08-10T22:32:15.634Z",
  "started_at": "2025-08-10T22:32:05.068Z",
  "finished_at": "2025-08-10T22:32:15.634Z"
}
```

## Usage

### Creating a New Game

```javascript
import { createGameSchema, GameMode, GameStatus } from '@/shared/schemas/gameSchema';

const newGame = createGameSchema({
  name: "Friday Night Game",
  mode: GameMode.LOCAL,
  status: GameStatus.CREATED,
  players: [
    { id: "player1", name: "Alice", is_host: true },
    { id: "player2", name: "Bob", is_host: false }
  ]
});
```

### Validating Game Data

```javascript
import { validateGameSchema } from '@/shared/schemas/gameSchema';
import { validateWithJsonSchema } from '@/shared/schemas/gameJsonSchema';

// Custom validation
const validation1 = validateGameSchema(gameData);

// JSON Schema validation  
const validation2 = validateWithJsonSchema(gameData);

// Combined validation
import { validateGameData } from '@/shared/api/gameService';
const validation = validateGameData(gameData);
```

### Migrating Existing Games

```javascript
import { GameMigrationService } from '@/shared/utils/gameMigration';

// Check migration status
const stats = await GameMigrationService.getMigrationStats();

// Create backup before migration
const backup = GameMigrationService.createBackup();

// Migrate all games
const result = await GameMigrationService.migrateAllLocalGames(false);
```

### Working with Legacy Format

```javascript
import { migrateToNewSchema, toLegacyFormat } from '@/shared/schemas/gameSchema';

// Convert old format to new
const newGame = migrateToNewSchema(oldGameData);

// Convert new format back to legacy (for compatibility)
const legacyGame = toLegacyFormat(newGameData);
```

## JSON Schema Validation

The schema includes a full JSON Schema definition for validation:

```javascript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { GAME_JSON_SCHEMA } from '@/shared/schemas/gameJsonSchema';

const ajv = new Ajv();
addFormats(ajv);

const validate = ajv.compile(GAME_JSON_SCHEMA);
const isValid = validate(gameData);

if (!isValid) {
  console.debug('Validation errors:', validate.errors);
}
```

## Migration Path

1. **Backup existing data** using `GameMigrationService.createBackup()`
2. **Test migration** with `migrateAllLocalGames(true)` (dry run)
3. **Perform migration** with `migrateAllLocalGames(false)`
4. **Validate results** - all games should validate successfully

The migration process:

- Converts old nested structures to flat, consistent format
- Normalizes player and round data
- Computes derived totals from source data
- Maintains backward compatibility through legacy format conversion

## Future Benefits

1. **Easier analytics** - Consistent structure makes queries simpler
2. **Better performance** - Less data duplication, smaller payload
3. **Safer updates** - Validation prevents corrupt data
4. **Simpler debugging** - Single source of truth eliminates conflicts
5. **API compatibility** - Clean structure works well with REST/GraphQL
6. **Event sourcing** - Rounds array enables full game replay
7. **Migration support** - Versioning allows future schema changes

## Files

- `gameSchema.js` - Core schema functions and validation
- `gameJsonSchema.js` - JSON Schema definition
- `gameSchemaExamples.js` - Example data and comparisons  
- `gameMigration.js` - Migration utilities
- `GameSchemaMigration.jsx` - React component for UI migration

## References

- [JSON Schema Specification](https://json-schema.org/specification.html)
- [RFC 3339 Date/Time Format](https://tools.ietf.org/html/rfc3339)
- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
