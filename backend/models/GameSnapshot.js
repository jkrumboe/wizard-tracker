const mongoose = require('mongoose');

/**
 * GameSnapshot schema for storing complete game states
 * Used for disaster recovery and fast restoration
 */
const gameSnapshotSchema = new mongoose.Schema({
  gameId: {
    type: String,
    required: true,
    index: true
  },
  serverVersion: {
    type: Number,
    required: true,
    index: true
  },
  gameState: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  eventCount: {
    type: Number,
    default: 0
  },
  checksum: {
    type: String,
    // Optional: can be used to verify state integrity
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 2592000 // Auto-delete after 30 days
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
gameSnapshotSchema.index({ gameId: 1, serverVersion: -1 });

// Unique constraint on gameId + serverVersion
gameSnapshotSchema.index({ gameId: 1, serverVersion: 1 }, { unique: true });

module.exports = mongoose.model('GameSnapshot', gameSnapshotSchema);
