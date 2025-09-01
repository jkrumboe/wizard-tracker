const express = require('express');
const OnlineStatus = require('../models/OnlineStatus');
const auth = require('../middleware/auth');
const router = express.Router();

/**
 * GET /api/online/status
 * Get the current online status (public endpoint)
 */
router.get('/status', async (req, res) => {
  try {
    // Get the latest status document
    let statusDoc = await OnlineStatus.findOne().sort({ updatedAt: -1 });
    
    // If no status document exists, create one with default online status
    if (!statusDoc) {
      statusDoc = new OnlineStatus({
        status: true,
        message: 'All features are available',
        updatedBy: 'system'
      });
      await statusDoc.save();
    }

    res.json({
      online: statusDoc.status,
      message: statusDoc.status ? 
        'All features are available' : 
        'Online features are currently disabled for maintenance',
      lastUpdated: statusDoc.updatedAt,
      updatedBy: statusDoc.updatedBy
    });
  } catch (error) {
    console.error('Error getting online status:', error);
    // If there's an error, default to offline mode for safety
    res.json({
      online: false,
      message: 'Error checking online status - operating in offline mode',
      lastUpdated: new Date(),
      updatedBy: 'system'
    });
  }
});

/**
 * POST /api/online/toggle
 * Toggle the online status (requires authentication)
 */
router.post('/toggle', auth, async (req, res) => {
  try {
    const { status, message } = req.body;
    
    // Get current status or create new one
    let statusDoc = await OnlineStatus.findOne().sort({ updatedAt: -1 });
    
    if (statusDoc) {
      // Update existing document
      statusDoc.status = status !== undefined ? status : !statusDoc.status;
      statusDoc.message = message || (statusDoc.status ? 
        'All features are available' : 
        'Online features are currently disabled for maintenance');
      statusDoc.updatedBy = req.user.username || req.user.id;
      statusDoc.updatedAt = new Date();
    } else {
      // Create new document
      statusDoc = new OnlineStatus({
        status: status !== undefined ? status : true,
        message: message || 'All features are available',
        updatedBy: req.user.username || req.user.id
      });
    }
    
    await statusDoc.save();
    
    res.json({
      success: true,
      online: statusDoc.status,
      message: statusDoc.message,
      lastUpdated: statusDoc.updatedAt,
      updatedBy: statusDoc.updatedBy
    });
  } catch (error) {
    console.error('Error updating online status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update online status'
    });
  }
});

/**
 * PUT /api/online/status
 * Set specific online status (requires authentication)
 */
router.put('/status', auth, async (req, res) => {
  try {
    const { status, message } = req.body;
    
    if (typeof status !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Status must be a boolean value'
      });
    }
    
    // Get current status or create new one
    let statusDoc = await OnlineStatus.findOne().sort({ updatedAt: -1 });
    
    if (statusDoc) {
      // Update existing document
      statusDoc.status = status;
      statusDoc.message = message || (status ? 
        'All features are available' : 
        'Online features are currently disabled for maintenance');
      statusDoc.updatedBy = req.user.username || req.user.id;
      statusDoc.updatedAt = new Date();
    } else {
      // Create new document
      statusDoc = new OnlineStatus({
        status,
        message: message || (status ? 
          'All features are available' : 
          'Online features are currently disabled for maintenance'),
        updatedBy: req.user.username || req.user.id
      });
    }
    
    await statusDoc.save();
    
    res.json({
      success: true,
      online: statusDoc.status,
      message: statusDoc.message,
      lastUpdated: statusDoc.updatedAt,
      updatedBy: statusDoc.updatedBy
    });
  } catch (error) {
    console.error('Error setting online status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set online status'
    });
  }
});

module.exports = router;
