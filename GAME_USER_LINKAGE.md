# Game User Linkage System

## Overview

The game user linkage system automatically connects previously played games to newly registered users. When a player creates an account, any games where they played under that username are retroactively linked to their account.

## How It Works

### Automatic Linking on Registration

When a user registers with a username:

1. **Registration completes successfully** - The user account is created and authentication token is issued
2. **Background linkage starts** - The system searches for games containing that username
3. **Games are updated** - Matching games have their `userId` field updated to link to the new account
4. **Fail-safe operation** - If linkage fails, registration still succeeds

### What Gets Linked

The system searches across all game types:

- **Regular Games** (`Game` collection) - Standard wizard games
- **Wizard Games** (`WizardGame` collection) - v3.0 format wizard games  
- **Table Games** (`TableGame` collection) - Custom table-based games

### Matching Logic

Games are linked if:
- The game contains a player with a matching username (case-insensitive)
- The game is not already linked to the user
- The player name exactly matches the registered username

## Usage

### Automatic (Default Behavior)

No action needed - linkage happens automatically on user registration:

```javascript
// When user registers at /api/users/register
POST /api/users/register
{
  "username": "PlayerName",
  "password": "securepassword"
}

// Behind the scenes:
// 1. User account created
// 2. Games with player "PlayerName" are automatically linked
```

### Manual Linking

Users can manually trigger game linkage:

```javascript
// Authenticated request
POST /api/users/me/link-games
Authorization: Bearer <token>

// Response:
{
  "success": true,
  "message": "Successfully linked 5 game(s) to your account",
  "details": {
    "gamesLinked": 2,
    "wizardGamesLinked": 2,
    "tableGamesLinked": 1,
    "totalLinked": 5
  }
}
```

### Testing/Preview

Find games without linking them:

```javascript
const { findGamesByUsername } = require('./utils/gameUserLinkage');

const results = await findGamesByUsername('PlayerName');
console.log(results);
// {
//   games: [...],
//   wizardGames: [...],
//   tableGames: [...],
//   totalFound: 5
// }
```

## Implementation Details

### File Structure

```
backend/
├── utils/
│   └── gameUserLinkage.js        # Core linkage logic
├── routes/
│   └── users.js                  # Registration + manual endpoint
└── tests/
    └── testGameLinkage.js        # Test script
```

### Key Functions

#### `linkGamesToNewUser(username, userId)`

Main function that performs the linkage:

```javascript
const { linkGamesToNewUser } = require('./utils/gameUserLinkage');

const results = await linkGamesToNewUser('PlayerName', userId);
// Returns: { success, gamesLinked, wizardGamesLinked, tableGamesLinked, errors, details }
```

#### `findGamesByUsername(username)`

Search for games without modifying them:

```javascript
const { findGamesByUsername } = require('./utils/gameUserLinkage');

const games = await findGamesByUsername('PlayerName');
// Returns: { games, wizardGames, tableGames, totalFound }
```

### Error Handling

The system is designed to be fail-safe:

1. **Registration never fails** - Even if game linkage errors occur
2. **Detailed logging** - All operations are logged with emoji indicators
3. **Per-game error handling** - One game failing doesn't stop others
4. **Error reporting** - Results include detailed error information

### Database Operations

The linkage performs the following operations:

```javascript
// For each game type, finds games with matching player name
Game.find({ 'gameData.players': { $elemMatch: { name: /^username$/i } } })

// Updates the userId field
game.userId = userObjectId;
await game.save();
```

## Testing

### Prerequisites

Before running tests, ensure the Docker containers are running:

```bash
# Check if containers are running
docker ps

# Start containers if needed
docker compose up -d
```

### Running the Test Script

**Option 1: Inside Docker Container (Recommended)**
```bash
# Run test inside the backend container
docker compose exec backend node tests/testGameLinkage.js

# Or run the interactive demo that shows the feature in action
docker compose exec backend node tests/demoGameLinkage.js
```

**Option 2: Locally (requires MongoDB connection)**
```bash
# Set environment variable to connect to MongoDB
$env:MONGO_URI="mongodb://mongodb:27017/wizard-tracker"

# Run from project root
node backend/tests/testGameLinkage.js
```

The test script:
1. Searches for games with test username
2. Shows what would be linked
3. Tests linkage if user exists
4. Reports detailed results

The demo script (`demoGameLinkage.js`):
1. Creates sample games with a test player
2. Shows games are initially unlinked
3. Simulates user registration
4. Links games automatically
5. Verifies linkage worked
6. Cleans up test data

### Manual Testing Flow

1. **Create games without account**
   - Play games using a specific username (e.g., "TestPlayer")
   - Games stored with userId as string or random ID

2. **Register with that username**
   ```bash
   curl -X POST http://localhost:3000/api/users/register \
     -H "Content-Type: application/json" \
     -d '{"username":"TestPlayer","password":"password123"}'
   ```

3. **Verify linkage**
   - Check server logs for linkage messages
   - Fetch user's games to see previously played games

4. **Test manual linkage** (if needed)
   ```bash
   curl -X POST http://localhost:3000/api/users/me/link-games \
     -H "Authorization: Bearer <token>"
   ```

## Monitoring

### Log Messages

The system outputs detailed logs:

```
🔗 Starting game linkage for new user: PlayerName (ID: 507f1f77bcf86cd799439011)
📦 Found 3 regular games with player "PlayerName"
✅ Linked Game game-123 to user PlayerName
✅ Linked Game game-456 to user PlayerName
⏭️  Game game-789 already linked to user
📊 Game Linkage Summary for PlayerName:
   ✅ Regular Games: 2
   ✅ Wizard Games: 1
   ✅ Table Games: 1
   📈 Total Linked: 4
```

### Error Indicators

- `✅` - Successful operation
- `⏭️` - Skipped (already linked)
- `⚠️` - Warning (no matching player)
- `❌` - Error occurred

## Performance Considerations

- **Async execution** - Runs in background, doesn't block registration response
- **Batch queries** - Uses efficient MongoDB queries
- **Index usage** - Leverages existing indexes on `gameData.players.name`
- **Memory efficient** - Processes games one at a time

## Security

- **Case-insensitive matching** - Prevents duplicate accounts with different casing
- **Exact username match** - Won't link partial matches
- **User verification** - Only authenticated users can trigger manual linkage
- **No data loss** - Never deletes or modifies game data beyond userId field

## Future Enhancements

Potential improvements:

1. **Batch processing** - Link games for multiple users at once
2. **Migration script** - Retroactively link all existing games
3. **Admin endpoint** - Allow admins to manually link games for users
4. **Email notifications** - Notify users of linked games
5. **Statistics** - Track linkage success rates
6. **Fuzzy matching** - Handle minor username variations (optional)

## Troubleshooting

### Games Not Linking

1. **Check username match** - Must be exact (case-insensitive)
2. **Verify player names** - Check `gameData.players[].name` in database
3. **Check logs** - Look for error messages in server logs
4. **Run test script** - Use `testGameLinkage.js` to diagnose

### Manual Linkage Failed

1. **Check authentication** - Ensure valid JWT token
2. **Verify username** - User's current username is used
3. **Database connection** - Ensure MongoDB is accessible
4. **Check errors** - Response includes error details

## API Endpoints

### POST /api/users/register
Automatically links games during registration.

**Request:**
```json
{
  "username": "PlayerName",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "token": "jwt-token",
  "user": { ... }
}
```

### POST /api/users/me/link-games
Manually trigger game linkage for authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully linked 5 game(s) to your account",
  "details": {
    "gamesLinked": 2,
    "wizardGamesLinked": 2,
    "tableGamesLinked": 1,
    "totalLinked": 5,
    "errors": []
  }
}
```

### POST /api/users/admin/link-all-games
**Admin only** - Retroactively link games for all users.

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Processed 50 users, linked 123 games",
  "results": {
    "totalUsers": 50,
    "processed": 50,
    "successful": 48,
    "failed": 2,
    "totalGamesLinked": 123,
    "details": [...]
  }
}
```

### POST /api/users/admin/link-user-games/:userId
**Admin only** - Link games for a specific user.

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully linked 5 game(s) for user PlayerName",
  "details": {
    "username": "PlayerName",
    "gamesLinked": 2,
    "wizardGamesLinked": 2,
    "tableGamesLinked": 1,
    "totalLinked": 5
  }
}
```

## Admin Panel

Admins can access the **Game Linkage Management** page at `/admin/game-linkage` to:

- View information about the game linkage system
- Trigger retroactive linkage for all existing users
- See detailed results including:
  - Number of users processed
  - Total games linked
  - Success/failure counts
  - Per-user breakdown

**When to use:**
- After initial deployment to link existing users' games
- After data migration or bulk user import
- When troubleshooting linkage issues
- To ensure all historical games are properly linked

**How to access:**
1. Log in as an admin user
2. Navigate to Admin Panel
3. Click "Game Linkage" in the sidebar
4. Click "Link All User Games" button
5. Confirm the operation
6. Wait for results (may take several seconds to minutes)

The admin panel displays:
- Real-time progress
- Total statistics
- Detailed per-user results
- Error information if any failures occur

## Related Documentation

- [User Authentication](./SECURITY.md#authentication)
- [Game Data Models](../models/README.md)
- [API Documentation](./API_EXAMPLES.md)
