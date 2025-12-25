const express = require('express');
const PlayerIdentity = require('../models/PlayerIdentity');
const User = require('../models/User');
const auth = require('../middleware/auth');
const identityService = require('../utils/identityService');
const router = express.Router();

/**
 * Identity Management Routes
 * 
 * Provides endpoints for managing player identities:
 * - Search and list identities
 * - View identity details
 * - Admin: Merge, assign, split identities
 * - User: View own identities
 */

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ============================================
// Public/User Routes
// ============================================

/**
 * GET /identities/search
 * Search for identities (for game player selection)
 */
router.get('/search', auth, async (req, res, next) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    
    const result = await identityService.searchIdentities(q, {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 50)
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /identities/me
 * Get current user's identities
 */
router.get('/me', auth, async (req, res, next) => {
  try {
    const identities = await PlayerIdentity.findByUserId(req.user._id);
    const stats = await identityService.getUserStats(req.user._id);
    
    res.json({
      identities,
      stats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /identities/:id
 * Get identity details
 */
router.get('/:id', auth, async (req, res, next) => {
  try {
    const details = await identityService.getIdentityDetails(req.params.id);
    
    if (!details) {
      return res.status(404).json({ error: 'Identity not found' });
    }
    
    res.json(details);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /identities/:id/alias
 * Add an alias to an identity (user can add to their own identities)
 */
router.post('/:id/alias', auth, async (req, res, next) => {
  try {
    const { alias } = req.body;
    
    if (!alias || typeof alias !== 'string') {
      return res.status(400).json({ error: 'Valid alias name is required' });
    }
    
    const identity = await PlayerIdentity.findById(req.params.id);
    
    if (!identity) {
      return res.status(404).json({ error: 'Identity not found' });
    }
    
    // Users can only add aliases to their own identities
    if (!identity.userId?.equals(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only add aliases to your own identities' });
    }
    
    await identity.addAlias(alias.trim(), req.user._id);
    
    res.json({
      message: 'Alias added successfully',
      identity
    });
  } catch (error) {
    if (error.message.includes('already in use')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * DELETE /identities/:id/alias/:aliasName
 * Remove an alias from an identity
 */
router.delete('/:id/alias/:aliasName', auth, async (req, res, next) => {
  try {
    const identity = await PlayerIdentity.findById(req.params.id);
    
    if (!identity) {
      return res.status(404).json({ error: 'Identity not found' });
    }
    
    // Users can only remove aliases from their own identities
    if (!identity.userId?.equals(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only remove aliases from your own identities' });
    }
    
    await identity.removeAlias(req.params.aliasName);
    
    res.json({
      message: 'Alias removed successfully',
      identity
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Admin Routes
// ============================================

/**
 * GET /identities/admin/all
 * Get all identities with filtering (admin only)
 */
router.get('/admin/all', auth, requireAdmin, async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      type, 
      linked, 
      search 
    } = req.query;
    
    const result = await identityService.getAllIdentities({
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100),
      type: type || null,
      linked: linked === 'true' ? true : linked === 'false' ? false : null,
      search: search || null
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /identities/admin/assign
 * Assign a guest identity to a user (admin only)
 */
router.post('/admin/assign', auth, requireAdmin, async (req, res, next) => {
  try {
    const { identityId, userId } = req.body;
    
    if (!identityId || !userId) {
      return res.status(400).json({ error: 'identityId and userId are required' });
    }
    
    const identity = await identityService.adminAssignIdentity(
      identityId,
      userId,
      req.user._id
    );
    
    res.json({
      message: 'Identity assigned successfully',
      identity
    });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('already linked')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * POST /identities/admin/merge
 * Merge multiple identities into one (admin only)
 */
router.post('/admin/merge', auth, requireAdmin, async (req, res, next) => {
  try {
    const { targetId, sourceIds } = req.body;
    
    if (!targetId || !Array.isArray(sourceIds) || sourceIds.length === 0) {
      return res.status(400).json({ 
        error: 'targetId and sourceIds array are required' 
      });
    }
    
    // Validate that sourceIds don't include targetId
    if (sourceIds.includes(targetId)) {
      return res.status(400).json({ 
        error: 'Cannot merge an identity into itself' 
      });
    }
    
    const identity = await identityService.adminMergeIdentities(
      targetId,
      sourceIds,
      req.user._id
    );
    
    res.json({
      message: `Successfully merged ${sourceIds.length} identities`,
      identity
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * POST /identities/admin/split
 * Split an alias into a new identity (admin only)
 */
router.post('/admin/split', auth, requireAdmin, async (req, res, next) => {
  try {
    const { identityId, aliasName } = req.body;
    
    if (!identityId || !aliasName) {
      return res.status(400).json({ 
        error: 'identityId and aliasName are required' 
      });
    }
    
    const newIdentity = await identityService.adminSplitIdentity(
      identityId,
      aliasName,
      req.user._id
    );
    
    res.json({
      message: 'Identity split successfully',
      identity: newIdentity
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * POST /identities/admin/unlink/:id
 * Unlink an identity from its user (admin only)
 */
router.post('/admin/unlink/:id', auth, requireAdmin, async (req, res, next) => {
  try {
    const identity = await PlayerIdentity.findById(req.params.id);
    
    if (!identity) {
      return res.status(404).json({ error: 'Identity not found' });
    }
    
    if (!identity.userId) {
      return res.status(400).json({ error: 'Identity is not linked to any user' });
    }
    
    await identity.unlinkFromUser();
    
    res.json({
      message: 'Identity unlinked successfully',
      identity
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /identities/admin/:id
 * Soft delete an identity (admin only)
 */
router.delete('/admin/:id', auth, requireAdmin, async (req, res, next) => {
  try {
    const identity = await PlayerIdentity.findById(req.params.id);
    
    if (!identity) {
      return res.status(404).json({ error: 'Identity not found' });
    }
    
    await identity.softDelete();
    
    res.json({
      message: 'Identity deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /identities/admin/:id/restore
 * Restore a soft-deleted identity (admin only)
 */
router.post('/admin/:id/restore', auth, requireAdmin, async (req, res, next) => {
  try {
    const identity = await PlayerIdentity.findById(req.params.id);
    
    if (!identity) {
      return res.status(404).json({ error: 'Identity not found' });
    }
    
    await identity.restore();
    
    res.json({
      message: 'Identity restored successfully',
      identity
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /identities/admin/:id/recalculate
 * Recalculate statistics for an identity (admin only)
 */
router.post('/admin/:id/recalculate', auth, requireAdmin, async (req, res, next) => {
  try {
    const identity = await PlayerIdentity.findById(req.params.id);
    
    if (!identity) {
      return res.status(404).json({ error: 'Identity not found' });
    }
    
    await identity.recalculateStats();
    
    res.json({
      message: 'Statistics recalculated successfully',
      stats: identity.stats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /identities/admin/recalculate-all
 * Recalculate statistics for all identities (admin only)
 */
router.post('/admin/recalculate-all', auth, requireAdmin, async (req, res, next) => {
  try {
    const identities = await PlayerIdentity.find({ isDeleted: false });
    let updated = 0;
    let errors = 0;
    
    for (const identity of identities) {
      try {
        await identity.recalculateStats();
        updated++;
      } catch (e) {
        errors++;
        console.error(`Failed to recalculate stats for ${identity._id}:`, e);
      }
    }
    
    res.json({
      message: 'Statistics recalculated',
      updated,
      errors,
      total: identities.length
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
