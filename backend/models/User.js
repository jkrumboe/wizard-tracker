const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [50, 'Username cannot exceed 50 characters']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required']
  }
}, {
  timestamps: true
});

// Index for faster username lookups
userSchema.index({ username: 1 });

module.exports = mongoose.model('User', userSchema);
