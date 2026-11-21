const mongoose = require('mongoose');

/**
 * A photo attached to a finished game: the final board of a Catan game, a nice
 * hand of cards in Wizard...
 * The client downscales images before upload, so each is a few hundred KB and
 * is stored inline. Kept out of the game documents so game queries never load images.
 *
 * gameId is the _id of a TableGame or a WizardGame (gameType says which).
 * ObjectIds are unique across collections, so lookups by gameId alone are safe.
 */
const gamePhotoSchema = new mongoose.Schema({
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'gameModel',
    required: true,
    index: true
  },
  // Photos from before Wizard games had photos have no gameType: they are table games
  gameType: {
    type: String,
    enum: ['table', 'wizard'],
    default: 'table'
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Username at upload time, so the list needs no User lookup
  uploaderName: {
    type: String,
    default: null
  },
  contentType: {
    type: String,
    enum: ['image/jpeg', 'image/png', 'image/webp'],
    required: true
  },
  data: {
    type: Buffer,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  width: {
    type: Number,
    default: null
  },
  height: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

gamePhotoSchema.index({ gameId: 1, createdAt: 1 });

// Model name for populate('gameId')
gamePhotoSchema.virtual('gameModel').get(function() {
  return this.gameType === 'wizard' ? 'WizardGame' : 'TableGame';
});

module.exports = mongoose.model('GamePhoto', gamePhotoSchema);
