const mongoose = require('mongoose');

/**
 * Migration tracking model
 * Tracks which migrations have been applied to prevent re-running
 */
const migrationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  version: {
    type: String,
    required: true
  },
  appliedAt: {
    type: Date,
    default: Date.now
  },
  duration: {
    type: Number,  // milliseconds
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending'
  },
  stats: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  error: {
    type: String,
    default: null
  }
});

module.exports = mongoose.model('Migration', migrationSchema);
