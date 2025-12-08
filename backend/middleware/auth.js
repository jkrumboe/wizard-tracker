const jwt = require('jsonwebtoken');
const User = require('../models/User');
const cache = require('../utils/redis');

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
    
    // Get user from database if not in cache
    user = await User.findById(decoded.userId).select('-passwordHash').lean();
    
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
