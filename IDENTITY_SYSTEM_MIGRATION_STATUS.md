# Identity System Migration Status

## Overview

The new PlayerIdentity system should replace all name-based player lookups with ID-based lookups. This document tracks what still needs to be updated.

## ✅ Completed

- ✅ PlayerIdentity model with userId linking
- ✅ Migration scripts to add identityId to all game players
- ✅ Player ID normalization (all use User._id)
- ✅ Admin Player Linking UI
- ✅ Identity linking API endpoints
- ✅ Automatic migrations on container startup

## 🔴 Critical - Needs Update

### 1. Friend Leaderboard H2H Statistics

**File**: `backend/routes/games.js` (lines 170-400)

**Current Behavior**:

```javascript
// Matches players by name
const resolvePlayerName = (playerName) => {
  const lowerName = playerName.toLowerCase();
  if (aliasToUsernameMap[lowerName]) {
    return aliasToUsernameMap[lowerName];
  }
  return lowerName;
};
```

**Should Be**:

```javascript
// Match by identity/user ID
const player = game.gameData.players.find(p => p.identityId);
const identity = await PlayerIdentity.findById(player.identityId);
const userId = identity.userId; // User._id
```

**Impact**:

- H2H stats might not show correctly if player name doesn't match username
- Stats won't consolidate for linked guest identities
- Can't track players who change their username

**Fix Priority**: HIGH - This is the main feature using player matching

---

### 2. SelectFriendsModal

**File**: `frontend/src/components/modals/SelectFriendsModal.jsx` (line 48)

**Current Behavior**:

```javascript
player.userId === friend.id || player.name === friend.username
```

**Should Be**:

```javascript
player.userId === friend.id
```

**Impact**: Falls back to name matching if userId isn't set

**Fix Priority**: MEDIUM - Fallback provides some safety

---

### 3. Game User Linkage

**File**: `backend/utils/gameUserLinkage.js`

**Current Behavior**:

- Called when new user registers
- Searches games by player name
- Links games retroactively

**Should Be**:

- Remove this utility entirely
- Identity linking is now handled by:
  1. Migration creates identities for all historical players
  2. `claimIdentitiesOnRegistration()` in identityService
  3. Admin can manually link via Player Linking UI

**Impact**: Duplicates identity system functionality

**Fix Priority**: MEDIUM - Not harmful but redundant

---

## 🟡 Legacy Systems - Can Deprecate

### 4. PlayerAlias System

**Files**:

- `backend/models/PlayerAlias.js`
- References in `routes/users.js`, `routes/tableGames.js`, `utils/gameUserLinkage.js`

**Current Use**:

- Stores alternative names for users
- Used for game linking

**Replaced By**:

- `PlayerIdentity.aliases` array
- `PlayerIdentity.linkedIdentities` array

**Migration Path**:

1. ✅ Already migrated data to PlayerIdentity during migration
2. ⏳ Remove code references to PlayerAlias
3. ⏳ Drop `playeraliases` collection

**Fix Priority**: LOW - Not actively causing issues

---

## ✅ Correct Usage (No Changes Needed)

### Registration Username Check

**File**: `backend/routes/users.js` (line 38)

```javascript
const existingUser = await User.findOne({ 
  username: { $regex: new RegExp(`^${escapedUsername}$`, 'i') }
});
```

**Status**: ✅ Correct - Need case-insensitive check for registration

### Migration Scripts

**Files**: `backend/scripts/*.js`
**Status**: ✅ Correct - Needed for historical data migration

---

## Recommended Action Plan

### Phase 1: High Priority (Now)

1. Update Friend Leaderboard H2H to use `player.identityId` → `PlayerIdentity.userId`
2. Test thoroughly with linked identities

### Phase 2: Medium Priority (Next Release)

1. Update SelectFriendsModal to only use userId
2. Mark gameUserLinkage.js as deprecated, add warning logs
3. Update any other components using name-based matching

### Phase 3: Cleanup (Future)

1. Remove gameUserLinkage.js entirely
2. Remove PlayerAlias model and all references
3. Drop legacy `playeraliases` collection
4. Drop legacy `games` collection (after migrating remaining 11 unique games)

---

## Testing Checklist

After implementing Phase 1:

- [ ] Friend leaderboard shows guest players correctly
- [ ] Linked guest identities appear in correct user's stats
- [ ] H2H matchups work between linked identities
- [ ] Username changes don't break existing stats
- [ ] Performance is acceptable (check query times)

---

## Notes

- All games should have `player.identityId` after migration
- All identities should have `userId` (either guest or real user)
- Games reference User._id consistently after normalize-player-ids migration
- `player.originalId` field preserves old IDs for debugging
