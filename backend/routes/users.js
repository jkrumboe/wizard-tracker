const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// POST /users/register - Create new user
router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new User({
      username,
      passwordHash
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        createdAt: user.createdAt,
        profilePicture: user.profilePicture || null
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /users/login - Verify credentials and return JWT
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        createdAt: user.createdAt,
        profilePicture: user.profilePicture || null
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /users/me - Get current user info (protected route)
router.get('/me', auth, async (req, res, next) => {
  try {
    // User is already attached to req by auth middleware
    res.json({
      user: {
        id: req.user._id,
        username: req.user.username,
        createdAt: req.user.createdAt,
        profilePicture: req.user.profilePicture || null
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /users/lookup/:username - Look up user by username (public endpoint for game player lookup)
router.get('/lookup/:username', async (req, res, next) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Case-insensitive username lookup
    const user = await User.findOne({ 
      username: { $regex: new RegExp(`^${username}$`, 'i') } 
    }).select('_id username createdAt');

    if (!user) {
      return res.status(404).json({ 
        found: false,
        message: 'User not found' 
      });
    }

    res.json({
      found: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /users/me/profile-picture - Update profile picture (protected route)
router.put('/me/profile-picture', auth, async (req, res, next) => {
  try {
    const { profilePicture } = req.body;

    // 1. Validate profile picture data exists
    if (!profilePicture || typeof profilePicture !== 'string') {
      return res.status(400).json({ error: 'Valid profile picture data is required' });
    }

    // 2. Check if it's a valid base64 data URL with proper format
    if (!profilePicture.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Profile picture must be a valid image data URL' });
    }

    // 3. Validate image type (whitelist only safe formats)
    const allowedTypes = [
      'data:image/jpeg',
      'data:image/jpg', 
      'data:image/png',
      'data:image/gif',
      'data:image/webp'
    ];
    
    const hasValidType = allowedTypes.some(type => profilePicture.startsWith(type));
    if (!hasValidType) {
      return res.status(400).json({ error: 'Only JPEG, PNG, GIF, and WebP images are allowed' });
    }

    // 4. Validate base64 format
    const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
    if (!base64Regex.test(profilePicture)) {
      return res.status(400).json({ error: 'Invalid base64 image format' });
    }

    // 5. Extract and validate base64 data
    const base64Data = profilePicture.split(',')[1];
    if (!base64Data || base64Data.length === 0) {
      return res.status(400).json({ error: 'Empty image data' });
    }

    // 6. Validate base64 encoding (allow whitespace which will be cleaned)
    // Remove any whitespace/newlines that might be in the base64 string
    const cleanBase64 = base64Data.replace(/\s/g, '');
    const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Pattern.test(cleanBase64)) {
      return res.status(400).json({ error: 'Invalid base64 encoding' });
    }

    // Reconstruct the profile picture with cleaned base64
    const mimeType = profilePicture.split(',')[0];
    const cleanedProfilePicture = `${mimeType},${cleanBase64}`;
    
    // 7. Check size limits (use cleaned version for accurate size check)
    // 7. Check size limits (use cleaned version for accurate size check)
    const minSize = 100; // Minimum ~75 bytes original
    const maxSize = 10485760; // ~7.5MB original (10MB base64)
    
    if (cleanedProfilePicture.length < minSize) {
      return res.status(400).json({ error: 'Image file is too small or corrupted' });
    }
    
    if (cleanedProfilePicture.length > maxSize) {
      return res.status(400).json({ error: 'Profile picture is too large (max 5MB)' });
    }

    // 8. Additional security: Check for common malicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /onerror=/i,
      /onload=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(cleanedProfilePicture))) {
      return res.status(400).json({ error: 'Invalid image content detected' });
    }

    // Update the profile picture (use cleaned version)
    req.user.profilePicture = cleanedProfilePicture;
    await req.user.save();

    res.json({
      message: 'Profile picture updated successfully',
      user: {
        id: req.user._id,
        username: req.user.username,
        createdAt: req.user.createdAt,
        profilePicture: req.user.profilePicture
      }
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /users/me/profile-picture - Delete profile picture (protected route)
router.delete('/me/profile-picture', auth, async (req, res, next) => {
  try {
    // Remove the profile picture
    req.user.profilePicture = null;
    await req.user.save();

    res.json({
      message: 'Profile picture deleted successfully',
      user: {
        id: req.user._id,
        username: req.user.username,
        createdAt: req.user.createdAt,
        profilePicture: null
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /users/me/profile-picture - Get profile picture URL (protected route)
router.get('/me/profile-picture', auth, async (req, res, next) => {
  try {
    res.json({
      profilePicture: req.user.profilePicture || null
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /users/:userId/name - Update user's username (protected route)
router.patch('/:userId/name', auth, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { name } = req.body;

    // Verify the user is updating their own username
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only update your own username' });
    }

    // Validate name
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Valid username is required' });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 3 || trimmedName.length > 50) {
      return res.status(400).json({ error: 'Username must be between 3 and 50 characters' });
    }

    // Check if username already exists (case-insensitive)
    const existingUser = await User.findOne({ 
      username: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
      _id: { $ne: req.user._id }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Update the username
    req.user.username = trimmedName;
    await req.user.save();

    // Generate new JWT with updated username
    const token = jwt.sign(
      { userId: req.user._id, username: req.user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Username updated successfully',
      token,
      user: {
        id: req.user._id,
        username: req.user.username,
        createdAt: req.user.createdAt,
        profilePicture: req.user.profilePicture || null
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
