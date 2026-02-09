const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const cache = require('../utils/redis');

let storeTypeLogged = false;

// Helper function to create rate limiter with optional Redis store
const createLimiter = (options) => {
  // Determine store configuration at initialization
  let store;
  if (cache.isConnected && cache.client) {
    if (!storeTypeLogged) {
      console.log('✅ Rate limiters using distributed Redis store');
      storeTypeLogged = true;
    }
    store = new RedisStore({
      sendCommand: (...args) => cache.client.sendCommand(args),
      prefix: 'rl:',
    });
  } else {
    if (!storeTypeLogged) {
      console.warn('⚠️ Rate limiters using memory store (Redis unavailable)');
      storeTypeLogged = true;
    }
    store = undefined; // Uses default memory store
  }

  return rateLimit({
    ...options,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      if (req.path === '/api/health') return true;
      // Also apply any custom skip logic from options
      if (options.skip && options.skip(req)) return true;
      return false;
    },
    store
  });
};

// General rate limiter for all routes
const generalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

// Strict rate limiter for authentication endpoints
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Increased from 50 to 200 to allow multiple users on same network
  message: 'Too many authentication attempts from this network. Please try again in 15 minutes.',
  skipSuccessfulRequests: true, // Don't count successful logins
  // Add handler to provide more helpful error response
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many authentication attempts from this network. Please try again in 15 minutes.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Rate limiter for API endpoints
const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 API requests per windowMs
  message: 'Too many API requests, please try again later.',
  skip: (req) => {
    // Skip for routes that have their own dedicated rate limiters
    return req.path.startsWith('/elo/recalculate') || 
           req.path.startsWith('/admin/');
  },
});

// Rate limiter for admin endpoints (stricter)
const adminLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 admin requests per windowMs
  message: 'Too many admin requests, please try again later.',
});

// Rate limiter for friends endpoints (high limit for polling)
// Friends modal polls frequently, so needs generous limits
const friendsLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // High limit to accommodate frequent polling
  message: 'Too many friend request checks, please try again later.',
  skipSuccessfulRequests: false, // Count all requests
});

// Rate limiter for public ELO endpoints (leaderboards, rankings)
// These are public but should be protected from abuse
const eloPublicLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per 15 min (enough for normal browsing)
  message: 'Too many ELO ranking requests, please try again later.',
});

// Rate limiter for ELO admin operations (recalculation)
// Moderate limit - recalculation is heavy but admins may need to retry
const eloAdminLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 recalculations per 15 minutes
  message: 'ELO recalculation limit reached. Please wait a few minutes and try again.',
});

module.exports = {
  generalLimiter,
  authLimiter,
  apiLimiter,
  adminLimiter,
  friendsLimiter,
  eloPublicLimiter,
  eloAdminLimiter
};
