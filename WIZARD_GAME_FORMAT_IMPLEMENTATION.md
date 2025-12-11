# Wizard Game Storage Format Implementation

## Summary
Successfully implemented and validated the new wizard game storage format that matches the structure shown in test.json.

## Changes Made

### 1. Backend Schema (backend/schemas/wizardGameSchema.js)
Created a comprehensive schema validator for wizard game data with:
- JSON Schema definition for game structure
- JavaScript validation function `validateWizardGameData()`
- Helper function `normalizeWinnerId()` to handle both string and array winner IDs
- Supports required fields: `created_at`, `duration_seconds`, `total_rounds`, `players`, `round_data`
- Supports optional fields: `winner_id`, `final_scores`
- Validates player count (2-6 players)
- Validates round data structure with required `id`, `made`, and `score` fields
- Optional `call` field in round data

### 2. Backend Routes Update (backend/routes/games.js)
Updated the POST /api/games endpoint to:
- Import and use `validateWizardGameData` function
- Validate incoming game data before saving
- Return clear validation errors if data is invalid
- Maintain backward compatibility with existing duplicate detection

### 3. Frontend Formatter (frontend/src/shared/utils/wizardGameFormatter.js)
Created utility functions to format game data before upload:
- `formatWizardGameForBackend()` - Converts internal game state to backend format
- `validateGameForUpload()` - Pre-validates game data before sending to backend
- Handles both wrapped (`gameState`) and unwrapped game data
- Converts `roundData` to `round_data`
- Normalizes `winner_id` to array format
- Calculates `duration_seconds` from timestamps if needed
- Uses `maxRounds`/`totalRounds` or round array length for `total_rounds`
- Omits `call` field if undefined in round data

### 4. Frontend API Update (frontend/src/shared/api/gameService.js)
Updated `createGame()` function to:
- Import and use `formatWizardGameForBackend()`
- Format game data before uploading
- Add debug logging to track formatting
- Improve error handling with detailed error messages

### 5. Tests

#### Backend Schema Tests (backend/tests/wizardGameSchema.test.js)
- 19 tests covering validation logic
- Tests for required fields
- Tests for player count limits
- Tests for round data validation
- Tests for winner_id formats
- Tests for optional fields
- All tests passing ✅

#### Backend Integration Tests (backend/tests/wizardGameIntegration.test.js)
- 9 comprehensive integration tests
- Tests full POST /api/games flow
- Tests validation at HTTP endpoint level
- Tests duplicate detection
- Tests error responses
- All tests passing ✅

## Game Data Format

### Structure
```json
{
  "created_at": "ISO 8601 timestamp",
  "duration_seconds": Number,
  "total_rounds": Number,
  "players": [
    {
      "id": "string",
      "name": "string",
      "isDealer": Boolean (optional),
      "isCaller": Boolean (optional)
    }
  ],
  "winner_id": "string" | ["string"],  // Single or array
  "final_scores": {
    "playerId": Number
  },
  "round_data": [
    {
      "players": [
        {
          "id": "string",
          "call": Number (optional),
          "made": Number,
          "score": Number
        }
      ]
    }
  ]
}
```

### Key Features
1. **Flat structure** - No nested gameData wrapper in the stored data
2. **Flexible winner_id** - Supports both string (single winner) and array (ties)
3. **Optional call field** - Allows rounds without bid tracking
4. **Strict validation** - Ensures data integrity at both client and server
5. **Backward compatible** - Existing duplicate detection still works

## Files Modified
1. `backend/schemas/wizardGameSchema.js` (new)
2. `backend/routes/games.js` (updated)
3. `frontend/src/shared/utils/wizardGameFormatter.js` (new)
4. `frontend/src/shared/api/gameService.js` (updated)
5. `backend/tests/wizardGameSchema.test.js` (new)
6. `backend/tests/wizardGameIntegration.test.js` (new)
7. `frontend/src/shared/utils/__tests__/wizardGameFormatter.test.js` (new - no test runner)

## Testing Status
✅ All backend tests passing (28 tests total)
✅ Schema validation working correctly
✅ Integration tests covering full upload flow
✅ Frontend formatter logic implemented (tests created but not run due to no test runner)

## Next Steps (Optional)
1. Add Vitest to frontend for running formatter tests
2. Add more edge case tests
3. Consider migration script for existing games
4. Update documentation for API consumers
5. Monitor production for any issues

## Verification
To verify the implementation works:
1. Run backend tests: `cd backend && npm test`
2. All 28 tests should pass
3. Upload a game through the UI and check MongoDB to see the new format
4. Check backend logs for validation success/failure messages
