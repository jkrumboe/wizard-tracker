const mongoose = require('mongoose');
const templateFieldsPlugin = require('./plugins/templateFields');

// System/Preinstalled Templates - Available to all users
const systemGameTemplateSchema = new mongoose.Schema({
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

systemGameTemplateSchema.plugin(templateFieldsPlugin);

// name must be unique for system templates
systemGameTemplateSchema.index({ name: 1 }, { unique: true });
systemGameTemplateSchema.index({ isActive: 1 });

const SystemGameTemplate = mongoose.model('SystemGameTemplate', systemGameTemplateSchema);

module.exports = SystemGameTemplate;
