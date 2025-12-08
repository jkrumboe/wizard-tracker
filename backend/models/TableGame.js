const mongoose = require('mongoose');

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

module.exports = mongoose.model('TableGame', tableGameSchema);
