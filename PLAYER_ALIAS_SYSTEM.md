# Player Name Linking (Player Aliases)

## Overview

The Player Alias system allows administrators to manually link old player names to registered user accounts, even when the names don't match exactly. This solves the problem where users register with a different name than they used while playing games.

## Use Case

**Example:** A player has been playing games as "Johnny" but registers their account as "JohnDoe". Since the names don't match, the automatic game linkage system won't connect their old games. An admin can now create an alias linking "Johnny" → "JohnDoe", and all games where "Johnny" played will be linked to the JohnDoe account.

## Features

### Admin Interface

The Player Linking page (`/admin/player-linking`) provides:

1. **Search for Player Names**: Search for existing player names in games to identify what names need to be linked
2. **Create Alias**: Link an old player name to a registered user account
3. **Automatic Game Linking**: Option to immediately link all matching games when creating an alias
4. **Manage Aliases**: View all existing aliases and delete them if needed

### Backend Implementation

#### PlayerAlias Model

Located: `backend/models/PlayerAlias.js`

```javascript
{
  userId: ObjectId,           // The registered user this alias belongs to
  aliasName: String,          // The player name (alias) used in games
  createdBy: ObjectId,        // Admin who created this alias
  notes: String,              // Optional notes about the mapping
  timestamps: true            // createdAt, updatedAt
}
```

#### API Endpoints

All endpoints require admin authentication (`role: 'admin'`).

**GET** `/api/users/admin/player-aliases`
- Get all player aliases with populated user information

**POST** `/api/users/admin/player-aliases`
- Create a new player alias
- Body: `{ aliasName, userId, notes, linkGamesNow }`
- Returns: Created alias and optional linkage results

**DELETE** `/api/users/admin/player-aliases/:aliasId`
- Delete a player alias
- Note: Does NOT unlink games that were already linked

**GET** `/api/users/admin/player-names?search=<term>`
- Search for player names in games (helps find names to link)
- Returns: Array of matching player names from all game types

### Game Linkage Integration

The game linkage utility (`backend/utils/gameUserLinkage.js`) has been updated to automatically check for player aliases when linking games:

1. When linking games for a user, the system fetches all aliases for that user
2. Games are searched for matches against both the username and all alias names
3. Games matching any name (username or alias) are linked to the user's account

This means:
- Aliases work retroactively for past games
- Aliases work automatically for new game linkage operations
- The "Link All User Games" admin feature includes alias matching

## Workflow

### Creating a Player Alias

1. **Navigate** to Admin Panel → Player Linking
2. **Search** for the player name in games (optional but recommended)
3. **Enter** the alias name (old player name from games)
4. **Select** the user to link to
5. **Add notes** if needed (e.g., "Player's old nickname")
6. **Choose** whether to link games immediately
7. **Create** the alias

### Linking Games

When "Link games immediately" is checked:
- All games with that player name are immediately linked to the user's account
- Returns statistics showing how many games were linked
- Games are updated across all game types (Game, WizardGame, TableGame)

When unchecked:
- The alias is created but games aren't linked yet
- Games will be linked the next time the user triggers manual linkage
- Or when an admin runs the "Link All User Games" operation

### Managing Aliases

- View all existing aliases with filters by user
- Search aliases by name or username
- Delete aliases that are no longer needed
- See who created each alias and when

## Important Notes

### Uniqueness
- Each alias name can only be linked to ONE user
- Attempting to create a duplicate alias will fail with an error
- An alias cannot be the same as the user's registered username

### Game Unlinking
- Deleting an alias does NOT unlink games that were already linked
- If you need to unlink games, you must do so manually in the database
- This is intentional to prevent accidental data loss

### Automatic Linkage
- New user registrations will check for aliases automatically
- The "Link User Games" admin feature includes alias checking
- The "Link All User Games" admin feature includes alias checking

## Technical Details

### Database Indexes

```javascript
// Unique index on alias name
{ aliasName: 1 } // unique: true

// Index for finding all aliases for a user
{ userId: 1 }

// Index for finding aliases by creator
{ createdBy: 1 }
```

### Security

- All alias management endpoints require admin role
- Input validation prevents injection attacks
- Username matching uses case-sensitive regex
- Special regex characters are escaped for safety

### Performance

- Alias lookups are indexed for fast retrieval
- Game searches use existing player name indexes
- Minimal performance impact on game linkage operations

## Example Scenarios

### Scenario 1: Nickname to Real Name
- Player played as "Beast" but registered as "BeastModeGamer"
- Admin creates alias: "Beast" → "BeastModeGamer"
- All games where "Beast" played are now linked to BeastModeGamer's account

### Scenario 2: Multiple Aliases
- Player used "Johnny", "John", and "J" in different games
- Admin creates three aliases all pointing to "JohnDoe"
- All games with any of those names are linked to JohnDoe's account

### Scenario 3: Name Change
- User played as "OldName" before registering
- User registers as "NewName"
- Admin creates alias: "OldName" → "NewName"
- User's game history is now complete

## Future Enhancements

Potential improvements:
1. **Bulk alias creation** - Upload CSV of name mappings
2. **Alias suggestions** - AI-powered suggestions based on name similarity
3. **User-requested aliases** - Let users submit alias requests for admin approval
4. **Alias history** - Track changes and deletions for audit purposes
5. **Merge preview** - Show preview of games that will be linked before creating alias
6. **Name replacement** - Option to replace old name with new name in game records

## API Reference

### Frontend Service Methods

```javascript
// userService methods
userService.getPlayerAliases()
userService.createPlayerAlias({ aliasName, userId, notes, linkGamesNow })
userService.deletePlayerAlias(aliasId)
userService.searchPlayerNames(searchTerm)
```

### Backend Functions

```javascript
// gameUserLinkage.js
linkGamesToNewUser(username, userId) // Now includes alias checking
findGamesByUsername(username)        // Does NOT check aliases (preview only)
```

## Migration Notes

No database migration required. The PlayerAlias collection will be created automatically when the first alias is added.

Existing game linkage continues to work normally. The alias system is purely additive and does not break existing functionality.
