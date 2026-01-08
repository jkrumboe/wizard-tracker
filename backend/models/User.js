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
      // Password not required for guest users
      return this.role !== 'guest';
    }
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'guest'],
    default: 'user'
  },
  // For guest users, track who created them and when they were converted
  guestMetadata: {
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    convertedToUserAt: {
      type: Date,
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

// Index for friends array queries
userSchema.index({ friends: 1 });

// Index for role-based queries
userSchema.index({ role: 1 });

/**
 * Static method to create a guest user from a player name
 * Used when recording games with players who aren't registered
 */
userSchema.statics.findOrCreateGuest = async function(playerName, createdByUserId = null) {
  const normalizedName = playerName.toLowerCase().trim();
  
  // First try to find existing user (registered or guest)
  let user = await this.findOne({
    username: { $regex: new RegExp(`^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
  });
  
  if (user) {
    return { user, created: false };
  }
  
  // Create guest user
  user = await this.create({
    username: playerName.trim(),
    role: 'guest',
    passwordHash: null,
    guestMetadata: {
      createdByUserId,
      originalGuestId: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  });
  
  return { user, created: true };
};

/**
 * Convert guest user to registered user
 */
userSchema.methods.convertToUser = async function(passwordHash) {
  if (this.role !== 'guest') {
    throw new Error('User is already a registered user');
  }
  
  this.role = 'user';
  this.passwordHash = passwordHash;
  this.guestMetadata.convertedToUserAt = new Date();
  
  return this.save();
};

/**
 * Check if user is a guest
 */
userSchema.methods.isGuest = function() {
  return this.role === 'guest';
};

module.exports = mongoose.model('User', userSchema);
