const mongoose = require('mongoose');
const PlayerIdentity = require('../models/PlayerIdentity');

/**
 * Identity Service
 * 
 * Central service for managing player identities with automatic
 * claim, merge, and update functionality.
 * 
 * Handles:
 * - Automatic identity claiming on user registration
 * - Username changes propagating to identities
 * - Account deletion handling
 * - Admin identity management (assign, merge, split)
 */

// ============================================
// User Registration & Identity Claiming
// ============================================

/**
 * Claim identities when a user registers
 * Automatically links any guest identities matching the username
 * Uses atomic operations to prevent race conditions
 * 
 * @param {Object} user - The newly registered user
 * @returns {Object} Result with claimed identity count
 */
async function claimIdentitiesOnRegistration(user) {
  const result = {
    claimed: [],
    created: null,
    errors: []
  };
  
  try {
    const username = user.username;
    const userId = user._id;
    const normalizedName = username.toLowerCase().trim();
    
    // Use atomic findOneAndUpdate to prevent race conditions
    // Try to claim an existing guest identity first
    const claimedIdentity = await PlayerIdentity.findOneAndUpdate(
      {
        normalizedName: normalizedName,
        userId: null,  // Only claim unclaimed identities
        type: 'guest',
        isDeleted: false
      },
      {
        $set: {
          userId: userId,
          type: 'user',
          updatedAt: new Date()
        }
      },
      { new: true }
    );
    
    if (claimedIdentity) {
      result.claimed.push(claimedIdentity._id);
      console.log(`[IdentityService] Claimed identity "${username}" for user ${userId}`);
    } else {
      // No guest identity found - try to create a new one atomically
      // Use findOneAndUpdate with upsert to prevent duplicate creation
      try {
        const newIdentity = await PlayerIdentity.findOneAndUpdate(
          {
            userId: userId,  // Find existing identity for this user
            isDeleted: false
          },
          {
            $setOnInsert: {
              displayName: username,
              normalizedName: normalizedName,
              userId: userId,
              type: 'user',
              createdBy: userId,
              createdAt: new Date()
            },
            $set: {
              updatedAt: new Date()
            }
          },
          { 
            new: true, 
            upsert: true,
            setDefaultsOnInsert: true
          }
        );
        
        // Check if this was a new creation or existing
        if (newIdentity.displayName === username) {
          result.created = newIdentity;
          console.log(`[IdentityService] Created new identity "${username}" for user ${userId}`);
        } else {
          // User already has an identity (race condition caught)
          console.log(`[IdentityService] User ${userId} already has identity "${newIdentity.displayName}"`);
          result.claimed.push(newIdentity._id);
        }
      } catch (dupError) {
        // Handle duplicate key error (another process created the identity)
        if (dupError.code === 11000) {
          console.log(`[IdentityService] Race condition caught - identity already exists for user ${userId}`);
          const existing = await PlayerIdentity.findOne({ userId: userId, isDeleted: false });
          if (existing) {
            result.claimed.push(existing._id);
          }
        } else {
          throw dupError;
        }
      }
    }
    
    // Also claim any additional guest identities matching aliases
    const additionalClaimed = await PlayerIdentity.claimByName(username, userId);
    result.claimed.push(...additionalClaimed.filter(id => 
      !result.claimed.some(c => c.equals ? c.equals(id) : c.toString() === id.toString())
    ));
    
  } catch (error) {
    console.error('[IdentityService] Error claiming identities:', error);
    result.errors.push(error.message);
  }
  
  return result;
}

// ============================================
// Username Change Handling
// ============================================

/**
 * Handle username change - update primary identity display name
 * 
 * @param {Object} user - The user changing their username
 * @param {String} oldUsername - Previous username
 * @param {String} newUsername - New username
 * @returns {Object} Result of the update
 */
async function handleUsernameChange(user, oldUsername, newUsername) {
  const result = {
    updated: false,
    identity: null,
    errors: []
  };
  
  try {
    const userId = user._id;
    
    // Find the user's primary identity (the one matching their old username)
    let identity = await PlayerIdentity.findOne({
      userId: userId,
      normalizedName: oldUsername.toLowerCase().trim(),
      isDeleted: false
    });
    
    // If not found by old name, find any identity for this user
    if (!identity) {
      identity = await PlayerIdentity.findOne({
        userId: userId,
        isDeleted: false
      });
    }
    
    if (identity) {
      // Check if new username conflicts with another identity
      const existingNewName = await PlayerIdentity.findByName(newUsername);
      if (existingNewName && !existingNewName._id.equals(identity._id)) {
        if (existingNewName.userId && !existingNewName.userId.equals(userId)) {
          result.errors.push(`Username "${newUsername}" is already in use by another player`);
          return result;
        }
        
        // New name is a guest identity - merge it
        await PlayerIdentity.mergeIdentities(identity._id, [existingNewName._id], userId);
      }
      
      // Update the display name
      await identity.updateDisplayName(newUsername, userId);
      
      result.updated = true;
      result.identity = identity;
      console.log(`[IdentityService] Updated identity "${oldUsername}" -> "${newUsername}" for user ${userId}`);
    } else {
      // No identity found - create one
      identity = await PlayerIdentity.create({
        displayName: newUsername,
        normalizedName: newUsername.toLowerCase().trim(),
        userId: userId,
        type: 'user',
        createdBy: userId,
        nameHistory: [{
          name: oldUsername,
          normalizedName: oldUsername.toLowerCase().trim(),
          changedAt: new Date(),
          changedBy: userId
        }]
      });
      
      result.updated = true;
      result.identity = identity;
      console.log(`[IdentityService] Created identity with history for user ${userId}`);
    }
    
  } catch (error) {
    console.error('[IdentityService] Error handling username change:', error);
    result.errors.push(error.message);
  }
  
  return result;
}

// ============================================
// Account Deletion Handling
// ============================================

/**
 * Handle account deletion - unlink identities from user
 * Keeps the identities for historical game data but removes user link
 * 
 * @param {Object} user - The user being deleted
 * @param {Object} options - Options for handling identities
 * @returns {Object} Result of the operation
 */
async function handleAccountDeletion(user, options = {}) {
  const { deleteIdentities = false } = options;
  const result = {
    processed: 0,
    errors: []
  };
  
  try {
    const userId = user._id;
    
    const identities = await PlayerIdentity.find({
      userId: userId,
      isDeleted: false
    });
    
    for (const identity of identities) {
      if (deleteIdentities) {
        // Soft delete the identity
        await identity.softDelete();
      } else {
        // Just unlink from user (convert to guest)
        await identity.unlinkFromUser();
      }
      result.processed++;
    }
    
    console.log(`[IdentityService] Processed ${result.processed} identities for deleted user ${userId}`);
    
  } catch (error) {
    console.error('[IdentityService] Error handling account deletion:', error);
    result.errors.push(error.message);
  }
  
  return result;
}

// ============================================
// Admin Identity Management
// ============================================

/**
 * Admin: Assign a guest identity to a user
 * 
 * @param {String} identityId - Identity to assign
 * @param {String} userId - User to assign to
 * @param {String} adminId - Admin performing the action
 * @returns {Object} Updated identity
 */
async function adminAssignIdentity(identityId, userId, adminId) {
  // Validate inputs to prevent injection
  if (!mongoose.Types.ObjectId.isValid(identityId)) {
    throw new Error('Invalid identity ID');
  }
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  if (!mongoose.Types.ObjectId.isValid(adminId)) {
    throw new Error('Invalid admin ID');
  }
  
  const identity = await PlayerIdentity.findById(identityId);
  
  if (!identity) {
    throw new Error('Identity not found');
  }
  
  if (identity.userId) {
    throw new Error('Identity is already linked to a user');
  }
  
  identity.userId = userId;
  identity.type = 'user';
  identity.nameHistory.push({
    name: identity.displayName,
    normalizedName: identity.normalizedName,
    changedAt: new Date(),
    changedBy: adminId
  });
  
  await identity.save();
  
  console.log(`[IdentityService] Admin ${adminId} assigned identity ${identityId} to user ${userId}`);
  
  return identity;
}

/**
 * Admin: Merge multiple identities into one
 * 
 * @param {String} targetId - Identity to keep
 * @param {Array} sourceIds - Identities to merge into target
 * @param {String} adminId - Admin performing the action
 * @returns {Object} Merged identity
 */
async function adminMergeIdentities(targetId, sourceIds, adminId) {
  // Validate inputs to prevent injection
  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    throw new Error('Invalid target identity ID');
  }
  if (!mongoose.Types.ObjectId.isValid(adminId)) {
    throw new Error('Invalid admin ID');
  }
  if (!Array.isArray(sourceIds) || !sourceIds.every(id => mongoose.Types.ObjectId.isValid(id))) {
    throw new Error('Invalid source identity IDs');
  }
  
  const result = await PlayerIdentity.mergeIdentities(targetId, sourceIds, adminId);
  
  // Update all games that reference the source identities
  const WizardGame = mongoose.model('WizardGame');
  
  for (const sourceId of sourceIds) {
    // Use $eq operator to prevent NoSQL injection
    await WizardGame.updateMany(
      { 'gameData.players.identityId': { $eq: sourceId } },
      { $set: { 'gameData.players.$[elem].identityId': targetId } },
      { arrayFilters: [{ 'elem.identityId': { $eq: sourceId } }] }
    );
  }
  
  console.log(`[IdentityService] Admin ${adminId} merged ${sourceIds.length} identities into ${targetId}`);
  
  return result;
}

/**
 * Admin: Split an identity (create new identity from alias)
 * 
 * @param {String} identityId - Identity to split from
 * @param {String} aliasName - Alias to split into new identity
 * @param {String} adminId - Admin performing the action
 * @returns {Object} New identity
 */
async function adminSplitIdentity(identityId, aliasName, adminId) {
  // Validate inputs to prevent injection
  if (!mongoose.Types.ObjectId.isValid(identityId)) {
    throw new Error('Invalid identity ID');
  }
  if (!mongoose.Types.ObjectId.isValid(adminId)) {
    throw new Error('Invalid admin ID');
  }
  if (typeof aliasName !== 'string' || aliasName.length === 0 || aliasName.length > 100) {
    throw new Error('Invalid alias name');
  }
  
  const identity = await PlayerIdentity.findById(identityId);
  
  if (!identity) {
    throw new Error('Identity not found');
  }
  
  // Sanitize and normalize alias name for comparison
  const sanitizedAliasName = String(aliasName).toLowerCase().trim();
  const alias = identity.aliases.find(a => 
    a.normalizedName === sanitizedAliasName
  );
  
  if (!alias) {
    throw new Error('Alias not found on this identity');
  }
  
  // Remove alias from original identity (use sanitized name)
  await identity.removeAlias(sanitizedAliasName);
  
  // Create new identity
  const newIdentity = await PlayerIdentity.create({
    displayName: alias.name,
    normalizedName: alias.normalizedName,
    type: 'guest',
    createdBy: adminId
  });
  
  console.log(`[IdentityService] Admin ${adminId} split alias "${aliasName}" from identity ${identityId}`);
  
  return newIdentity;
}

// ============================================
// Game Integration
// ============================================

/**
 * Get or create identities for all players in a game
 * Used when saving a new game
 * 
 * @param {Array} players - Array of player objects with name
 * @param {String} createdBy - User creating the game
 * @returns {Array} Players with identityId added
 */
async function resolvePlayerIdentities(players, createdBy) {
  const resolvedPlayers = [];
  
  for (const player of players) {
    const identity = await PlayerIdentity.findOrCreateByName(player.name, {
      createdBy,
      type: 'guest'
    });
    
    resolvedPlayers.push({
      ...player,
      identityId: identity._id
    });
  }
  
  return resolvedPlayers;
}

/**
 * Update game with identity references
 * Used during migration or when linking players
 * 
 * @param {Object} game - Game document
 * @returns {Object} Updated game
 */
async function updateGameIdentities(game) {
  if (!game.gameData || !game.gameData.players) {
    return game;
  }
  
  let modified = false;
  
  for (const player of game.gameData.players) {
    if (!player.identityId && player.name) {
      const identity = await PlayerIdentity.findOrCreateByName(player.name, {
        type: 'guest'
      });
      player.identityId = identity._id;
      modified = true;
    }
  }
  
  if (modified) {
    game.markModified('gameData.players');
    await game.save();
  }
  
  return game;
}

/**
 * Get player statistics across all identities for a user
 * 
 * @param {String} userId - User ID
 * @returns {Object} Aggregated statistics
 */
async function getUserStats(userId) {
  // Validate userId to prevent injection
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  
  const identities = await PlayerIdentity.find({
    userId: { $eq: userId },
    isDeleted: { $eq: false }
  });
  
  const stats = {
    identities: identities.length,
    totalGames: 0,
    totalWins: 0,
    lastGameAt: null,
    identityDetails: []
  };
  
  for (const identity of identities) {
    stats.totalGames += identity.stats.totalGames;
    stats.totalWins += identity.stats.totalWins;
    
    if (identity.stats.lastGameAt) {
      if (!stats.lastGameAt || identity.stats.lastGameAt > stats.lastGameAt) {
        stats.lastGameAt = identity.stats.lastGameAt;
      }
    }
    
    stats.identityDetails.push({
      id: identity._id,
      displayName: identity.displayName,
      games: identity.stats.totalGames,
      wins: identity.stats.totalWins,
      aliases: identity.aliases.map(a => a.name)
    });
  }
  
  return stats;
}

// ============================================
// Search & Lookup
// ============================================

/**
 * Search for identities with optional filters
 * 
 * @param {String} query - Search query
 * @param {Object} options - Search options
 * @returns {Object} Search results with pagination
 */
async function searchIdentities(query, options = {}) {
  return PlayerIdentity.search(query, options);
}

/**
 * Get identity by ID with full details
 * 
 * @param {String} identityId - Identity ID
 * @returns {Object} Identity with populated references
 */
async function getIdentityDetails(identityId) {
  // Validate identityId to prevent injection
  if (!mongoose.Types.ObjectId.isValid(identityId)) {
    return null;
  }
  
  const identity = await PlayerIdentity.findById(identityId)
    .populate('userId', 'username profilePicture role')
    .populate('createdBy', 'username')
    .populate('nameHistory.changedBy', 'username')
    .populate('aliases.addedBy', 'username');
  
  if (!identity || identity.isDeleted) {
    return null;
  }
  
  // Get recent games
  const recentGames = await identity.getGames({ limit: 5 });
  
  return {
    identity,
    recentGames
  };
}

/**
 * Get all identities for admin management
 * 
 * @param {Object} options - Filter and pagination options
 * @returns {Object} Identities with pagination
 */
async function getAllIdentities(options = {}) {
  const {
    page = 1,
    limit = 50,
    type = null,
    linked = null,
    search = null
  } = options;
  
  // Validate and sanitize pagination parameters
  const sanitizedPage = Math.max(1, Math.min(parseInt(page) || 1, 1000));
  const sanitizedLimit = Math.max(1, Math.min(parseInt(limit) || 50, 200));
  
  const filter = { isDeleted: { $eq: false } };
  
  // Validate type parameter (whitelist allowed values)
  if (type) {
    const allowedTypes = ['user', 'guest', 'system'];
    if (typeof type === 'string' && allowedTypes.includes(type)) {
      filter.type = { $eq: type };
    }
  }
  
  if (linked === true) {
    filter.userId = { $ne: null };
  } else if (linked === false) {
    filter.userId = { $eq: null };
  }
  
  if (search) {
    // Ensure search is a string and limit length to prevent ReDoS
    if (typeof search === 'string' && search.length > 0 && search.length <= 100) {
      // Escape regex special characters and create safe regex
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedSearch, 'i');
      filter.$or = [
        { displayName: { $regex: regex } },
        { 'aliases.name': { $regex: regex } }
      ];
    }
  }
  
  const skip = (sanitizedPage - 1) * sanitizedLimit;
  
  const [identities, total] = await Promise.all([
    PlayerIdentity.find(filter)
      .populate('userId', 'username profilePicture')
      .sort({ displayName: 1 })
      .skip(skip)
      .limit(sanitizedLimit),
    PlayerIdentity.countDocuments(filter)
  ]);
  
  return {
    identities,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

module.exports = {
  // User lifecycle
  claimIdentitiesOnRegistration,
  handleUsernameChange,
  handleAccountDeletion,
  
  // Admin management
  adminAssignIdentity,
  adminMergeIdentities,
  adminSplitIdentity,
  
  // Game integration
  resolvePlayerIdentities,
  updateGameIdentities,
  
  // Statistics
  getUserStats,
  
  // Search & Lookup
  searchIdentities,
  getIdentityDetails,
  getAllIdentities
};
