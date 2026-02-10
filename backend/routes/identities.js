const express = require('express');
const { query, param, body, validationResult } = require('express-validator');
const PlayerIdentity = require('../models/PlayerIdentity');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { eloPublicLimiter } = require('../middleware/rateLimiter');
const identityService = require('../utils/identityService');
const eloService = require('../utils/eloService');
const cache = require('../utils/redis');
const router = express.Router();

// Validation helper
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      validationErrors: errors.array() 
    });
  }
  next();
};

// Allowed game types for validation
const ALLOWED_GAME_TYPES = ['wizard', 'flip-7', 'dutch', 'table-flip-7', 'table-dutch', 'table-wizard'];

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
    
    // Invalidate leaderboard cache after stats recalculation
    if (cache.isConnected) {
      await cache.delPattern('leaderboard:*');
    }
    
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
    
    // Invalidate leaderboard cache after stats recalculation
    if (cache.isConnected) {
      await cache.delPattern('leaderboard:*');
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

// ============================================
// Player Linking Routes (Guest to User)
// ============================================

/**
 * GET /identities/link/suggestions
 * Get suggested guest identities to link to current user
 */
router.get('/link/suggestions', auth, async (req, res, next) => {
  try {
    const result = await identityService.getSuggestedIdentities(req.user._id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /identities/link/my-identities
 * Get all identities linked to current user
 */
router.get('/link/my-identities', auth, async (req, res, next) => {
  try {
    const result = await identityService.getUserIdentities(req.user._id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /identities/link/guest-identities
 * Get all identities for the linking UI
 * Returns both unlinked (guest) and linked identities with flags
 */
router.get('/link/guest-identities', auth, async (req, res, next) => {
  try {
    const { search, page = 1, limit = 100, includeLinked = 'true' } = req.query;
    
    // Get all guest user IDs
    const guestUsers = await User.find({ role: 'guest' }, '_id').lean();
    const guestUserIds = guestUsers.map(u => u._id);
    
    // Base filter
    let filter = {
      isDeleted: false
    };
    
    // If not including linked, only show unlinked/guest-linked identities
    if (includeLinked !== 'true') {
      filter.$or = [
        { userId: null, mergedInto: null },
        { userId: { $in: guestUserIds }, mergedInto: null },
        { type: 'guest', mergedInto: null } // Also include guest-type identities
      ];
    } else {
      // When including linked, show either unlinked OR merged identities
      // Also include guest-type identities that may be linked to users but not merged
      filter.$or = [
        { userId: null, mergedInto: null },
        { userId: { $in: guestUserIds }, mergedInto: null },
        { type: 'guest', mergedInto: null }, // Guest-type identities not yet merged
        { mergedInto: { $ne: null } }
      ];
    }
    
    if (search && typeof search === 'string' && search.length > 0 && search.length <= 100) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedSearch, 'i');
      
      if (filter.$or) {
        // Combine with existing $or using $and
        filter.$and = [
          { $or: filter.$or },
          { $or: [
            { displayName: { $regex: regex } },
            { 'aliases.name': { $regex: regex } },
            { 'userId.username': { $regex: regex } }
          ]}
        ];
        delete filter.$or;
      } else {
        filter.$or = [
          { displayName: { $regex: regex } },
          { 'aliases.name': { $regex: regex } }
        ];
      }
    }
    
    const sanitizedPage = Math.max(1, Math.min(parseInt(page) || 1, 1000));
    const sanitizedLimit = Math.max(1, Math.min(parseInt(limit) || 100, 200));
    const skip = (sanitizedPage - 1) * sanitizedLimit;
    
    const [identities, total] = await Promise.all([
      PlayerIdentity.find(filter)
        .populate('userId', 'username role profilePicture')
        .populate('mergedInto', 'displayName userId')
        .populate({
          path: 'mergedInto',
          populate: { path: 'userId', select: 'username role profilePicture' }
        })
        .sort({ displayName: 1 })
        .skip(skip)
        .limit(sanitizedLimit),
      PlayerIdentity.countDocuments(filter)
    ]);
    
    // Enrich identities with linking status and game counts
    const guestIdSet = new Set(guestUserIds.map(id => id.toString()));
    
    // Calculate game counts dynamically for all identities
    // Count both current identityId AND previousIdentityId (games transferred during linking)
    const WizardGame = require('../models/WizardGame');
    const identityIds = identities.map(id => id._id);
    
    const gameCounts = await WizardGame.aggregate([
      {
        $match: {
          $or: [
            { 'gameData.players.identityId': { $in: identityIds } },
            { 'gameData.players.previousIdentityId': { $in: identityIds } }
          ],
          isDeleted: { $ne: true }
        }
      },
      {
        $unwind: '$gameData.players'
      },
      {
        $match: {
          $or: [
            { 'gameData.players.identityId': { $in: identityIds } },
            { 'gameData.players.previousIdentityId': { $in: identityIds } }
          ]
        }
      },
      {
        $group: {
          _id: {
            $cond: {
              if: { $in: ['$gameData.players.identityId', identityIds] },
              then: '$gameData.players.identityId',
              else: '$gameData.players.previousIdentityId'
            }
          },
          gameCount: { $sum: 1 }
        }
      }
    ]);
    
    // Create a map of identity ID to game count
    const gameCountMap = new Map();
    gameCounts.forEach(gc => {
      gameCountMap.set(gc._id.toString(), gc.gameCount);
    });
    
    const enrichedIdentities = identities.map(identity => {
      const obj = identity.toObject();
      const userRole = identity.userId?.role;
      const userIdStr = identity.userId?._id?.toString();
      
      // Check if it's a merged guest identity (linked to a user)
      const isMerged = !!identity.mergedInto;
      
      obj.linkedToGuestUser = userIdStr && guestIdSet.has(userIdStr) && !isMerged;
      obj.linkedToUser = isMerged && identity.mergedInto?.userId ? {
        _id: identity.mergedInto.userId._id,
        username: identity.mergedInto.userId.username,
        role: identity.mergedInto.userId.role
      } : null;
      // Use dynamically calculated game count instead of cached stats
      obj.gameCount = gameCountMap.get(identity._id.toString()) || 0;
      obj.linkedAt = isMerged ? identity.updatedAt : null;
      
      return obj;
    });
    
    res.json({
      identities: enrichedIdentities,
      pagination: {
        page: sanitizedPage,
        limit: sanitizedLimit,
        total,
        pages: Math.ceil(total / sanitizedLimit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /identities/link
 * Link a guest identity to current user
 * This updates all games where the guest participated
 */
router.post('/link', auth, async (req, res, next) => {
  try {
    const { guestIdentityId } = req.body;
    
    if (!guestIdentityId) {
      return res.status(400).json({ error: 'guestIdentityId is required' });
    }
    
    const result = await identityService.linkGuestToUser(
      guestIdentityId,
      req.user._id,
      req.user._id
    );
    
    if (!result.success) {
      return res.status(400).json({ 
        error: result.errors[0] || 'Failed to link identity',
        errors: result.errors
      });
    }
    
    res.json({
      message: 'Guest identity linked successfully',
      guestIdentity: result.guestIdentity,
      userIdentity: result.userIdentity,
      gamesUpdated: result.gamesUpdated
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /identities/link/multiple
 * Link multiple guest identities to current user
 */
router.post('/link/multiple', auth, async (req, res, next) => {
  try {
    const { guestIdentityIds } = req.body;
    
    if (!Array.isArray(guestIdentityIds) || guestIdentityIds.length === 0) {
      return res.status(400).json({ error: 'guestIdentityIds array is required' });
    }
    
    if (guestIdentityIds.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 identities can be linked at once' });
    }
    
    const result = await identityService.linkMultipleGuestsToUser(
      guestIdentityIds,
      req.user._id,
      req.user._id
    );
    
    res.json({
      success: result.success,
      linked: result.linked,
      failed: result.failed,
      totalGamesUpdated: result.totalGamesUpdated
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /identities/unlink
 * Unlink a guest identity from current user (revert linking)
 */
router.post('/unlink', auth, async (req, res, next) => {
  try {
    const { guestIdentityId } = req.body;
    
    if (!guestIdentityId) {
      return res.status(400).json({ error: 'guestIdentityId is required' });
    }
    
    const result = await identityService.unlinkGuestFromUser(
      guestIdentityId,
      req.user._id,
      req.user._id
    );
    
    if (!result.success) {
      return res.status(400).json({ 
        error: result.errors[0] || 'Failed to unlink identity',
        errors: result.errors
      });
    }
    
    res.json({
      message: 'Guest identity unlinked successfully',
      gamesUpdated: result.gamesUpdated
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /identities/admin/link
 * Admin: Link a guest identity to any user
 */
router.post('/admin/link', auth, requireAdmin, async (req, res, next) => {
  try {
    const { guestIdentityId, userId } = req.body;
    
    if (!guestIdentityId || !userId) {
      return res.status(400).json({ error: 'guestIdentityId and userId are required' });
    }
    
    const result = await identityService.linkGuestToUser(
      guestIdentityId,
      userId,
      req.user._id
    );
    
    if (!result.success) {
      return res.status(400).json({ 
        error: result.errors[0] || 'Failed to link identity',
        errors: result.errors
      });
    }
    
    res.json({
      message: 'Guest identity linked successfully',
      guestIdentity: result.guestIdentity,
      userIdentity: result.userIdentity,
      gamesUpdated: result.gamesUpdated
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /identities/admin/unlink-guest
 * Admin: Unlink a guest identity from any user
 */
router.post('/admin/unlink-guest', auth, requireAdmin, async (req, res, next) => {
  try {
    const { guestIdentityId, userId } = req.body;
    
    if (!guestIdentityId || !userId) {
      return res.status(400).json({ error: 'guestIdentityId and userId are required' });
    }
    
    const result = await identityService.unlinkGuestFromUser(
      guestIdentityId,
      userId,
      req.user._id
    );
    
    if (!result.success) {
      return res.status(400).json({ 
        error: result.errors[0] || 'Failed to unlink identity',
        errors: result.errors
      });
    }
    
    res.json({
      message: 'Guest identity unlinked successfully',
      gamesUpdated: result.gamesUpdated
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ELO Rating Routes
// ============================================

/**
 * GET /identities/elo/rankings
 * Get ELO leaderboard for a specific game type (public)
 * Query params: gameType (required), page, limit, minGames
 */
router.get('/elo/rankings', 
  eloPublicLimiter,
  [
    query('gameType')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('gameType must be a string between 1-50 characters'),
    query('page')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('page must be an integer between 1-1000'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('limit must be an integer between 1-100'),
    query('minGames')
      .optional()
      .isInt({ min: 0, max: 1000 })
      .withMessage('minGames must be an integer between 0-1000')
  ],
  validate,
  async (req, res, next) => {
  try {
    const { 
      gameType = 'wizard',
      page = 1, 
      limit = 50, 
      minGames 
    } = req.query;
    
    const result = await eloService.getEloRankings({
      gameType,
      page: Math.max(1, parseInt(page)),
      limit: Math.min(100, Math.max(1, parseInt(limit))),
      minGames: minGames ? parseInt(minGames) : undefined
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /identities/elo/history/:id
 * Get ELO history for a specific identity and game type
 * Query params: gameType, limit
 */
router.get('/elo/history/:id',
  eloPublicLimiter,
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid identity ID format'),
    query('gameType')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('gameType must be a string between 1-50 characters'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('limit must be an integer between 1-50')
  ],
  validate,
  async (req, res, next) => {
  try {
    const { gameType = 'wizard', limit = 20 } = req.query;
    
    const result = await eloService.getEloHistory(
      req.params.id,
      { 
        gameType,
        limit: Math.min(50, parseInt(limit)) 
      }
    );
    
    if (!result) {
      return res.status(404).json({ error: 'Identity not found' });
    }
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /identities/elo/all/:id
 * Get all ELO ratings for an identity across all game types
 */
router.get('/elo/all/:id',
  eloPublicLimiter,
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid identity ID format')
  ],
  validate,
  async (req, res, next) => {
  try {
    const result = await eloService.getAllEloForIdentity(req.params.id);
    
    if (!result) {
      return res.status(404).json({ error: 'Identity not found' });
    }
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /identities/elo/me
 * Get current user's ELO rating and history for a specific game type
 * Query params: gameType (default: 'wizard')
 */
router.get('/elo/me', 
  auth, 
  [
    query('gameType')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('gameType must be a string between 1-50 characters')
  ],
  validate,
  async (req, res, next) => {
  try {
    const { gameType = 'wizard' } = req.query;
    
    // Find user's primary identity
    const identity = await PlayerIdentity.findOne({
      userId: req.user._id,
      isDeleted: false
    });
    
    if (!identity) {
      return res.json({
        hasIdentity: false,
        gameType,
        rating: eloService.CONFIG.DEFAULT_RATING,
        message: 'No identity linked to your account'
      });
    }
    
    const result = await eloService.getEloHistory(identity._id, { 
      gameType, 
      limit: 20 
    });
    
    // Also get all game types this user has ELO for
    const allElo = await eloService.getAllEloForIdentity(identity._id);
    
    res.json({
      hasIdentity: true,
      gameType,
      allGameTypes: allElo?.gameTypes || [],
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /identities/elo/me/all
 * Get current user's ELO ratings for ALL game types
 */
router.get('/elo/me/all', auth, async (req, res, next) => {
  try {
    // Find user's primary identity
    const identity = await PlayerIdentity.findOne({
      userId: req.user._id,
      isDeleted: false
    });
    
    if (!identity) {
      return res.json({
        hasIdentity: false,
        eloByGameType: {},
        gameTypes: [],
        message: 'No identity linked to your account'
      });
    }
    
    const result = await eloService.getAllEloForIdentity(identity._id);
    
    res.json({
      hasIdentity: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /identities/elo/recalculate
 * Admin: Recalculate all ELO ratings from scratch
 * Body: { dryRun: boolean, gameType?: string }
 */
router.post('/elo/recalculate', 
  auth, 
  requireAdmin,
  [
    body('dryRun')
      .optional()
      .isBoolean()
      .withMessage('dryRun must be a boolean'),
    body('gameType')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('gameType must be a string between 1-50 characters')
  ],
  validate,
  async (req, res, next) => {
  try {
    const { dryRun = true, gameType = null } = req.body;
    
    // This is a heavy operation, run it in the background
    // For now, run synchronously with timeout
    const result = await eloService.recalculateAllElo({ dryRun, gameType });
    
    // Invalidate leaderboard cache so fresh ELO data is served
    if (!dryRun && cache.isConnected) {
      await cache.delPattern('leaderboard:*');
      console.log('✅ Leaderboard cache invalidated after ELO recalculation');
    }
    
    res.json({
      message: dryRun ? 'Dry run complete' : 'ELO ratings recalculated',
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /identities/elo/config
 * Get ELO system configuration (public)
 */
router.get('/elo/config', eloPublicLimiter, (req, res) => {
  res.json({
    defaultRating: eloService.CONFIG.DEFAULT_RATING,
    minRating: eloService.CONFIG.MIN_RATING,
    minGamesForRanking: eloService.CONFIG.MIN_GAMES_FOR_RANKING,
    kFactors: eloService.CONFIG.K_FACTOR,
    gamesThresholds: eloService.CONFIG.GAMES_THRESHOLD
  });
});

module.exports = router;
