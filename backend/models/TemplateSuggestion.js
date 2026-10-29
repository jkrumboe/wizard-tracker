const mongoose = require('mongoose');
const templateFieldsPlugin = require('./plugins/templateFields');

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
    // 'boxArt' only proposes new gameInfo (box art) for a system template
    enum: ['new', 'change', 'boxArt'],
    default: 'new'
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
  // Change requests: the template's fields when the request was made, so
  // approval applies only what the user changed (see templateSuggestionService)
  baseline: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewNote: {
    type: String,
    default: '',
    maxlength: 500
  }
}, {
  timestamps: true
});

templateSuggestionSchema.plugin(templateFieldsPlugin, { includeUsageCount: false });

// Index for efficient queries
templateSuggestionSchema.index({ status: 1, createdAt: -1 });
templateSuggestionSchema.index({ userId: 1, status: 1 });
templateSuggestionSchema.index({ builtinTemplateId: 1, status: 1 });

const TemplateSuggestion = mongoose.model('TemplateSuggestion', templateSuggestionSchema);

module.exports = TemplateSuggestion;
