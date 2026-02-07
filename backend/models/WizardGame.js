const mongoose = require('mongoose');

/**
 * WizardGame Model
 * Separate collection for validated wizard games in v3.0 format
 * This keeps migrated/validated wizard games separate from legacy games
 */
const wizardGameSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.Mixed, // ObjectId or String for unauthenticated
    required: [true, 'User ID is required'],
    index: true
  },
  localId: {
    type: String,
    required: [true, 'Local game ID is required'],
    unique: true,
    index: true
  },
  gameData: {
    type: Object,
    required: [true, 'Game data is required'],
    validate: {
      validator: function(v) {
        // Ensure version 3.0 format
        return v && v.version === '3.0' && v.players && v.round_data;
      },
      message: 'Game data must be in v3.0 format'
    }
  },
  // Migration metadata (excluded from queries by default)
  migratedFrom: {
    type: String,
    enum: ['1.0', '2.0', '3.0', null],
    default: null,
    select: false,
    description: 'Original version if migrated, null if created as v3.0'
  },
  migratedAt: {
    type: Date,
    default: null,
    select: false,
    description: 'When the game was migrated'
  },
  originalGameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    default: null,
    select: false,
    description: 'Reference to original game in legacy collection'
  },
  // Sharing features
  shareId: {
    type: String,
    sparse: true,
    index: true
  },
  isShared: {
    type: Boolean,
    default: false
  },
  sharedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
wizardGameSchema.index({ userId: 1, createdAt: -1 });
wizardGameSchema.index({ 'gameData.created_at': -1 });
wizardGameSchema.index({ migratedFrom: 1, migratedAt: -1 });
wizardGameSchema.index({ 'gameData.players.identityId': 1 }); // Identity lookups

// Virtual for game version
wizardGameSchema.virtual('version').get(function() {
  return this.gameData?.version || 'unknown';
});

// Method to check if game is migrated
wizardGameSchema.methods.isMigrated = function() {
  return this.migratedFrom !== null;
};

/**
 * Resolve player identities before saving
 * Automatically links players to PlayerIdentity records
 */
wizardGameSchema.pre('save', async function(next) {
  // Only resolve identities for new games or if players are modified
  if (!this.isNew && !this.isModified('gameData.players')) {
    return next();
  }

  try {
    // Lazy-load to avoid circular dependencies
    const PlayerIdentity = mongoose.model('PlayerIdentity');
    
    if (this.gameData && this.gameData.players) {
      for (const player of this.gameData.players) {
        // Skip if already has identityId
        if (player.identityId) continue;
        
        if (player.name) {
          // Find or create identity for this player
          const identity = await PlayerIdentity.findOrCreateByName(player.name, {
            type: 'guest'
          });
          player.identityId = identity._id;
        }
      }
      this.markModified('gameData.players');
    }
    
    next();
  } catch (error) {
    // Log with context but don't fail - identity resolution is non-critical
    console.error('[WizardGame pre-save] Failed to resolve player identities:', {
      error: error.message,
      gameLocalId: this.localId,
      players: this.gameData?.players?.map(p => p.name) || [],
      isNew: this.isNew
    });
    next();
  }
});

/**
 * Post-save hook to update ELO ratings when a game finishes
 */
wizardGameSchema.post('save', async function(doc) {
  // Only update ELO for finished games
  if (!doc.gameData?.gameFinished) {
    return;
  }
  
  // Skip if ELO updates are disabled (e.g., during migration)
  if (process.env.SKIP_ELO_UPDATES === 'true') {
    return;
  }
  
  try {
    // Lazy-load to avoid circular dependencies
    const eloService = require('../utils/eloService');
    
    // Update ELO ratings for all players in this game (game type: wizard)
    const updates = await eloService.updateRatingsForGame(doc, 'wizard');
    
    if (updates.length > 0) {
      console.log(`ELO updated for ${updates.length} players after wizard game ${doc._id}`);
    }
  } catch (error) {
    // Enhanced error logging with game context
    console.error(`[ELO ERROR] Failed to update ELO ratings for wizard game ${doc._id}:`, {
      error: error.message,
      stack: error.stack,
      gameId: doc._id,
      players: doc.gameData?.players?.map(p => ({ name: p.name, identityId: p.identityId })) || [],
      timestamp: new Date().toISOString()
    });
    
    // In production, you might want to track failed ELO updates for manual review
    // For now, we log extensively but don't fail the save operation
    // Future: Could emit an event or write to a failed-elo-updates collection
  }
});

module.exports = mongoose.model('WizardGame', wizardGameSchema, 'wizard');
