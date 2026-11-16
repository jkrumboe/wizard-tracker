const mongoose = require('mongoose');

/**
 * A photo attached to a table game (e.g. the final board of a Catan game).
 * The client downscales images before upload, so each is a few hundred KB and
 * is stored inline. Kept out of TableGame so game queries never load images.
 */
const gamePhotoSchema = new mongoose.Schema({
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TableGame',
    required: true,
    index: true
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

module.exports = mongoose.model('GamePhoto', gamePhotoSchema);
