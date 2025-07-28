/**
 * Online Mode Middleware
 * 
 * This middleware checks if the system is in online mode
 * and blocks requests to multiplayer features if offline.
 */

import { isOnline } from '../config/online-mode.js';

/**
 * Middleware to check if online features are enabled
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function requireOnlineMode(req, res, next) {
  if (await isOnline()) {
    next(); // Allow the request to proceed
  } else {
    res.status(503).json({
      error: 'Online features are currently disabled',
      status: 'offline',
      message: 'The server is currently in offline mode. Only local features are available.'
    });
  }
}

export default requireOnlineMode;
