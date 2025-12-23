const mongoose = require('mongoose');

/**
 * PlayerAlias Model
 * 
 * Stores mappings between player names (used in games) and registered user accounts.
 * This allows admins to manually link old player names to new registered users,
 * even when the names don't match exactly.
 * 
 * Use case: When a player registers as "JohnDoe" but previously played as "Johnny",
 * an alias can be created to link all "Johnny" games to the "JohnDoe" account.
 */
const playerAliasSchema = new mongoose.Schema({
  // The registered user this alias belongs to
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  
  // The player name (alias) used in games
  aliasName: {
    type: String,
    required: [true, 'Alias name is required'],
    trim: true,
    maxlength: [50, 'Alias name cannot exceed 50 characters']
  },
  
  // Admin who created this alias
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator ID is required']
  },
  
  // Optional notes about this alias mapping
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
    default: ''
  }
}, {
  timestamps: true
});

// Compound index: Each alias name can only be linked to one user
playerAliasSchema.index({ aliasName: 1 }, { unique: true });

// Index for finding all aliases for a user
playerAliasSchema.index({ userId: 1 });

// Index for searching by creator
playerAliasSchema.index({ createdBy: 1 });

module.exports = mongoose.model('PlayerAlias', playerAliasSchema);
