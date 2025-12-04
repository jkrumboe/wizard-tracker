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
    skip: (req) => req.path === '/api/health',
    store
  });
};

// General rate limiter for all routes
const generalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

// Strict rate limiter for authentication endpoints
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login/register attempts per windowMs
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: false, // Count successful requests too
});

// Rate limiter for API endpoints
const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 API requests per windowMs
  message: 'Too many API requests, please try again later.',
});

// Rate limiter for admin endpoints (stricter)
const adminLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 admin requests per windowMs
  message: 'Too many admin requests, please try again later.',
});

module.exports = {
  generalLimiter,
  authLimiter,
  apiLimiter,
  adminLimiter
};
