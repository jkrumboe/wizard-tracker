const mongoose = require('mongoose');

// Template Suggestions from users to admin
const templateSuggestionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userTemplateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserGameTemplate',
    default: null
  },
  systemTemplateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SystemGameTemplate',
    default: null
  },
  builtinTemplateId: {
    type: String,
    default: null
  },
  suggestionType: {
    type: String,
    enum: ['new', 'change'],
    default: 'new'
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
  description: {
    type: String,
    default: ''
  },
  descriptionMarkdown: {
    type: String,
    default: '',
    maxlength: [7500, 'Description cannot exceed 7500 characters']
  },
  suggestionNote: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  reviewNote: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for efficient queries
templateSuggestionSchema.index({ status: 1, createdAt: -1 });
templateSuggestionSchema.index({ userId: 1, status: 1 });
templateSuggestionSchema.index({ builtinTemplateId: 1, status: 1 });

const TemplateSuggestion = mongoose.model('TemplateSuggestion', templateSuggestionSchema);

module.exports = TemplateSuggestion;
