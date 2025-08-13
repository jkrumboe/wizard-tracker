# Appwrite Game Upload Service

This service provides production-quality upload functionality for Wizard Tracker games to a self-hosted Appwrite instance.

## Features

- ✅ **Type-safe TypeScript implementation** with comprehensive types
- ✅ **Idempotent uploads** - safe to run multiple times
- ✅ **Robust error handling** with exponential backoff retry logic
- ✅ **Concurrency control** for batch operations (rounds/players)
- ✅ **Comprehensive validation** of game data before upload
- ✅ **Environment-based configuration**
- ✅ **Zero ESLint errors** and Node 18+ compatible

## Schema Requirements

Your Appwrite database should have these collections with the specified attributes:

### `players` Collection

- `extId`: string(32, unique) - External player ID from local game
- `name`: string(64) - Player display name  
- `userId`: string(36, optional) - Link to user account

### `games` Collection

- `extId`: string(64, unique) - External game ID from local game
- `playerIds`: string[] - Array of Appwrite player document IDs
- `winnerPlayerId`: string(36, optional) - Appwrite player ID of winner
- `finalScoresJson`: string(8192) - JSON string of final scores by player ID
- `totalRounds`: integer - Total number of rounds played
- `gameMode`: enum - Game mode (Local, Online, Tournament)
- `durationSeconds`: integer - Game duration in seconds

### `rounds` Collection

- `gameId`: string(36) - Appwrite game document ID
- `roundNumber`: integer - Round number (1-based)
- `cards`: integer - Number of cards dealt this round

### `roundPlayers` Collection

- `gameId`: string(36) - Appwrite game document ID  
- `roundNumber`: integer - Round number (1-based)
- `playerId`: string(36) - Appwrite player document ID
- `call`: integer - Player's bid/call for this round
- `made`: integer - Tricks actually made by player
- `score`: integer - Points scored this round
- `totalScore`: integer - Cumulative score through this round

## Setup

### Your Current Appwrite Database

**Production Database ID**: `688cfb4b002d001bc2e5`

**Available Collections**:

- `games` - Game sessions and metadata
- `players` - Player profiles and statistics  
- `rounds` - Individual round data
- `roundPlayers` - Player performance per round
- `online` - Online session management

**Environment Configuration for Your Setup**:

```bash
DB_ID=688cfb4b002d001bc2e5
COL_PLAYERS=players
COL_GAMES=games
COL_ROUNDS=rounds
COL_ROUND_PLAYERS=roundPlayers
```

### Installation Steps

1. **Install dependencies:**

   ```bash
   npm install node-appwrite p-limit
   npm install -D @types/node typescript
   ```

2. **Configure environment:**

   ```bash
   cp .env.appwrite.example .env
   # Edit .env with your Appwrite details and the database ID above
   ```

3. **Verify collections** match the schema requirements below

4. **Set up indexes:**
   - `players.extId` - unique index for fast lookups
   - `games.extId` - unique index for fast lookups
   - `games.playerIds` - array index for participation queries

## Usage

### Basic Upload

```typescript
import { uploadLocalGame } from './appwriteGameUpload';

const localGame = {
  id: "game_123",
  players: [
    { id: "player_1", name: "Alice" },
    { id: "player_2", name: "Bob" }
  ],
  winner_id: "player_1",
  final_scores: { "player_1": 50, "player_2": 30 },
  round_data: [
    {
      round: 1,
      cards: 1,
      players: [
        { id: "player_1", call: 1, made: 1, score: 30, totalScore: 30 },
        { id: "player_2", call: 0, made: 0, score: 20, totalScore: 20 }
      ]
    }
  ],
  total_rounds: 1,
  created_at: "2025-08-11T10:00:00Z",
  game_mode: "Local",
  duration_seconds: 300
};

// Upload the game
await uploadLocalGame(localGame);
```

### Advanced Usage

```typescript
import { AppwriteGameUploader, createUploaderFromEnv } from './appwriteGameUpload';

// Create uploader with custom config
const uploader = new AppwriteGameUploader({
  endpoint: 'https://your-appwrite.com/v1',
  projectId: 'your-project',
  apiKey: 'your-api-key',
  databaseId: '688cfb4b002d001bc2e5',
  collections: {
    players: 'players',
    games: 'games', 
    rounds: 'rounds',
    roundPlayers: 'roundPlayers'
  }
});

// Upload with options
await uploader.uploadLocalGame(localGame, {
  replaceExisting: false,
  concurrency: 10
});
```

### Command Line Usage

```bash
# Set environment variables (using your production database)
export APPWRITE_ENDPOINT=https://your-appwrite.com/v1
export APPWRITE_PROJECT_ID=your-project-id
export APPWRITE_API_KEY=your-api-key
export DB_ID=688cfb4b002d001bc2e5
export COL_PLAYERS=players
export COL_GAMES=games  
export COL_ROUNDS=rounds
export COL_ROUND_PLAYERS=roundPlayers

# Upload a game from JSON file
node dist/appwriteGameUpload.js /path/to/game.json
```

## Integration with Wizard Tracker

The service integrates with the existing Wizard Tracker codebase:

```javascript
import { uploadLocalGameToAppwrite, convertToAppwriteFormat } from './gameService';

// Convert and upload a local game
const result = await uploadLocalGameToAppwrite('local-game-id');

// Just convert without uploading  
const localGame = LocalGameStorage.loadGame('game-id');
const appwriteFormat = convertToAppwriteFormat(localGame);
```

## Error Handling

The service includes comprehensive error handling:

- **Validation errors** - Invalid game data structure
- **Network errors** - Automatic retry with exponential backoff  
- **Duplicate errors** - Idempotent operations prevent duplicates
- **Configuration errors** - Missing environment variables

## Performance

- **Concurrent uploads** - Configurable concurrency for round players
- **Batch operations** - Efficient bulk creation of related documents
- **Query optimization** - Uses indexed fields for fast lookups
- **Memory efficient** - Streams large datasets without loading everything

## Security

- **Input validation** - Comprehensive validation of all input data
- **SQL injection prevention** - Uses Appwrite's query builder
- **Rate limiting** - Configurable concurrency to respect API limits
- **Error sanitization** - No sensitive data in error messages

## Monitoring

The service logs all operations:

```text
Starting upload for game: game_123
Upserting 4 players...
Found existing player: Alice (player_1)
Creating new player: Bob (player_2)
Player mapping complete: 4 players mapped
Creating game document for: game_123
Created game document with ID: 64f8a9b2c1d4e5f6a7b8c9d0
Creating 3 rounds...
Creating round players with concurrency 5...
Game upload complete:
  - Game ID: 64f8a9b2c1d4e5f6a7b8c9d0
  - Rounds created: 3
  - Round players created: 12
Successfully uploaded game: game_123
```

## Troubleshooting

### Common Issues

1. **"Cannot find module 'node-appwrite'"**
   - Run `npm install node-appwrite`

2. **"Missing required environment variables"**
   - Check your `.env` file has all required variables
   - Verify variable names match exactly

3. **"Game already exists"**
   - Set `replaceExisting: true` option (not yet implemented)
   - Or check for duplicates in your Appwrite console

4. **Rate limiting errors**
   - Reduce concurrency setting
   - Add delays between batch uploads

### Debug Mode

Set `NODE_ENV=development` for verbose logging:

```bash
NODE_ENV=development node dist/appwriteGameUpload.js game.json
```

## Files

- `appwriteGameUpload.ts` - Main upload service
- `appwrite-upload-package.json` - Dependencies for upload service
- `appwrite-tsconfig.json` - TypeScript configuration
- `.env.appwrite.example` - Environment template
- Integration in `gameService.js` for format conversion

## Next Steps

1. Install dependencies and configure environment
2. Set up Appwrite collections with proper schema
3. Test with a sample game upload
4. Integrate into your application workflow
5. Set up monitoring and alerting for production use
