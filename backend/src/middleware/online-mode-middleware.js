import { isOnline, getOnlineStatus } from '../config/online-mode.js';

// Create a middleware that checks online status for specific endpoints
export function requireOnlineMode(req, res, next) {
  // Skip check for status endpoint so client can always check server status
  if (req.path === '/api/status' || req.path === '/api/online/status') {
    return next();
  }
  
  // Check for paths that should require online mode
  const requiresOnline = [
    '/api/multiplayer',
    '/api/leaderboard',
    '/api/rankings',
    '/api/tournaments',
    '/api/rooms',
    '/api/games/online',
    '/api/players/online',
    '/api/stats/global',
    '/api/colyseus',
    // Add more online-only paths as needed
  ];
  
  const isProtectedPath = requiresOnline.some(path => req.path.startsWith(path));
  
  if (isProtectedPath && !isOnline()) {
    return res.status(503).json({
      error: 'Online features are currently disabled',
      status: 'offline',
      message: 'The server is currently in offline mode. Only local features are available.'
    });
  }
  
  next();
}

// Export other helpful functions
export function getOnlineStatusInfo() {
  return getOnlineStatus();
}

export default {
  requireOnlineMode,
  isOnline,
  getOnlineStatusInfo
};
