const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const auth = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const _ = require('lodash'); // Added for escapeRegExp
const mongoose = require('mongoose');
const cache = require('../utils/redis');
const router = express.Router();

// POST /users/register - Create new user (with strict rate limiting)
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (typeof username !== "string") {
      return res.status(400).json({ error: 'Username must be a string' });
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
        role: user.role || 'user',
        createdAt: user.createdAt,
        profilePicture: user.profilePicture || null
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /users/login - Verify credentials and return JWT (with strict rate limiting)
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (typeof username !== "string") {
      return res.status(400).json({ error: "Invalid username format" });
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
        role: user.role || 'user',
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
        role: req.user.role || 'user',
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

    // Case-insensitive username lookup with regex safely escaped
    const safeUsername = _.escapeRegExp(username);
    const user = await User.findOne({ 
      username: { $regex: new RegExp(`^${safeUsername}$`, 'i') } 
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

    // Update the profile picture in the database
    // Note: req.user is a lean object, so we need to use findByIdAndUpdate
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { profilePicture: cleanedProfilePicture },
      { new: true, select: '-passwordHash' }
    ).lean();

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Clear the user cache so next request gets fresh data
    if (cache.isConnected) {
      await cache.del(`user:${req.user._id}`);
    }

    res.json({
      message: 'Profile picture updated successfully',
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        createdAt: updatedUser.createdAt,
        profilePicture: updatedUser.profilePicture
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

    // Escape regex metacharacters in trimmedName
    const escapedName = _.escapeRegExp(trimmedName);
    // Check if username already exists (case-insensitive)
    const existingUser = await User.findOne({ 
      username: { $regex: new RegExp(`^${escapedName}$`, 'i') },
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

// GET /users/all - Get all users (protected route)
router.get('/all', auth, async (req, res, next) => {
  try {
    // Get all users but exclude password and limit data
    const users = await User.find()
      .select('_id username createdAt profilePicture')
      .sort({ username: 1 })
      .lean(); // Use lean() for better performance

    res.json({
      users: users.map(user => ({
        id: user._id.toString(),
        username: user.username,
        createdAt: user.createdAt,
        profilePicture: user.profilePicture || null
      }))
    });
  } catch (error) {
    next(error);
  }
});

// GET /users/:userId/friends - Get user's friends list (protected route)
router.get('/:userId/friends', auth, async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Verify the user is requesting their own friends
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only view your own friends list' });
    }

    const user = await User.findById(userId).populate('friends', '_id username createdAt profilePicture');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      friends: user.friends.map(friend => ({
        id: friend._id.toString(),
        username: friend.username,
        createdAt: friend.createdAt,
        profilePicture: friend.profilePicture || null
      }))
    });
  } catch (error) {
    next(error);
  }
});

// POST /users/:userId/friends/:friendId - Add a friend (protected route)
router.post('/:userId/friends/:friendId', auth, async (req, res, next) => {
  try {
    const { userId, friendId } = req.params;

    // Verify the user is adding friends to their own list
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only manage your own friends list' });
    }

    // Can't add yourself as a friend
    if (userId === friendId) {
      return res.status(400).json({ error: 'You cannot add yourself as a friend' });
    }

    // Check if friend exists
    const friend = await User.findById(friendId);
    if (!friend) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already friends
    if (req.user.friends.includes(friendId)) {
      return res.status(400).json({ error: 'User is already in your friends list' });
    }

    // Add friend
    req.user.friends.push(friendId);
    await req.user.save();

    res.json({
      message: 'Friend added successfully',
      friend: {
        id: friend._id.toString(),
        username: friend.username,
        createdAt: friend.createdAt,
        profilePicture: friend.profilePicture || null
      }
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /users/:userId/friends/:friendId - Remove a friend (protected route)
router.delete('/:userId/friends/:friendId', auth, async (req, res, next) => {
  try {
    const { userId, friendId } = req.params;

    // Verify the user is removing friends from their own list
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only manage your own friends list' });
    }

    // Remove friend from current user's list
    req.user.friends = req.user.friends.filter(id => id.toString() !== friendId);
    await req.user.save();

    // Also remove current user from the other user's friends list (mutual unfriend)
    const friend = await User.findById(friendId);
    if (friend) {
      friend.friends = friend.friends.filter(id => id.toString() !== userId);
      await friend.save();
    }

    res.json({
      message: 'Friend removed successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ============ FRIEND REQUEST ROUTES ============

// POST /users/:userId/friend-requests - Send a friend request (protected route)
router.post('/:userId/friend-requests', auth, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { receiverId } = req.body;

    // Validate receiverId is a valid string and valid ObjectId
    if (typeof receiverId !== "string" || !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ error: "Invalid receiverId" });
    }

    // Verify the user is sending from their own account
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only send friend requests from your own account' });
    }

    // Can't send request to yourself
    if (userId === receiverId) {
      return res.status(400).json({ error: 'You cannot send a friend request to yourself' });
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already friends
    if (req.user.friends.includes(receiverId)) {
      return res.status(400).json({ error: 'You are already friends with this user' });
    }

    // Check if there's already a pending request between these users
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender: userId, receiver: receiverId, status: 'pending' },
        { sender: receiverId, receiver: userId, status: 'pending' }
      ]
    });

    if (existingRequest) {
      if (existingRequest.sender.toString() === userId) {
        return res.status(400).json({ error: 'You already sent a friend request to this user' });
      } else {
        return res.status(400).json({ error: 'This user already sent you a friend request. Check your pending requests.' });
      }
    }

    // Create new friend request
    const friendRequest = new FriendRequest({
      sender: userId,
      receiver: receiverId,
      status: 'pending'
    });

    await friendRequest.save();

    // Populate sender info for response
    await friendRequest.populate('sender', '_id username profilePicture createdAt');
    await friendRequest.populate('receiver', '_id username profilePicture createdAt');

    res.status(201).json({
      message: 'Friend request sent successfully',
      friendRequest: {
        id: friendRequest._id.toString(),
        sender: {
          id: friendRequest.sender._id.toString(),
          username: friendRequest.sender.username,
          profilePicture: friendRequest.sender.profilePicture || null,
          createdAt: friendRequest.sender.createdAt
        },
        receiver: {
          id: friendRequest.receiver._id.toString(),
          username: friendRequest.receiver.username,
          profilePicture: friendRequest.receiver.profilePicture || null,
          createdAt: friendRequest.receiver.createdAt
        },
        status: friendRequest.status,
        createdAt: friendRequest.createdAt
      }
    });
  } catch (error) {
    // Handle duplicate request error
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Friend request already exists' });
    }
    next(error);
  }
});

// GET /users/:userId/friend-requests/received - Get received friend requests (protected route)
router.get('/:userId/friend-requests/received', auth, async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Verify the user is requesting their own friend requests
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only view your own friend requests' });
    }

    const requests = await FriendRequest.find({
      receiver: userId,
      status: 'pending'
    })
    .populate('sender', '_id username profilePicture createdAt')
    .sort({ createdAt: -1 });

    res.json({
      requests: requests.map(req => ({
        id: req._id.toString(),
        sender: {
          id: req.sender._id.toString(),
          username: req.sender.username,
          profilePicture: req.sender.profilePicture || null,
          createdAt: req.sender.createdAt
        },
        status: req.status,
        createdAt: req.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
});

// GET /users/:userId/friend-requests/sent - Get sent friend requests (protected route)
router.get('/:userId/friend-requests/sent', auth, async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Verify the user is requesting their own friend requests
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only view your own friend requests' });
    }

    const requests = await FriendRequest.find({
      sender: userId,
      status: 'pending'
    })
    .populate('receiver', '_id username profilePicture createdAt')
    .sort({ createdAt: -1 });

    res.json({
      requests: requests.map(req => ({
        id: req._id.toString(),
        receiver: {
          id: req.receiver._id.toString(),
          username: req.receiver.username,
          profilePicture: req.receiver.profilePicture || null,
          createdAt: req.receiver.createdAt
        },
        status: req.status,
        createdAt: req.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
});

// POST /users/:userId/friend-requests/:requestId/accept - Accept a friend request (protected route)
router.post('/:userId/friend-requests/:requestId/accept', auth, async (req, res, next) => {
  try {
    const { userId, requestId } = req.params;

    // Verify the user is accepting their own friend request
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only accept your own friend requests' });
    }

    // Find the friend request
    const friendRequest = await FriendRequest.findById(requestId)
      .populate('sender', '_id username profilePicture createdAt')
      .populate('receiver', '_id username profilePicture createdAt');

    if (!friendRequest) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    // Verify the current user is the receiver
    if (friendRequest.receiver._id.toString() !== userId) {
      return res.status(403).json({ error: 'You can only accept friend requests sent to you' });
    }

    // Check if request is still pending
    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ error: 'This friend request has already been processed' });
    }

    // Update request status
    friendRequest.status = 'accepted';
    await friendRequest.save();

    // Add both users to each other's friends list
    const sender = await User.findById(friendRequest.sender._id);
    const receiver = await User.findById(friendRequest.receiver._id);

    if (!sender.friends.includes(receiver._id)) {
      sender.friends.push(receiver._id);
      await sender.save();
    }

    if (!receiver.friends.includes(sender._id)) {
      receiver.friends.push(sender._id);
      await receiver.save();
    }

    res.json({
      message: 'Friend request accepted',
      friend: {
        id: friendRequest.sender._id.toString(),
        username: friendRequest.sender.username,
        profilePicture: friendRequest.sender.profilePicture || null,
        createdAt: friendRequest.sender.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /users/:userId/friend-requests/:requestId/reject - Reject a friend request (protected route)
router.post('/:userId/friend-requests/:requestId/reject', auth, async (req, res, next) => {
  try {
    const { userId, requestId } = req.params;

    // Verify the user is rejecting their own friend request
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only reject your own friend requests' });
    }

    // Find the friend request
    const friendRequest = await FriendRequest.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    // Verify the current user is the receiver
    if (friendRequest.receiver.toString() !== userId) {
      return res.status(403).json({ error: 'You can only reject friend requests sent to you' });
    }

    // Check if request is still pending
    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ error: 'This friend request has already been processed' });
    }

    // Update request status
    friendRequest.status = 'rejected';
    await friendRequest.save();

    res.json({
      message: 'Friend request rejected'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /users/:userId/friend-requests/:requestId - Cancel a sent friend request (protected route)
router.delete('/:userId/friend-requests/:requestId', auth, async (req, res, next) => {
  try {
    const { userId, requestId } = req.params;

    // Verify the user is canceling their own friend request
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only cancel your own friend requests' });
    }

    // Find the friend request
    const friendRequest = await FriendRequest.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    // Verify the current user is the sender
    if (friendRequest.sender.toString() !== userId) {
      return res.status(403).json({ error: 'You can only cancel friend requests you sent' });
    }

    // Check if request is still pending
    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ error: 'This friend request has already been processed' });
    }

    // Delete the request
    await FriendRequest.findByIdAndDelete(requestId);

    res.json({
      message: 'Friend request cancelled'
    });
  } catch (error) {
    next(error);
  }
});

// GET /users/admin/all - Get all users with full details (admin only)
router.get('/admin/all', auth, async (req, res, next) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const users = await User.find()
      .select('_id username role createdAt lastLogin profilePicture')
      .sort({ username: 1 });

    res.json({
      users: users.map(user => ({
        _id: user._id.toString(),
        username: user.username,
        role: user.role || 'user',
        createdAt: user.createdAt,
        lastLogin: user.lastLogin || null,
        profilePicture: user.profilePicture || null
      }))
    });
  } catch (error) {
    next(error);
  }
});

// PUT /users/:userId/username - Update username across all database collections (admin only)
router.put('/:userId/username', auth, async (req, res, next) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;
    const { username } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const trimmedUsername = username.trim();

    // Check if username already exists (excluding current user)
    const existingUser = await User.findOne({ 
      username: trimmedUsername,
      _id: { $ne: userId }
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Get old username before updating
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const oldUsername = user.username;

    // Update username in User collection
    user.username = trimmedUsername;
    await user.save();

    // Update username in all Game documents where user is a player
    const Game = require('../models/Game');
    await Game.updateMany(
      { 'players.playerId': userId },
      { $set: { 'players.$[elem].playerName': trimmedUsername } },
      { arrayFilters: [{ 'elem.playerId': userId }] }
    );

    // Update username in all TableGame documents
    const TableGame = require('../models/TableGame');
    await TableGame.updateMany(
      { 'players.playerId': userId },
      { $set: { 'players.$[elem].playerName': trimmedUsername } },
      { arrayFilters: [{ 'elem.playerId': userId }] }
    );
    await TableGame.updateMany(
      { 'rounds.scores.playerId': userId },
      { $set: { 'rounds.$[].scores.$[elem].playerName': trimmedUsername } },
      { arrayFilters: [{ 'elem.playerId': userId }] }
    );

    // Update username in UserGameTemplate suggestions
    const UserGameTemplate = require('../models/UserGameTemplate');
    await UserGameTemplate.updateMany(
      { userId },
      { $set: { userName: trimmedUsername } }
    );

    // Update username in TemplateSuggestion
    const TemplateSuggestion = require('../models/TemplateSuggestion');
    await TemplateSuggestion.updateMany(
      { userId },
      { $set: { userName: trimmedUsername } }
    );

    console.log(`✅ Username updated from "${oldUsername}" to "${trimmedUsername}" across all collections`);

    res.json({
      message: 'Username updated successfully across all records',
      user: {
        _id: user._id,
        username: user.username,
        role: user.role || 'user',
        createdAt: user.createdAt
      },
      updatedCollections: [
        'User',
        'Game (players)',
        'TableGame (players and scores)',
        'UserGameTemplate',
        'TemplateSuggestion'
      ]
    });
  } catch (error) {
    console.error('Error updating username:', error);
    next(error);
  }
});

// PUT /users/:userId/role - Update user role (admin only)
router.put('/:userId/role', auth, async (req, res, next) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "user" or "admin"' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldRole = user.role || 'user';
    user.role = role;
    await user.save();

    console.log(`✅ User role updated from "${oldRole}" to "${role}" for user: ${user.username}`);

    res.json({
      message: 'User role updated successfully',
      user: {
        _id: user._id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    next(error);
  }
});

module.exports = router;

