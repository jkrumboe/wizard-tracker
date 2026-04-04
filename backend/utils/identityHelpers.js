/**
 * Identity resolution helpers shared across routes.
 * Provides reusable logic for mapping player identities to user keys,
 * resolving merge chains, and building display name maps.
 */
const PlayerIdentity = require('../models/PlayerIdentity');
const User = require('../models/User');

/**
 * Build maps that resolve identity IDs to player keys and display names.
 * A "playerKey" is the userId (if linked) or the identityId (if guest).
 * Follows mergedInto chains to consolidate merged identities.
 *
 * @returns {Object} { identityToPlayerKeyMap, playerKeyIsGuest, userDisplayNames, userEloByGameType, identityMap }
 */
async function buildIdentityMaps() {
  const allUsers = await User.find({}).select('_id username role').lean();
  const userIdMap = {};
  allUsers.forEach(user => {
    userIdMap[user._id.toString()] = user;
  });

  const allIdentities = await PlayerIdentity.find({ isDeleted: false })
    .select('_id userId displayName eloByGameType mergedInto')
    .lean();

  const identityMap = new Map();
  allIdentities.forEach(identity => {
    identityMap.set(identity._id.toString(), identity);
  });

  const identityToPlayerKeyMap = {};
  const playerKeyIsGuest = {};
  const userDisplayNames = {};
  const userEloByGameType = {};

  // Resolve identity chain (follow mergedInto), with cycle detection
  const resolveIdentity = (identityIdStr, visited = new Set()) => {
    if (visited.has(identityIdStr)) return null;
    visited.add(identityIdStr);

    const identity = identityMap.get(identityIdStr);
    if (!identity) return null;

    if (identity.mergedInto) {
      const targetIdStr = identity.mergedInto.toString();
      const resolved = resolveIdentity(targetIdStr, visited);
      return resolved || identity;
    }

    return identity;
  };

  allIdentities.forEach(identity => {
    const identityIdStr = identity._id.toString();
    const finalIdentity = resolveIdentity(identityIdStr);
    if (!finalIdentity) return;

    const userIdStr = finalIdentity.userId?.toString();
    const playerKey = userIdStr || finalIdentity._id.toString();
    identityToPlayerKeyMap[identityIdStr] = playerKey;

    if (!userIdStr) {
      playerKeyIsGuest[playerKey] = true;
    }

    if (!userDisplayNames[playerKey]) {
      const user = userIdStr ? userIdMap[userIdStr] : null;
      userDisplayNames[playerKey] = user ? user.username : finalIdentity.displayName;
    }

    // Merge ELO data - keep the entry with more gamesPlayed per game type
    if (identity.eloByGameType && typeof identity.eloByGameType === 'object') {
      const existing = userEloByGameType[playerKey];
      if (!existing || typeof existing !== 'object') {
        userEloByGameType[playerKey] = identity.eloByGameType;
      } else {
        for (const [gt, eloData] of Object.entries(identity.eloByGameType)) {
          const existingData = existing[gt];
          if (!existingData || (eloData?.gamesPlayed || 0) > (existingData?.gamesPlayed || 0)) {
            existing[gt] = eloData;
          }
        }
      }
    }
  });

  return {
    identityToPlayerKeyMap,
    playerKeyIsGuest,
    userDisplayNames,
    userEloByGameType,
    identityMap,
    allUsers,
    userIdMap,
  };
}

/**
 * Get all identity IDs for a user, including merged guest identities.
 *
 * @param {string} userId - The user's ObjectId
 * @returns {Object} { identities, mergedGuestIdentities, allIdentityIds, gameEloMap }
 */
async function getUserIdentityIds(userId) {
  const identities = await PlayerIdentity.find({ userId, isDeleted: false })
    .select('_id displayName eloByGameType')
    .lean();

  const identityIds = identities.map(id => id._id);

  const mergedGuestIdentities = await PlayerIdentity.find({
    mergedInto: { $in: identityIds }
  }).select('_id displayName eloByGameType').lean();

  const allIdentityIds = [...identityIds, ...mergedGuestIdentities.map(id => id._id)];

  // Build gameId -> eloChange map from all identities' ELO history
  const gameEloMap = new Map();
  [...identities, ...mergedGuestIdentities].forEach(identity => {
    if (identity.eloByGameType) {
      for (const [gameType, eloData] of Object.entries(identity.eloByGameType)) {
        if (eloData.history && Array.isArray(eloData.history)) {
          eloData.history.forEach(entry => {
            if (entry.gameId) {
              gameEloMap.set(entry.gameId.toString(), {
                change: entry.change,
                rating: entry.rating,
                placement: entry.placement,
                gameType,
              });
            }
          });
        }
      }
    }
  });

  return { identities, mergedGuestIdentities, allIdentityIds, gameEloMap };
}

module.exports = {
  buildIdentityMaps,
  getUserIdentityIds,
};
