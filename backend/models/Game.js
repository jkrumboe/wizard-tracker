const mongoose = require('mongoose');


const gameSchema = new mongoose.Schema({
  userId: {
    // Accept either ObjectId or String for unauthenticated games
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'User ID is required']
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
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries by user and creation date
gameSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Game', gameSchema);
