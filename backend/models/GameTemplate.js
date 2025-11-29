const mongoose = require('mongoose');

const gameTemplateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // null for system/admin templates
    index: true
  },
  localId: {
    type: String,
    required: false, // Only for synced user templates
    index: true
  },
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['system', 'user', 'suggested'],
    default: 'user',
    index: true
  },
  targetNumber: {
    type: Number,
    default: null
  },
  lowIsBetter: {
    type: Boolean,
    default: false
  },
  usageCount: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    default: ''
  },
  // For suggested templates
  suggestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  suggestionNote: {
    type: String,
    default: ''
  },
  approved: {
    type: Boolean,
    default: false
  },
  // System templates are visible to all users
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient queries
gameTemplateSchema.index({ userId: 1, type: 1 });
gameTemplateSchema.index({ type: 1, isPublic: 1 });
gameTemplateSchema.index({ type: 1, approved: 1 });

const GameTemplate = mongoose.model('GameTemplate', gameTemplateSchema);

module.exports = GameTemplate;
