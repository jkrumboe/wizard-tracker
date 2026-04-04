const mongoose = require('mongoose');
const templateFieldsPlugin = require('./plugins/templateFields');

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

userGameTemplateSchema.plugin(templateFieldsPlugin, { descriptionMaxLength: 5000 });

// Index for efficient queries
userGameTemplateSchema.index({ userId: 1, name: 1 });
userGameTemplateSchema.index({ userId: 1, localId: 1 });

const UserGameTemplate = mongoose.model('UserGameTemplate', userGameTemplateSchema);

module.exports = UserGameTemplate;
