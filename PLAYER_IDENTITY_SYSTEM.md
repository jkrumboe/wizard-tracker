# Player Identity System

This document describes the enterprise-grade player identity management system that replaces the previous name-based alias approach.

## Overview

The Player Identity system provides a centralized way to manage player identities across all games. Instead of matching players by name strings, each player has a unique `PlayerIdentity` document that tracks their display name, aliases, and linked user account.

### Key Benefits

1. **Automatic Identity Claiming** - When a user registers, any existing guest identities matching their username are automatically claimed
2. **Name History Tracking** - All username changes are tracked for audit purposes
3. **Alias Support** - Multiple names can be associated with a single identity
4. **Foreign Key Relationships** - Games link to identities via `identityId` instead of name matching
5. **Statistics Caching** - Win/loss stats are cached on identities for fast lookups
6. **Admin Management** - Full CRUD operations for identity management

## Data Model

### PlayerIdentity Schema

```javascript
{
  displayName: String,        // Current display name
  normalizedName: String,     // Lowercase for matching
  userId: ObjectId,           // Linked user account (null for guests)
  type: 'user' | 'guest' | 'imported',
  nameHistory: [{
    name: String,
    normalizedName: String,
    changedAt: Date,
    changedBy: ObjectId
  }],
  aliases: [{
    name: String,
    normalizedName: String,
    addedAt: Date,
    addedBy: ObjectId
  }],
  stats: {
    totalGames: Number,
    totalWins: Number,
    lastGameAt: Date
  },
  isDeleted: Boolean,         // Soft delete support
  deletedAt: Date
}
```

### Game Player Reference

Games now store `identityId` alongside player names:

```javascript
{
  gameData: {
    players: [{
      id: "player_0",
      name: "John",
      identityId: ObjectId("...")  // New field
    }]
  }
}
```

## Automatic Behaviors

### On User Registration

When a new user registers:

1. System searches for guest identities matching the username
2. If found, the identity is claimed (linked to user, type changed to 'user')
3. If not found, a new identity is created
4. Legacy game linkage still runs for backward compatibility

### On Username Change

When a user changes their username:

1. The primary identity's `displayName` is updated
2. Old username is added to `nameHistory`
3. If new username matches an existing guest identity, it's merged
4. Legacy alias system still runs for backward compatibility

### On Game Save

When a WizardGame is saved:

1. Pre-save middleware checks each player
2. Players without `identityId` get one resolved via `findOrCreateByName`
3. New guest identities are created for unknown players

## API Endpoints

### User Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/identities/search?q=name` | Search identities |
| GET | `/api/identities/me` | Get current user's identities |
| GET | `/api/identities/:id` | Get identity details |
| POST | `/api/identities/:id/alias` | Add alias to identity |
| DELETE | `/api/identities/:id/alias/:name` | Remove alias |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/identities/admin/all` | List all identities |
| POST | `/api/identities/admin/assign` | Assign guest to user |
| POST | `/api/identities/admin/merge` | Merge identities |
| POST | `/api/identities/admin/split` | Split alias to new identity |
| POST | `/api/identities/admin/unlink/:id` | Unlink from user |
| DELETE | `/api/identities/admin/:id` | Soft delete identity |
| POST | `/api/identities/admin/:id/restore` | Restore deleted |
| POST | `/api/identities/admin/:id/recalculate` | Recalc stats |
| POST | `/api/identities/admin/recalculate-all` | Recalc all stats |

## Migration

### From Alias System

Run the migration script to convert from the old alias system:

```bash
# Preview changes (dry run)
node backend/scripts/migrate-to-identities.js --dry-run

# Run migration
node backend/scripts/migrate-to-identities.js

# With verbose logging
node backend/scripts/migrate-to-identities.js --verbose
```

The migration:
1. Converts all `PlayerAlias` records to `PlayerIdentity`
2. Creates identities for all registered users
3. Scans all games and creates guest identities for unknown players
4. Links games to identities via `identityId`
5. Calculates statistics for all identities

### Backward Compatibility

- The old `PlayerAlias` model and alias creation code is kept for backward compatibility
- Legacy game linkage (`gameUserLinkage.js`) still runs during registration
- Both systems operate in parallel during transition

## Service Functions

The `identityService.js` utility provides these functions:

### User Lifecycle

```javascript
// Called during registration
await identityService.claimIdentitiesOnRegistration(user);

// Called when username changes
await identityService.handleUsernameChange(user, oldName, newName);

// Called when account is deleted
await identityService.handleAccountDeletion(user, { deleteIdentities: false });
```

### Admin Operations

```javascript
// Assign guest identity to user
await identityService.adminAssignIdentity(identityId, userId, adminId);

// Merge multiple identities
await identityService.adminMergeIdentities(targetId, [sourceIds], adminId);

// Split alias into new identity
await identityService.adminSplitIdentity(identityId, aliasName, adminId);
```

### Game Integration

```javascript
// Resolve identities for new game players
const players = await identityService.resolvePlayerIdentities(players, createdBy);

// Update existing game with identity references
await identityService.updateGameIdentities(game);
```

### Statistics

```javascript
// Get aggregated stats for a user
const stats = await identityService.getUserStats(userId);

// Search identities
const results = await identityService.searchIdentities('john', { page: 1, limit: 20 });
```

## Frontend Integration

### Player Selection Component

When creating a game, use the identity search endpoint to let users pick players:

```javascript
// Search for players
const response = await fetch('/api/identities/search?q=john');
const { identities, pagination } = await response.json();

// Display with linked user info
identities.forEach(identity => {
  console.log(identity.displayName);
  if (identity.userId) {
    console.log('Linked to:', identity.userId.username);
  }
});
```

### User Profile

Show user's identities and stats:

```javascript
const response = await fetch('/api/identities/me');
const { identities, stats } = await response.json();

console.log('Total Games:', stats.totalGames);
console.log('Total Wins:', stats.totalWins);
console.log('Identities:', identities.length);
```

## Best Practices

1. **Always use identityId** - When querying games by player, use `identityId` not name
2. **Let the system handle it** - Identity resolution happens automatically on game save
3. **Use search for player selection** - Don't hardcode player names
4. **Merge duplicates** - Use admin merge when you find duplicate identities
5. **Keep aliases clean** - Remove unused aliases to prevent confusion

## Troubleshooting

### Identity not claimed on registration

Check if:
- The guest identity exists with exact name match (case-insensitive)
- The identity isn't already linked to another user

### Games not linked to identity

Run the migration script to backfill `identityId` on existing games:

```bash
node backend/scripts/migrate-to-identities.js
```

### Statistics out of date

Recalculate stats for all identities:

```bash
# Via API
POST /api/identities/admin/recalculate-all

# Or for single identity
POST /api/identities/admin/:id/recalculate
```
