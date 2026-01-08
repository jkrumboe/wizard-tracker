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
 * - Table game and wizard game identity linking
 * - Guest to user conversion with game updates
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
    
    // Get the user's final identity (the one we created or claimed)
    const userIdentity = result.created || 
      (result.claimed.length > 0 ? await PlayerIdentity.findById(result.claimed[0]) : null);
    
    if (userIdentity) {
      // Update games that reference any of the claimed guest identities
      // This links old games played as guest to the new user
      const allClaimedIds = [...result.claimed];
      
      for (const claimedId of allClaimedIds) {
        if (claimedId.toString() !== userIdentity._id.toString()) {
          try {
            // Update TableGames
            const TableGame = mongoose.model('TableGame');
            await TableGame.updatePlayerIdentity(claimedId, userIdentity._id);
            
            // Update WizardGames
            const WizardGame = mongoose.model('WizardGame');
            await WizardGame.updateMany(
              { 'gameData.players.identityId': { $eq: claimedId } },
              { 
                $set: { 
                  'gameData.players.$[elem].identityId': userIdentity._id,
                  'gameData.players.$[elem].previousIdentityId': claimedId
                }
              },
              { arrayFilters: [{ 'elem.identityId': { $eq: claimedId } }] }
            );
            
            // Add to linked identities for reversibility
            if (!userIdentity.linkedIdentities) {
              userIdentity.linkedIdentities = [];
            }
            const guestIdentity = await PlayerIdentity.findById(claimedId);
            if (guestIdentity) {
              userIdentity.linkedIdentities.push({
                identityId: claimedId,
                linkedAt: new Date(),
                linkedBy: userId,
                originalDisplayName: guestIdentity.displayName
              });
              guestIdentity.mergedInto = userIdentity._id;
              await guestIdentity.save();
            }
            
            console.log(`[IdentityService] Linked claimed identity ${claimedId} games to user ${userId}`);
          } catch (linkError) {
            console.error(`[IdentityService] Error linking games for claimed identity ${claimedId}:`, linkError.message);
          }
        }
      }
      
      if (userIdentity.linkedIdentities && userIdentity.linkedIdentities.length > 0) {
        await userIdentity.save();
      }
    }
    
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

// ============================================
// Player Linking (Guest to User Conversion)
// ============================================

/**
 * Link a guest identity to a user account
 * This is the core function for converting guest players to registered users
 * Updates all games (TableGame and WizardGame) to use the user's identity
 * 
 * @param {String} guestIdentityId - The guest identity to link
 * @param {String} userId - The user to link to
 * @param {String} linkedBy - User performing the action (admin or the user themselves)
 * @returns {Object} Result with update counts
 */
async function linkGuestToUser(guestIdentityId, userId, linkedBy) {
  // Validate inputs
  if (!mongoose.Types.ObjectId.isValid(guestIdentityId)) {
    throw new Error('Invalid guest identity ID');
  }
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  
  const result = {
    success: false,
    guestIdentity: null,
    userIdentity: null,
    gamesUpdated: {
      tableGames: 0,
      wizardGames: 0
    },
    errors: []
  };
  
  try {
    // Get the guest identity
    const guestIdentity = await PlayerIdentity.findById(guestIdentityId);
    if (!guestIdentity) {
      throw new Error('Guest identity not found');
    }
    
    // Check if already linked to a real (non-guest) user
    if (guestIdentity.userId) {
      const User = mongoose.model('User');
      const linkedUser = await User.findById(guestIdentity.userId);
      if (linkedUser && linkedUser.role !== 'guest') {
        throw new Error('Identity is already linked to a user');
      }
    }
    
    // Get or create the user's identity
    const User = mongoose.model('User');
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    let userIdentity = await PlayerIdentity.findOne({
      userId: userId,
      isDeleted: false
    });
    
    if (!userIdentity) {
      // Create identity for user
      userIdentity = await PlayerIdentity.create({
        displayName: user.username,
        normalizedName: user.username.toLowerCase().trim(),
        userId: userId,
        type: 'user',
        createdBy: linkedBy
      });
    }
    
    // Add guest identity as linked identity for reversibility
    userIdentity.linkedIdentities.push({
      identityId: guestIdentity._id,
      linkedAt: new Date(),
      linkedBy: linkedBy,
      originalDisplayName: guestIdentity.displayName
    });
    
    // Add guest's aliases to user identity
    for (const alias of guestIdentity.aliases) {
      if (!userIdentity.aliases.some(a => a.normalizedName === alias.normalizedName)) {
        userIdentity.aliases.push({
          name: alias.name,
          normalizedName: alias.normalizedName,
          addedAt: new Date(),
          addedBy: linkedBy
        });
      }
    }
    
    // Add guest's display name as alias if different
    if (guestIdentity.normalizedName !== userIdentity.normalizedName) {
      if (!userIdentity.aliases.some(a => a.normalizedName === guestIdentity.normalizedName)) {
        userIdentity.aliases.push({
          name: guestIdentity.displayName,
          normalizedName: guestIdentity.normalizedName,
          addedAt: new Date(),
          addedBy: linkedBy
        });
      }
    }
    
    await userIdentity.save();
    
    // Update all TableGames to use user's identity
    const TableGame = mongoose.model('TableGame');
    const tableGameResult = await TableGame.updatePlayerIdentity(guestIdentity._id, userIdentity._id);
    result.gamesUpdated.tableGames = tableGameResult.modifiedCount || 0;
    
    // Update all WizardGames to use user's identity
    const WizardGame = mongoose.model('WizardGame');
    const wizardGameResult = await WizardGame.updateMany(
      { 'gameData.players.identityId': { $eq: guestIdentity._id } },
      { 
        $set: { 
          'gameData.players.$[elem].identityId': userIdentity._id,
          'gameData.players.$[elem].previousIdentityId': guestIdentity._id
        }
      },
      { arrayFilters: [{ 'elem.identityId': { $eq: guestIdentity._id } }] }
    );
    result.gamesUpdated.wizardGames = wizardGameResult.modifiedCount || 0;
    
    // Mark guest identity as merged into user identity
    guestIdentity.mergedInto = userIdentity._id;
    guestIdentity.type = 'imported'; // Keep for historical reference
    await guestIdentity.save();
    
    result.success = true;
    result.guestIdentity = guestIdentity;
    result.userIdentity = userIdentity;
    
    console.log(`[IdentityService] Linked guest "${guestIdentity.displayName}" to user "${user.username}". Updated ${result.gamesUpdated.tableGames} table games, ${result.gamesUpdated.wizardGames} wizard games.`);
    
  } catch (error) {
    console.error('[IdentityService] Error linking guest to user:', error);
    result.errors.push(error.message);
  }
  
  return result;
}

/**
 * Link multiple guest identities to a user
 * Useful for players who played under multiple names before registering
 * 
 * @param {Array} guestIdentityIds - Array of guest identity IDs
 * @param {String} userId - The user to link to
 * @param {String} linkedBy - User performing the action
 * @returns {Object} Combined result
 */
async function linkMultipleGuestsToUser(guestIdentityIds, userId, linkedBy) {
  const result = {
    success: true,
    linked: [],
    failed: [],
    totalGamesUpdated: {
      tableGames: 0,
      wizardGames: 0
    }
  };
  
  for (const guestIdentityId of guestIdentityIds) {
    try {
      const linkResult = await linkGuestToUser(guestIdentityId, userId, linkedBy);
      if (linkResult.success) {
        result.linked.push(guestIdentityId);
        result.totalGamesUpdated.tableGames += linkResult.gamesUpdated.tableGames;
        result.totalGamesUpdated.wizardGames += linkResult.gamesUpdated.wizardGames;
      } else {
        result.failed.push({ id: guestIdentityId, errors: linkResult.errors });
      }
    } catch (error) {
      result.failed.push({ id: guestIdentityId, errors: [error.message] });
    }
  }
  
  if (result.failed.length > 0) {
    result.success = result.linked.length > 0;
  }
  
  return result;
}

/**
 * Unlink a guest identity from a user (revert linking)
 * Restores the guest identity and updates all games back
 * 
 * @param {String} guestIdentityId - The guest identity to unlink
 * @param {String} userId - The user to unlink from
 * @param {String} unlinkedBy - User performing the action
 * @returns {Object} Result with update counts
 */
async function unlinkGuestFromUser(guestIdentityId, userId, unlinkedBy) {
  // Validate inputs
  if (!mongoose.Types.ObjectId.isValid(guestIdentityId)) {
    throw new Error('Invalid guest identity ID');
  }
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  
  const result = {
    success: false,
    gamesUpdated: {
      tableGames: 0,
      wizardGames: 0
    },
    errors: []
  };
  
  try {
    // Get the user's identity
    const userIdentity = await PlayerIdentity.findOne({
      userId: userId,
      isDeleted: false
    });
    
    if (!userIdentity) {
      throw new Error('User identity not found');
    }
    
    // Check if guest identity was linked to this user
    const linkedEntry = userIdentity.linkedIdentities.find(
      li => li.identityId.toString() === guestIdentityId
    );
    
    if (!linkedEntry) {
      throw new Error('Guest identity was not linked to this user');
    }
    
    // Get the guest identity
    const guestIdentity = await PlayerIdentity.findById(guestIdentityId);
    if (!guestIdentity) {
      throw new Error('Guest identity not found');
    }
    
    // Update all TableGames back to guest identity
    const TableGame = mongoose.model('TableGame');
    const tableGameResult = await TableGame.updateMany(
      { 'gameData.players.previousIdentityId': { $eq: guestIdentity._id } },
      { 
        $set: { 'gameData.players.$[elem].identityId': guestIdentity._id },
        $unset: { 'gameData.players.$[elem].previousIdentityId': '' }
      },
      { arrayFilters: [{ 'elem.previousIdentityId': { $eq: guestIdentity._id } }] }
    );
    result.gamesUpdated.tableGames = tableGameResult.modifiedCount || 0;
    
    // Update all WizardGames back to guest identity
    const WizardGame = mongoose.model('WizardGame');
    const wizardGameResult = await WizardGame.updateMany(
      { 'gameData.players.previousIdentityId': { $eq: guestIdentity._id } },
      { 
        $set: { 'gameData.players.$[elem].identityId': guestIdentity._id },
        $unset: { 'gameData.players.$[elem].previousIdentityId': '' }
      },
      { arrayFilters: [{ 'elem.previousIdentityId': { $eq: guestIdentity._id } }] }
    );
    result.gamesUpdated.wizardGames = wizardGameResult.modifiedCount || 0;
    
    // Remove linked entry from user identity
    userIdentity.linkedIdentities = userIdentity.linkedIdentities.filter(
      li => li.identityId.toString() !== guestIdentityId
    );
    await userIdentity.save();
    
    // Restore guest identity
    guestIdentity.mergedInto = null;
    guestIdentity.type = 'guest';
    await guestIdentity.save();
    
    result.success = true;
    
    console.log(`[IdentityService] Unlinked guest "${guestIdentity.displayName}" from user. Reverted ${result.gamesUpdated.tableGames} table games, ${result.gamesUpdated.wizardGames} wizard games.`);
    
  } catch (error) {
    console.error('[IdentityService] Error unlinking guest from user:', error);
    result.errors.push(error.message);
  }
  
  return result;
}

/**
 * Get all identities that can be linked to a user
 * Shows guest identities that match names similar to the user's username
 * 
 * @param {String} userId - The user to find matches for
 * @returns {Object} Suggested identities
 */
async function getSuggestedIdentities(userId) {
  // Validate userId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  
  const User = mongoose.model('User');
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  const userIdentity = await PlayerIdentity.findOne({
    userId: userId,
    isDeleted: false
  });
  
  const normalizedUsername = user.username.toLowerCase().trim();
  
  // Find guest identities that might belong to this user
  // Search by name similarity and aliases
  const suggestedIdentities = await PlayerIdentity.find({
    isDeleted: false,
    userId: null,
    mergedInto: null,
    $or: [
      { normalizedName: normalizedUsername },
      { 'aliases.normalizedName': normalizedUsername },
      // Fuzzy match: names containing username
      { normalizedName: { $regex: new RegExp(normalizedUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }
    ]
  }).limit(20);
  
  // Get already linked identities for reference
  const linkedIdentities = userIdentity?.linkedIdentities?.map(li => li.identityId.toString()) || [];
  
  return {
    suggestions: suggestedIdentities.filter(si => !linkedIdentities.includes(si._id.toString())),
    alreadyLinked: linkedIdentities
  };
}

/**
 * Update all games when identity is merged or display name changes
 * Ensures consistency across TableGame and WizardGame collections
 * 
 * @param {String} identityId - The identity that changed
 * @param {String} newDisplayName - New display name (optional, for name changes)
 * @returns {Object} Update counts
 */
async function propagateIdentityChanges(identityId, newDisplayName = null) {
  // Validate identityId
  if (!mongoose.Types.ObjectId.isValid(identityId)) {
    throw new Error('Invalid identity ID');
  }
  
  const result = {
    tableGames: 0,
    wizardGames: 0
  };
  
  if (newDisplayName) {
    // Update player names in all games (for display purposes)
    const TableGame = mongoose.model('TableGame');
    const tableResult = await TableGame.updateMany(
      { 'gameData.players.identityId': { $eq: mongoose.Types.ObjectId(identityId) } },
      { $set: { 'gameData.players.$[elem].name': newDisplayName } },
      { arrayFilters: [{ 'elem.identityId': { $eq: mongoose.Types.ObjectId(identityId) } }] }
    );
    result.tableGames = tableResult.modifiedCount || 0;
    
    const WizardGame = mongoose.model('WizardGame');
    const wizardResult = await WizardGame.updateMany(
      { 'gameData.players.identityId': { $eq: mongoose.Types.ObjectId(identityId) } },
      { $set: { 'gameData.players.$[elem].name': newDisplayName } },
      { arrayFilters: [{ 'elem.identityId': { $eq: mongoose.Types.ObjectId(identityId) } }] }
    );
    result.wizardGames = wizardResult.modifiedCount || 0;
  }
  
  return result;
}

/**
 * Get all linked identities for a user (including the primary identity)
 * 
 * @param {String} userId - The user ID
 * @returns {Object} All identities associated with this user
 */
async function getUserIdentities(userId) {
  // Validate userId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  
  const primaryIdentity = await PlayerIdentity.findOne({
    userId: userId,
    isDeleted: false
  }).populate('linkedIdentities.identityId');
  
  if (!primaryIdentity) {
    return {
      primary: null,
      linked: [],
      aliases: []
    };
  }
  
  // Get details of linked identities
  const linkedDetails = [];
  for (const linked of primaryIdentity.linkedIdentities) {
    const identity = await PlayerIdentity.findById(linked.identityId);
    if (identity) {
      linkedDetails.push({
        id: identity._id,
        displayName: linked.originalDisplayName || identity.displayName,
        linkedAt: linked.linkedAt,
        aliases: identity.aliases.map(a => a.name)
      });
    }
  }
  
  return {
    primary: {
      id: primaryIdentity._id,
      displayName: primaryIdentity.displayName,
      normalizedName: primaryIdentity.normalizedName
    },
    linked: linkedDetails,
    aliases: primaryIdentity.aliases.map(a => a.name)
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
  
  // Player linking (Guest to User conversion)
  linkGuestToUser,
  linkMultipleGuestsToUser,
  unlinkGuestFromUser,
  getSuggestedIdentities,
  getUserIdentities,
  propagateIdentityChanges,
  
  // Statistics
  getUserStats,
  
  // Search & Lookup
  searchIdentities,
  getIdentityDetails,
  getAllIdentities
};
