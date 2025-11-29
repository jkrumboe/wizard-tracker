const mongoose = require('mongoose');

// System/Preinstalled Templates - Available to all users
const systemGameTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true,
    unique: true
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
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

systemGameTemplateSchema.index({ name: 1 });
systemGameTemplateSchema.index({ isActive: 1 });

const SystemGameTemplate = mongoose.model('SystemGameTemplate', systemGameTemplateSchema);

module.exports = SystemGameTemplate;
