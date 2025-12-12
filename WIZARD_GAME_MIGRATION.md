# Wizard Game Format Migration Guide

## Overview

The wizard game format has been upgraded to version 3.0 with a cleaner, more efficient structure. This guide explains the migration system that automatically converts legacy games to the new format.

## Version History

### Version 1.0 (Legacy - format1.json)
- **Structure**: Nested `gameState` object containing all game data
- **Issues**: 
  - Redundant data duplication (both top level and gameState level)
  - Unnecessary fields (isVerified, totalScore, name in rounds)
  - Round metadata (round numbers, cards) in round_data
- **Example**: Games with `gameState` wrapper object

### Version 2.0 (Legacy - format2.json)
- **Structure**: Flatter structure with `player_ids` array
- **Issues**:
  - Still has redundant fields (isVerified, totalScore, name in rounds)
  - Round metadata (round numbers, cards) still present
  - Player names duplicated in round data
- **Example**: Games with `player_ids` array and `round`/`cards` in round_data

### Version 3.0 (Current - test.json)
- **Structure**: Clean, minimal, efficient
- **Features**:
  - `version` field for future compatibility
  - `isDealer`/`isCaller` instead of isVerified
  - No redundant data in rounds (no names, totalScores, round numbers)
  - Optional `call` field (omitted when undefined)
  - Winner as array (supports ties)
- **Benefits**: Smaller storage footprint, faster processing, clearer structure

## Format Comparison

### Players Array

**v1.0/v2.0:**
```json
{
  "id": "player123",
  "name": "Player Name",
  "isVerified": true
}
```

**v3.0:**
```json
{
  "id": "player123",
  "name": "Player Name",
  "isDealer": true,
  "isCaller": false
}
```

### Round Data

**v1.0/v2.0:**
```json
{
  "round": 1,
  "cards": 1,
  "players": [
    {
      "id": "player123",
      "name": "Player Name",
      "call": 1,
      "made": 1,
      "score": 30,
      "totalScore": 30
    }
  ]
}
```

**v3.0:**
```json
{
  "players": [
    {
      "id": "player123",
      "call": 1,
      "made": 1,
      "score": 30
    }
  ]
}
```

## Migration System

### Automatic Detection

The system automatically detects game format versions using these indicators:

1. **v1.0 Detection**: Presence of `gameState` object wrapper
2. **v2.0 Detection**: Presence of `player_ids` array + `round`/`cards` in round_data
3. **v3.0 Detection**: Presence of `isDealer`/`isCaller` + minimal round structure
4. **Unknown**: Games that don't match any pattern

### Migration Process

```javascript
const { migrateWizardGame } = require('./utils/wizardGameMigration');

// Automatically detects and migrates
const result = migrateWizardGame(legacyGameData);

// Returns:
{
  migrated: {...},        // Migrated game data in v3.0 format
  originalVersion: '1.0', // Detected original version
  needsMigration: true,   // Whether migration was needed
  error: null             // Any migration errors
}
```

### Migration Transformations

1. **Remove v1.0/v2.0 Fields**:
   - `isVerified` from players
   - `round`, `cards` from round_data
   - `totalScore`, `name` from player round data

2. **Add v3.0 Fields**:
   - `version: "3.0"` at top level
   - `isDealer: boolean` to each player
   - `isCaller: boolean` to each player

3. **Normalize Data**:
   - Convert `winner_id` string to array
   - Calculate `duration_seconds` if missing
   - Omit `call` field when undefined
   - Remove empty `final_scores` objects

## Database Collections

### Legacy Collection: `games`
- **Purpose**: Store original games for safety
- **Content**: Games in any format (v1.0, v2.0, v3.0)
- **Usage**: Read-only after migration

### New Collection: `wizard`
- **Purpose**: Store validated v3.0 games
- **Content**: Only v3.0 format games
- **Model**: `WizardGame` with strict validation
- **Features**: Migration metadata (originalVersion, migratedAt, originalGameId)

## API Endpoints

### Upload New Game (v3.0)
```http
POST /api/wizard-games
Authorization: Bearer {token}
Content-Type: application/json

{
  "localId": "game_123_abc",
  "gameData": {
    "version": "3.0",
    "created_at": "2025-12-12T10:00:00.000Z",
    "duration_seconds": 3600,
    "total_rounds": 15,
    "players": [...],
    "round_data": [...]
  }
}
```

### Migrate Legacy Games
```http
POST /api/wizard-games/migrate
Authorization: Bearer {token}
Content-Type: application/json

{
  "gameIds": ["gameId1", "gameId2"],  // Specific games
  // OR
  "migrateAll": true                   // All user games
}
```

### Get Migration Statistics
```http
GET /api/wizard-games/stats
Authorization: Bearer {token}

Response:
{
  "wizard": {
    "total": 100,
    "migrated": 75,
    "createdAsV3": 25
  },
  "legacy": {
    "total": 150,
    "notMigrated": 75
  },
  "migratedByVersion": {
    "1.0": 30,
    "2.0": 45
  }
}
```

## Validation

### Frontend Validation (Pre-Upload)

Strong validation happens before upload with detailed error messages:

```javascript
import { validateGameForUpload } from '@/shared/utils/wizardGameFormatter';

const validation = validateGameForUpload(gameData);

if (!validation.isValid) {
  // Show errors to user
  console.error(validation.errors);
}

if (validation.warnings.length > 0) {
  // Show warnings to user
  console.warn(validation.warnings);
}
```

**Validation Checks**:
- Version field presence and correctness
- Player count (2-6)
- Round count (1-60)
- Required fields (id, name, made, score)
- No duplicate player IDs
- Player IDs match across rounds
- winner_id references valid players
- final_scores references valid players
- Detects v1.0/v2.0 format remnants

### Backend Validation

Triple-layer validation on backend:

1. **Migration Validation**: Ensures migrated data is clean
2. **Schema Validation**: Validates against JSON schema
3. **Model Validation**: Mongoose model validation

## Usage Examples

### Frontend: Upload New Game

```javascript
import { createGame } from '@/shared/api/gameService';

try {
  const result = await createGame(gameData, localId);
  console.log('Game uploaded:', result);
} catch (error) {
  // Will show validation errors if game is invalid
  console.error('Upload failed:', error.message);
}
```

### Backend: Migrate Games

```javascript
const { migrateWizardGame } = require('./utils/wizardGameMigration');
const WizardGame = require('./models/WizardGame');

// Get legacy game
const legacyGame = await Game.findById(gameId);

// Migrate
const { migrated, originalVersion } = migrateWizardGame(legacyGame.gameData);

// Save to wizard collection
const wizardGame = new WizardGame({
  userId: legacyGame.userId,
  localId: legacyGame.localId,
  gameData: migrated,
  migratedFrom: originalVersion,
  migratedAt: new Date(),
  originalGameId: legacyGame._id
});

await wizardGame.save();
```

## Testing

Comprehensive test coverage (27 tests):

```bash
cd backend
npm test -- wizardGameMigration.test.js
```

**Test Coverage**:
- Format detection (v1.0, v2.0, v3.0, unknown)
- Migration from v1.0 to v3.0
- Migration from v2.0 to v3.0
- Field removal/addition verification
- Validation of migrated data
- Edge cases (missing fields, empty arrays, etc.)

## Best Practices

1. **Always validate before upload**: Use `validateGameForUpload()` in frontend
2. **Check warnings**: Even if valid, warnings indicate potential issues
3. **Migrate in batches**: Don't migrate all games at once in production
4. **Keep originals**: Legacy games remain in `games` collection for safety
5. **Monitor migration**: Check `/api/wizard-games/stats` regularly
6. **Test thoroughly**: Use test games before migrating real data

## Troubleshooting

### Migration Fails

**Problem**: Game won't migrate
**Solution**: Check validation errors, ensure game has minimum required data

### Unknown Format Detected

**Problem**: Format detector returns 'unknown'
**Solution**: Game may be corrupted or very old format - manual review needed

### Validation Errors After Migration

**Problem**: Migrated game fails validation
**Solution**: Check migration logic, report bug with game sample

## Files Modified

### Backend
- `backend/utils/wizardGameMigration.js` - Migration utility
- `backend/models/WizardGame.js` - New model for wizard collection
- `backend/routes/wizardGames.js` - New API endpoints
- `backend/schemas/wizardGameSchema.js` - Updated with version field
- `backend/server.js` - Added wizard games routes
- `backend/tests/wizardGameMigration.test.js` - Migration tests

### Frontend
- `frontend/src/shared/utils/wizardGameFormatter.js` - Enhanced validation + version
- `frontend/src/shared/api/gameService.js` - Updated upload to use wizard-games endpoint

## Migration Checklist

- [x] Format detection implemented (v1.0, v2.0, v3.0)
- [x] Migration utilities created
- [x] Version field added to schema
- [x] WizardGame model created
- [x] Separate 'wizard' collection configured
- [x] Migration endpoints created
- [x] Strong frontend validation added
- [x] Backend validation triple-layer
- [x] Comprehensive tests (27 passing)
- [x] Documentation complete
- [ ] User migration UI (future work)
- [ ] Bulk migration script (future work)

## Future Enhancements

1. **Migration UI**: User-friendly interface to migrate games
2. **Bulk Operations**: Admin tools to migrate all games
3. **Rollback**: Ability to restore from legacy if needed
4. **Analytics**: Track migration success rates
5. **Auto-migration**: Detect and migrate on first access
