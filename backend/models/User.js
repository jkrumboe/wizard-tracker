const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [20, 'Username cannot exceed 20 characters']
  },
  passwordHash: {
    type: String,
    required: function() {
      // Password not required for guest users or deleted accounts
      return this.role !== 'guest' && !this.isDeleted;
    }
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'guest'],
    default: 'user'
  },
  // For guest users, track who created them
  guestMetadata: {
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    originalGuestId: {
      type: String,
      default: null
    }
  },
  lastLogin: {
    type: Date,
    default: null
  },
  profilePicture: {
    type: String,
    default: null,
    // Base64 encoded image data
    maxlength: [10485760, 'Profile picture cannot exceed 10MB'] // ~7.5MB after base64 encoding
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  originalUsername: {
    type: String,
    default: null
  },
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Index for faster username lookups
userSchema.index({ username: 1 });

// Text index for username search
userSchema.index({ username: 'text' });

// Index for originalUsername lookups (for deleted users)
userSchema.index({ originalUsername: 1 });

// Index for friends array queries
userSchema.index({ friends: 1 });

// Index for role-based queries
userSchema.index({ role: 1 });

/**
 * Check if user is a guest
 */
userSchema.methods.isGuest = function() {
  return this.role === 'guest';
};

module.exports = mongoose.model('User', userSchema);
