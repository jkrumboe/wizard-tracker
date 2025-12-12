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
  // Migration metadata
  migratedFrom: {
    type: String,
    enum: ['1.0', '2.0', '3.0', null],
    default: null,
    description: 'Original version if migrated, null if created as v3.0'
  },
  migratedAt: {
    type: Date,
    default: null,
    description: 'When the game was migrated'
  },
  originalGameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    default: null,
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

// Virtual for game version
wizardGameSchema.virtual('version').get(function() {
  return this.gameData?.version || 'unknown';
});

// Method to check if game is migrated
wizardGameSchema.methods.isMigrated = function() {
  return this.migratedFrom !== null;
};

module.exports = mongoose.model('WizardGame', wizardGameSchema, 'wizard');
