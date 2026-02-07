const mongoose = require('mongoose');

/**
 * PlayerIdentity - Central identity system for player management
 * 
 * This model serves as the single source of truth for player identities,
 * replacing the name-based alias system with proper foreign key relationships.
 * 
 * Key Features:
 * - Automatic claim on user registration (matches existing guest names)
 * - Name history tracking for audit trail
 * - Support for linked user accounts and guest identities
 * - Case-insensitive name matching
 */
const playerIdentitySchema = new mongoose.Schema({
  // Current display name
  displayName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  // Normalized name for case-insensitive lookups
  normalizedName: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  
  // Linked user account (null for guest identities)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
    sparse: true
  },
  
  // Identity type for filtering and management
  type: {
    type: String,
    enum: ['user', 'guest', 'imported'],
    default: 'guest',
    index: true
  },
  
  // Historical names for tracking and matching
  nameHistory: [{
    name: { type: String, required: true },
    normalizedName: { type: String, required: true, lowercase: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  
  // Alternative names that should map to this identity
  aliases: [{
    name: { type: String, required: true },
    normalizedName: { type: String, required: true, lowercase: true },
    addedAt: { type: Date, default: Date.now },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  
  // Statistics cache for quick lookups
  stats: {
    totalGames: { type: Number, default: 0 },
    totalWins: { type: Number, default: 0 },
    lastGameAt: { type: Date, default: null }
  },
  
  // ELO Rating System - Per Game Type
  // Key is game type: 'wizard', 'flip-7', 'dutch', etc.
  eloByGameType: {
    type: Map,
    of: {
      rating: { type: Number, default: 1000 },           // Current ELO rating
      peak: { type: Number, default: 1000 },             // Highest rating achieved
      floor: { type: Number, default: 1000 },            // Lowest rating achieved
      gamesPlayed: { type: Number, default: 0 },         // Games counted for ELO
      lastUpdated: { type: Date, default: null },        // Last rating update
      streak: { type: Number, default: 0 },              // Current win/loss streak (positive = wins)
      history: [{                                         // Rating change history
        rating: { type: Number, required: true },
        change: { type: Number, required: true },
        gameId: { type: mongoose.Schema.Types.ObjectId },
        opponents: [{ type: String }],                   // Opponent names for context
        placement: { type: Number },                     // 1st, 2nd, 3rd, etc.
        date: { type: Date, default: Date.now }
      }]
    },
    default: new Map()
  },
  
  // Track merged/linked identities for reversibility
  // When guest identities are linked to this user identity, store them here
  linkedIdentities: [{
    identityId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlayerIdentity' },
    linkedAt: { type: Date, default: Date.now },
    linkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    originalDisplayName: { type: String }
  }],
  
  // If this identity was merged into another, track the parent
  mergedInto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlayerIdentity',
    default: null
  },
  
  // Metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Soft delete support
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, {
  timestamps: true,
  collection: 'playeridentities'
});

// Compound indexes for efficient queries
playerIdentitySchema.index({ normalizedName: 1, isDeleted: 1 });
playerIdentitySchema.index({ userId: 1, isDeleted: 1 });
playerIdentitySchema.index({ 'aliases.normalizedName': 1 });
playerIdentitySchema.index({ type: 1, isDeleted: 1 });

// ELO ranking indexes - for leaderboard queries
// These indexes optimize the common ELO queries for rankings and filtering
// Index for wizard game type ELO (most common game type)
playerIdentitySchema.index(
  { 'eloByGameType.wizard.rating': -1, 'eloByGameType.wizard.gamesPlayed': -1 },
  { sparse: true, partialFilterExpression: { 'eloByGameType.wizard': { $exists: true }, isDeleted: false } }
);

// Index for table game types
playerIdentitySchema.index(
  { 'eloByGameType.flip-7.rating': -1, 'eloByGameType.flip-7.gamesPlayed': -1 },
  { sparse: true, partialFilterExpression: { 'eloByGameType.flip-7': { $exists: true }, isDeleted: false } }
);

playerIdentitySchema.index(
  { 'eloByGameType.dutch.rating': -1, 'eloByGameType.dutch.gamesPlayed': -1 },
  { sparse: true, partialFilterExpression: { 'eloByGameType.dutch': { $exists: true }, isDeleted: false } }
);

// Unique index to prevent duplicate user identities with same userId
// Each user can only have one primary identity linked to their account
playerIdentitySchema.index(
  { userId: 1 },
  { 
    unique: true, 
    sparse: true,  // Allows multiple null values (for guest identities)
    partialFilterExpression: { userId: { $type: 'objectId' }, isDeleted: false }
  }
);

// Pre-save middleware to update normalizedName
playerIdentitySchema.pre('save', function(next) {
  if (this.isModified('displayName')) {
    this.normalizedName = this.displayName.toLowerCase().trim();
  }
  this.updatedAt = new Date();
  next();
});

// ============================================
// Static Methods
// ============================================

/**
 * Find identity by name (case-insensitive)
 * Searches displayName, normalizedName, and aliases
 */
playerIdentitySchema.statics.findByName = async function(name) {
  const normalized = name.toLowerCase().trim();
  
  return this.findOne({
    isDeleted: false,
    $or: [
      { normalizedName: normalized },
      { 'aliases.normalizedName': normalized },
      { 'nameHistory.normalizedName': normalized }
    ]
  });
};

/**
 * Find or create identity for a player name
 * Used during game creation/import
 */
playerIdentitySchema.statics.findOrCreateByName = async function(name, options = {}) {
  const { createdBy = null, type = 'guest' } = options;
  
  let identity = await this.findByName(name);
  
  if (!identity) {
    identity = await this.create({
      displayName: name.trim(),
      normalizedName: name.toLowerCase().trim(),
      type,
      createdBy
    });
  }
  
  return identity;
};

/**
 * Find all identities for a user
 */
playerIdentitySchema.statics.findByUserId = async function(userId) {
  return this.find({
    userId,
    isDeleted: false
  }).sort({ displayName: 1 });
};

/**
 * Claim unclaimed identities matching a name
 * Called during user registration
 */
playerIdentitySchema.statics.claimByName = async function(name, userId) {
  const normalized = name.toLowerCase().trim();
  
  // Find all guest identities matching this name
  const identities = await this.find({
    isDeleted: false,
    userId: null,
    type: 'guest',
    $or: [
      { normalizedName: normalized },
      { 'aliases.normalizedName': normalized }
    ]
  });
  
  const claimedIds = [];
  
  for (const identity of identities) {
    identity.userId = userId;
    identity.type = 'user';
    await identity.save();
    claimedIds.push(identity._id);
  }
  
  return claimedIds;
};

/**
 * Merge multiple identities into one
 * Preserves name history from all merged identities
 * Uses a transaction when available for atomicity
 */
playerIdentitySchema.statics.mergeIdentities = async function(targetId, sourceIds, mergedBy) {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch {
    // Transactions not supported (no replica set) — proceed without
    session = null;
  }

  try {
    const findOpts = session ? { session } : {};
    const target = await this.findById(targetId, null, findOpts);
    if (!target) {
      throw new Error('Target identity not found');
    }
    
    const sources = await this.find({
      _id: { $in: sourceIds },
      isDeleted: false
    }, null, findOpts);
    
    for (const source of sources) {
      // Add source name as alias if different
      if (source.normalizedName !== target.normalizedName) {
        target.aliases.push({
          name: source.displayName,
          normalizedName: source.normalizedName,
          addedAt: new Date(),
          addedBy: mergedBy
        });
      }
      
      // Merge aliases
      for (const alias of source.aliases) {
        if (!target.aliases.some(a => a.normalizedName === alias.normalizedName)) {
          target.aliases.push({
            ...alias.toObject(),
            addedAt: new Date(),
            addedBy: mergedBy
          });
        }
      }
      
      // Merge name history
      for (const history of source.nameHistory) {
        target.nameHistory.push(history);
      }
      
      // Merge stats
      target.stats.totalGames += source.stats.totalGames;
      target.stats.totalWins += source.stats.totalWins;
      if (source.stats.lastGameAt > target.stats.lastGameAt) {
        target.stats.lastGameAt = source.stats.lastGameAt;
      }
      
      // Track merge lineage
      source.mergedInto = target._id;
      source.isDeleted = true;
      source.deletedAt = new Date();
      await source.save(findOpts);
    }
    
    await target.save(findOpts);
    
    if (session) {
      await session.commitTransaction();
    }
    
    return target;
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

/**
 * Search identities with pagination
 */
playerIdentitySchema.statics.search = async function(query, options = {}) {
  const {
    page = 1,
    limit = 20,
    type = null,
    includeLinked = true,
    includeGuest = true
  } = options;
  
  const filter = { isDeleted: false };
  
  if (query) {
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { displayName: regex },
      { 'aliases.name': regex }
    ];
  }
  
  if (type) {
    filter.type = type;
  } else {
    const types = [];
    if (includeLinked) types.push('user');
    if (includeGuest) types.push('guest', 'imported');
    if (types.length > 0) {
      filter.type = { $in: types };
    }
  }
  
  const skip = (page - 1) * limit;
  
  const [identities, total] = await Promise.all([
    this.find(filter)
      .populate('userId', 'username profilePicture')
      .sort({ displayName: 1 })
      .skip(skip)
      .limit(limit),
    this.countDocuments(filter)
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
};

// ============================================
// Instance Methods
// ============================================

/**
 * Update display name and track in history
 */
playerIdentitySchema.methods.updateDisplayName = async function(newName, changedBy) {
  // Add current name to history
  this.nameHistory.push({
    name: this.displayName,
    normalizedName: this.normalizedName,
    changedAt: new Date(),
    changedBy
  });
  
  this.displayName = newName.trim();
  this.normalizedName = newName.toLowerCase().trim();
  
  return this.save();
};

/**
 * Add an alias to this identity
 */
playerIdentitySchema.methods.addAlias = async function(aliasName, addedBy) {
  const normalized = aliasName.toLowerCase().trim();
  
  // Check if alias already exists
  if (this.aliases.some(a => a.normalizedName === normalized)) {
    return this;
  }
  
  // Check if alias conflicts with another identity
  const existing = await this.constructor.findByName(aliasName);
  if (existing && !existing._id.equals(this._id)) {
    throw new Error(`Alias "${aliasName}" is already in use by another identity`);
  }
  
  this.aliases.push({
    name: aliasName.trim(),
    normalizedName: normalized,
    addedAt: new Date(),
    addedBy
  });
  
  return this.save();
};

/**
 * Remove an alias
 */
playerIdentitySchema.methods.removeAlias = async function(aliasName) {
  const normalized = aliasName.toLowerCase().trim();
  this.aliases = this.aliases.filter(a => a.normalizedName !== normalized);
  return this.save();
};

/**
 * Link this identity to a user account
 */
playerIdentitySchema.methods.linkToUser = async function(userId) {
  if (this.userId) {
    throw new Error('Identity is already linked to a user');
  }
  
  this.userId = userId;
  this.type = 'user';
  return this.save();
};

/**
 * Unlink from user (convert back to guest)
 */
playerIdentitySchema.methods.unlinkFromUser = async function() {
  this.userId = null;
  this.type = 'guest';
  return this.save();
};

/**
 * Soft delete this identity
 */
playerIdentitySchema.methods.softDelete = async function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

/**
 * Restore a soft-deleted identity
 */
playerIdentitySchema.methods.restore = async function() {
  this.isDeleted = false;
  this.deletedAt = null;
  return this.save();
};

/**
 * Get all games for this identity
 */
playerIdentitySchema.methods.getGames = async function(options = {}) {
  const { page = 1, limit = 20 } = options;
  const WizardGame = mongoose.model('WizardGame');
  
  const skip = (page - 1) * limit;
  
  const games = await WizardGame.find({
    'gameData.players.identityId': this._id,
    isDeleted: { $ne: true }
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  
  return games;
};

/**
 * Recalculate stats from games
 */
playerIdentitySchema.methods.recalculateStats = async function() {
  const WizardGame = mongoose.model('WizardGame');
  
  const games = await WizardGame.find({
    'gameData.players.identityId': this._id,
    isDeleted: { $ne: true }
  });
  
  this.stats.totalGames = games.length;
  this.stats.totalWins = 0;
  this.stats.lastGameAt = null;
  
  for (const game of games) {
    const player = game.gameData.players.find(p => 
      p.identityId && p.identityId.equals(this._id)
    );
    
    if (player) {
      // Check if this player won using final_scores or calculated from round_data
      const finalScores = game.gameData.final_scores || {};
      let playerScore = finalScores[player.id];
      
      // If no final_scores, calculate from round_data
      if (playerScore === undefined && game.gameData.round_data) {
        playerScore = game.gameData.round_data.reduce((total, round) => {
          const roundPlayer = round.players?.find(rp => rp.id === player.id);
          return total + (roundPlayer?.score || 0);
        }, 0);
      }
      
      // Get max score to determine winner
      const allScores = game.gameData.players.map(p => {
        let score = finalScores[p.id];
        if (score === undefined && game.gameData.round_data) {
          score = game.gameData.round_data.reduce((total, round) => {
            const roundPlayer = round.players?.find(rp => rp.id === p.id);
            return total + (roundPlayer?.score || 0);
          }, 0);
        }
        return score || 0;
      });
      
      const maxScore = Math.max(...allScores);
      if (playerScore === maxScore && maxScore > 0) {
        this.stats.totalWins++;
      }
    }
    
    if (!this.stats.lastGameAt || game.createdAt > this.stats.lastGameAt) {
      this.stats.lastGameAt = game.createdAt;
    }
  }
  
  return this.save();
};

module.exports = mongoose.model('PlayerIdentity', playerIdentitySchema);
