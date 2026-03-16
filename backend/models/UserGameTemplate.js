const mongoose = require('mongoose');

// User's Personal Cloud Templates
const userGameTemplateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  localId: {
    type: String,
    required: false, // For syncing with local storage
    index: true
  },
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true
  },
  targetNumber: {
    type: Number,
    default: null
  },
  lowIsBetter: {
    type: Boolean,
    default: false
  },
  gameCategory: {
    type: String,
    enum: ['table', 'callAndMade'],
    default: 'table'
  },
  scoringFormula: {
    baseCorrect: { type: Number, default: null },
    bonusPerTrick: { type: Number, default: null },
    penaltyPerDiff: { type: Number, default: null }
  },
  roundPattern: {
    type: String,
    enum: ['pyramid', 'ascending', 'fixed', null],
    default: null
  },
  maxRounds: {
    type: Number,
    default: null
  },
  hasDealerRotation: {
    type: Boolean,
    default: true
  },
  hasForbiddenCall: {
    type: Boolean,
    default: true
  },
  usageCount: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    default: ''
  },
  descriptionMarkdown: {
    type: String,
    default: '',
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  approvedAsSystemTemplate: {
    type: Boolean,
    default: false
  },
  systemTemplateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SystemGameTemplate',
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
userGameTemplateSchema.index({ userId: 1, name: 1 });
userGameTemplateSchema.index({ userId: 1, localId: 1 });

const UserGameTemplate = mongoose.model('UserGameTemplate', userGameTemplateSchema);

module.exports = UserGameTemplate;
