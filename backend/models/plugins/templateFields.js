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
    minPlayers: {
      type: Number,
      default: null,
    },
    maxPlayers: {
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
    // Box art and BoardGameGeek metadata, filled from barcode scans (see utils/gameInfo.js)
    gameInfo: {
      type: new mongoose.Schema({
        bggId: { type: Number, default: null },
        imageUrl: { type: String, default: null },
        thumbnailUrl: { type: String, default: null },
        minPlayers: { type: Number, default: null },
        maxPlayers: { type: Number, default: null },
        // Player counts the BGG community voted "Best" for
        bestPlayers: { type: [Number], default: undefined },
        playingTime: { type: Number, default: null },
        minPlayTime: { type: Number, default: null },
        maxPlayTime: { type: Number, default: null },
        minAge: { type: Number, default: null },
        yearPublished: { type: Number, default: null },
        // BGG complexity (1-5) and average rating (1-10)
        weight: { type: Number, default: null },
        rating: { type: Number, default: null },
        designers: { type: [String], default: undefined },
      }, { _id: false }),
      default: null,
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
