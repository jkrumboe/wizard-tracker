const mongoose = require('mongoose');

const onlineStatusSchema = new mongoose.Schema({
  status: {
    type: Boolean,
    required: true,
    default: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: String,
    default: 'system'
  },
  message: {
    type: String,
    default: 'All features are available'
  }
}, {
  timestamps: true
});

// Ensure only one status document exists
onlineStatusSchema.index({ status: 1 }, { unique: false });

const OnlineStatus = mongoose.model('OnlineStatus', onlineStatusSchema);

module.exports = OnlineStatus;
