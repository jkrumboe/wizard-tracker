const jwt = require('jsonwebtoken');
const User = require('../models/User');
const cache = require('../utils/redis');
const { dualReadWithFallback } = require('../utils/dualWrite');
const { getPrisma } = require('../database');
const UserRepository = require('../repositories/UserRepository');

const auth = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Try to get user from cache first
    const cacheKey = `user:${decoded.userId}`;
    let user = null;
    
    if (cache.isConnected) {
      user = await cache.get(cacheKey);
      if (user) {
        // Convert cached plain object back to a mongoose-like object
        req.user = user;
        return next();
      }
    }
    
    // ========== DUAL-READ: Try PostgreSQL first, fallback to MongoDB ==========
    user = await dualReadWithFallback(
      // MongoDB read
      async () => {
        const mongoUser = await User.findById(decoded.userId).select('-passwordHash').lean();
        if (!mongoUser) return null;
        
        // Normalize MongoDB user for consistency
        return {
          id: mongoUser._id.toString(),
          _id: mongoUser._id, // Keep for backwards compatibility
          username: mongoUser.username,
          role: mongoUser.role || 'user',
          lastLogin: mongoUser.lastLogin,
          profilePicture: mongoUser.profilePicture,
          createdAt: mongoUser.createdAt,
          updatedAt: mongoUser.updatedAt
        };
      },
      // PostgreSQL read
      async () => {
        const prisma = getPrisma();
        const pgUser = await UserRepository.findById(prisma, decoded.userId);
        if (!pgUser) return null;
        
        // Normalize PostgreSQL user for consistency
        return {
          id: pgUser.id,
          _id: pgUser.id, // For backwards compatibility
          username: pgUser.username,
          role: pgUser.role,
          lastLogin: pgUser.lastLogin,
          profilePicture: pgUser.profilePicture,
          createdAt: pgUser.createdAt,
          updatedAt: pgUser.updatedAt
        };
      }
    );
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Ensure role field exists (for backwards compatibility with old user documents)
    if (!user.role) {
      user.role = 'user';
    }
    
    // Cache user for 15 minutes
    if (cache.isConnected) {
      await cache.set(cacheKey, user, 900);
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = auth;
