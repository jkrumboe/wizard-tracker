const crypto = require('crypto');

const errorHandler = (err, req, res, next) => {
  const requestId = req.id || crypto.randomUUID();
  console.error(`[${requestId}]`, err.stack);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ error: 'Validation Error', details: errors, requestId });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({ error: `${field} already exists`, requestId });
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format', requestId });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token', requestId });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired', requestId });
  }

  // Default error
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    requestId
  });
};

module.exports = errorHandler;
