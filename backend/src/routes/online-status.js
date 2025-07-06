/**
 * Online Status Route
 * 
 * Provides information about the server's online status.
 */

import express from 'express';
import { getOnlineStatus } from '../config/online-mode.js';

const router = express.Router();

// Get the current online status
router.get('/status', (req, res) => {
  const status = getOnlineStatus();
  
  res.json({
    online: status.online,
    lastUpdated: status.lastUpdated,
    message: status.online ? 
      'All features are available' : 
      'Online features are disabled. Only local features are available.'
  });
});

export default router;
