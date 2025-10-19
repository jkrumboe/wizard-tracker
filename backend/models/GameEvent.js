const mongoose = require('mongoose');

/**
 * GameEvent schema for event-sourcing
 * Stores individual game mutation events
 */
const gameEventSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  gameId: {
    type: String,
    required: true,
    index: true
  },
  actionType: {
    type: String,
    required: true,
    enum: [
      'GAME_START',
      'GAME_PAUSE',
      'GAME_RESUME',
      'GAME_END',
      'ROUND_START',
      'ROUND_COMPLETE',
      'SCORE_UPDATE',
      'BATCH_SCORE_UPDATE',
      'PLAYER_ADD',
      'PLAYER_REMOVE',
      'PLAYER_UPDATE',
      'BID_PLACED',
      'BID_UPDATE',
      'TRICK_RECORDED',
      'TRICK_UPDATE',
      'STATE_RESTORE',
      'STATE_MERGE'
    ]
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  timestamp: {
    type: Number,
    required: true,
    index: true
  },
  localVersion: {
    type: Number,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  clientId: {
    type: String,
    index: true
  },
  serverVersion: {
    type: Number,
    required: true,
    index: true
  },
  acknowledged: {
    type: Boolean,
    default: true // Events in DB are always acknowledged
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
gameEventSchema.index({ gameId: 1, serverVersion: 1 });
gameEventSchema.index({ gameId: 1, timestamp: 1 });

// Prevent duplicate events
gameEventSchema.index({ gameId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('GameEvent', gameEventSchema);
