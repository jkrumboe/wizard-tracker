const mongoose = require('mongoose');

/**
 * Player subdocument schema for table games
 * Each player has an identityId linking to PlayerIdentity for unified lookups
 */
const tableGamePlayerSchema = new mongoose.Schema({
  // Primary identity reference - used for all lookups
  identityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlayerIdentity',
    index: true
  },
  // Display name at the time of the game
  name: {
    type: String,
    required: true,
    trim: true
  },
  // Original ID from game upload (for backwards compatibility and reversibility)
  originalId: {
    type: String,
    default: null
  },
  // Points/scores for this player
  points: [{
    type: mongoose.Schema.Types.Mixed
  }]
}, { _id: false });

const tableGameSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  localId: {
    type: String,
    required: [true, 'Local game ID is required'],
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Game name is required']
  },
  gameTypeName: {
    type: String,
    default: null
  },
  gameData: {
    type: Object,
    required: [true, 'Game data is required'],
    default: {}
  },
  gameType: {
    type: String,
    default: 'table'
  },
  gameFinished: {
    type: Boolean,
    default: false
  },
  playerCount: {
    type: Number,
    default: 0
  },
  totalRounds: {
    type: Number,
    default: 0
  },
  targetNumber: {
    type: Number,
    default: null
  },
  lowIsBetter: {
    type: Boolean,
    default: false
  },
  // Migration tracking
  identitiesMigrated: {
    type: Boolean,
    default: false,
    description: 'Whether player identities have been resolved for this game'
  },
  migratedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries by user and creation date
tableGameSchema.index({ userId: 1, createdAt: -1 });

// Index for faster lookups by localId
tableGameSchema.index({ localId: 1, userId: 1 });

// Index for game type filtering
tableGameSchema.index({ gameTypeName: 1, createdAt: -1 });

// Index for finished games queries
tableGameSchema.index({ gameFinished: 1, userId: 1 });

// Index for identity-based lookups (find all games where a player participated)
tableGameSchema.index({ 'gameData.players.identityId': 1, createdAt: -1 });

// Index for winner lookups by identity
tableGameSchema.index({ 'gameData.winner_identityId': 1 });

// Index for migration status
tableGameSchema.index({ identitiesMigrated: 1 });

/**
 * Pre-save hook to resolve player identities
 * Automatically links players to PlayerIdentity records
 */
tableGameSchema.pre('save', async function(next) {
  // Only resolve identities for new games or if players are modified
  if (!this.isNew && !this.isModified('gameData')) {
    return next();
  }

  try {
    // Lazy-load to avoid circular dependencies
    const PlayerIdentity = mongoose.model('PlayerIdentity');
    
    const gameData = this.gameData?.gameData || this.gameData;
    if (gameData && gameData.players && Array.isArray(gameData.players)) {
      let modified = false;
      
      for (const player of gameData.players) {
        // Skip if already has identityId
        if (player.identityId) continue;
        
        if (player.name) {
          // Save original ID for reversibility
          if (player.id && !player.originalId) {
            player.originalId = player.id;
          }
          
          // Find or create identity for this player
          const identity = await PlayerIdentity.findOrCreateByName(player.name, {
            type: 'guest'
          });
          player.identityId = identity._id;
          modified = true;
        }
      }
      
      // Also update winner_identityId if we have a winner
      if (gameData.winner_id || gameData.winner_ids) {
        const winnerIds = gameData.winner_ids || [gameData.winner_id];
        const winnerIdentityIds = [];
        
        for (const winnerId of winnerIds) {
          // Find the player with this ID and use their identityId
          const winnerPlayer = gameData.players.find(p => 
            p.id === winnerId || p.originalId === winnerId
          );
          if (winnerPlayer && winnerPlayer.identityId) {
            winnerIdentityIds.push(winnerPlayer.identityId);
          }
        }
        
        if (winnerIdentityIds.length > 0) {
          gameData.winner_identityIds = winnerIdentityIds;
          if (winnerIdentityIds.length === 1) {
            gameData.winner_identityId = winnerIdentityIds[0];
          }
          modified = true;
        }
      }
      
      if (modified) {
        this.markModified('gameData');
        this.identitiesMigrated = true;
        this.migratedAt = new Date();
      }
    }
    
    next();
  } catch (error) {
    // Log with context but don't fail - identity resolution is non-critical
    console.error('[TableGame pre-save] Failed to resolve player identities:', {
      error: error.message,
      gameLocalId: this.localId,
      players: (this.gameData?.gameData || this.gameData)?.players?.map(p => p.name) || [],
      isNew: this.isNew
    });
    next();
  }
});

/**
 * Static method to find games by player identity
 */
tableGameSchema.statics.findByPlayerIdentity = async function(identityId, options = {}) {
  const { limit = 50, skip = 0, gameType = null } = options;
  
  const query = { 'gameData.players.identityId': identityId };
  if (gameType) {
    query.gameTypeName = gameType;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

/**
 * Static method to update all games when an identity is linked/merged
 * @param {ObjectId} oldIdentityId - The old identity ID to replace
 * @param {ObjectId} newIdentityId - The new identity ID to use
 * @returns {Object} Update result with count
 */
tableGameSchema.statics.updatePlayerIdentity = async function(oldIdentityId, newIdentityId) {
  // Update player identityId in gameData.players array
  const result = await this.updateMany(
    { 'gameData.players.identityId': { $eq: oldIdentityId } },
    { 
      $set: { 
        'gameData.players.$[elem].identityId': newIdentityId,
        'gameData.players.$[elem].previousIdentityId': oldIdentityId
      }
    },
    { arrayFilters: [{ 'elem.identityId': { $eq: oldIdentityId } }] }
  );
  
  // Also update winner_identityId and winner_identityIds
  await this.updateMany(
    { 'gameData.winner_identityId': { $eq: oldIdentityId } },
    { 
      $set: { 
        'gameData.winner_identityId': newIdentityId,
        'gameData.previous_winner_identityId': oldIdentityId
      }
    }
  );
  
  await this.updateMany(
    { 'gameData.winner_identityIds': { $eq: oldIdentityId } },
    { 
      $set: { 'gameData.winner_identityIds.$[elem]': newIdentityId },
      $push: { 'gameData.previous_winner_identityIds': oldIdentityId }
    },
    { arrayFilters: [{ 'elem': { $eq: oldIdentityId } }] }
  );
  
  return result;
};

// Post-save hook for ELO updates
tableGameSchema.post('save', async function(doc) {
  // Only update ELO for finished games
  if (!doc.gameFinished && !doc.gameData?.gameFinished) {
    return;
  }
  
  // Skip if ELO updates are disabled (e.g., during migration)
  if (process.env.SKIP_ELO_UPDATES === 'true') {
    return;
  }
  
  try {
    // Lazy-load to avoid circular dependencies
    const eloService = require('../utils/eloService');
    
    // Get game type from gameTypeName or gameType
    const gameType = doc.gameTypeName || doc.gameType || 'table';
    
    // Update ELO ratings for all players in this game
    const updates = await eloService.updateRatingsForGame(doc, gameType);
    
    if (updates.length > 0) {
      console.log(`ELO updated for ${updates.length} players after ${gameType} game ${doc._id}`);
    }
  } catch (error) {
    // Enhanced error logging with game context
    const gameType = doc.gameTypeName || doc.gameType || 'table';
    console.error(`[ELO ERROR] Failed to update ELO ratings for ${gameType} game ${doc._id}:`, {
      error: error.message,
      stack: error.stack,
      gameId: doc._id,
      gameType,
      players: doc.gameData?.players?.map(p => ({ name: p.name, identityId: p.identityId })) || [],
      timestamp: new Date().toISOString()
    });
    
    // In production, you might want to track failed ELO updates for manual review
    // For now, we log extensively but don't fail the save operation
  }
});

module.exports = mongoose.model('TableGame', tableGameSchema);
