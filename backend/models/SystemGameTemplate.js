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
  descriptionMarkdown: {
    type: String,
    default: '',
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
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

systemGameTemplateSchema.index({ name: 1 });
systemGameTemplateSchema.index({ isActive: 1 });

const SystemGameTemplate = mongoose.model('SystemGameTemplate', systemGameTemplateSchema);

module.exports = SystemGameTemplate;
