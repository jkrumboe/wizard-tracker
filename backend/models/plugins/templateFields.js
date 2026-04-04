const mongoose = require('mongoose');

/**
 * Mongoose plugin that adds the shared game template fields.
 * Used by SystemGameTemplate, UserGameTemplate, and TemplateSuggestion
 * to avoid duplicating the common schema definition.
 * 
 * @param {mongoose.Schema} schema 
 * @param {Object} options
 * @param {number} [options.descriptionMaxLength=7500] - Max length for descriptionMarkdown
 * @param {boolean} [options.includeUsageCount=true] - Whether to include usageCount field
 */
function templateFieldsPlugin(schema, options = {}) {
  const { descriptionMaxLength = 7500, includeUsageCount = true } = options;

  const fields = {
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
    },
    targetNumber: {
      type: Number,
      default: null,
    },
    lowIsBetter: {
      type: Boolean,
      default: false,
    },
    gameCategory: {
      type: String,
      enum: ['table', 'callAndMade'],
      default: 'table',
    },
    scoringFormula: {
      baseCorrect: { type: Number, default: null },
      bonusPerTrick: { type: Number, default: null },
      penaltyPerDiff: { type: Number, default: null },
    },
    roundPattern: {
      type: String,
      enum: ['pyramid', 'ascending', 'fixed', null],
      default: null,
    },
    maxRounds: {
      type: Number,
      default: null,
    },
    hasDealerRotation: {
      type: Boolean,
      default: true,
    },
    hasForbiddenCall: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      default: '',
    },
    descriptionMarkdown: {
      type: String,
      default: '',
      maxlength: [descriptionMaxLength, `Description cannot exceed ${descriptionMaxLength} characters`],
    },
  };

  if (includeUsageCount) {
    fields.usageCount = {
      type: Number,
      default: 0,
    };
  }

  schema.add(fields);
}

module.exports = templateFieldsPlugin;
