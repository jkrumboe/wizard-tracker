const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Game = require('../models/Game');
const WizardGame = require('../models/WizardGame');
const { migrateWizardGame, validateMigratedGame } = require('../utils/wizardGameMigration');
const { validateWizardGameData } = require('../schemas/wizardGameSchema');

/**
 * POST /api/wizard-games/migrate
 * Migrate games from legacy 'games' collection to new 'wizard' collection
 * Accepts either:
 * - Array of game IDs to migrate specific games
 * - userId to migrate all games for a user
 * - Empty body to migrate all legacy games (admin only)
 */
router.post('/migrate', auth, async (req, res) => {
  try {
    const { gameIds, migrateAll } = req.body;
    const userId = req.user._id;
    
    let gamesToMigrate = [];
    
    // Determine which games to migrate
    if (gameIds && Array.isArray(gameIds)) {
      // Validate all gameIds are valid ObjectIds to prevent injection
      const invalidIds = gameIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({
          error: 'Invalid game ID format',
          invalidIds: invalidIds
        });
      }

      // Migrate specific games (must belong to user)
      gamesToMigrate = await Game.find({
        _id: { $in: gameIds },
        userId: userId
      });
      
      if (gamesToMigrate.length !== gameIds.length) {
        return res.status(404).json({
          error: 'Some games not found or do not belong to you',
          found: gamesToMigrate.length,
          requested: gameIds.length
        });
      }
    } else if (migrateAll === true) {
      // Migrate all games for this user
      gamesToMigrate = await Game.find({ userId: userId });
    } else {
      return res.status(400).json({
        error: 'Must provide either gameIds array or migrateAll: true'
      });
    }
    
    if (gamesToMigrate.length === 0) {
      return res.status(404).json({
        message: 'No games found to migrate'
      });
    }
    
    // Process migrations
    const results = {
      total: gamesToMigrate.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      details: []
    };
    
    for (const game of gamesToMigrate) {
      try {
        // Check if already migrated
        const existing = await WizardGame.findOne({ localId: game.localId });
        if (existing) {
          results.skipped++;
          results.details.push({
            gameId: game._id,
            localId: game.localId,
            status: 'skipped',
            reason: 'Already migrated'
          });
          continue;
        }
        
        // Migrate the game data
        const { migrated, originalVersion, needsMigration, error } = migrateWizardGame(game.gameData);
        
        if (error) {
          results.failed++;
          results.details.push({
            gameId: game._id,
            localId: game.localId,
            status: 'failed',
            error: error
          });
          continue;
        }
        
        // Validate migrated data
        const migrationValidation = validateMigratedGame(migrated);
        if (!migrationValidation.isValid) {
          results.failed++;
          results.details.push({
            gameId: game._id,
            localId: game.localId,
            status: 'failed',
            error: 'Migration validation failed',
            validationErrors: migrationValidation.errors
          });
          continue;
        }
        
        // Final schema validation
        const schemaValidation = validateWizardGameData(migrated);
        if (!schemaValidation.isValid) {
          results.failed++;
          results.details.push({
            gameId: game._id,
            localId: game.localId,
            status: 'failed',
            error: 'Schema validation failed',
            validationErrors: schemaValidation.errors
          });
          continue;
        }
        
        // Create new wizard game
        const wizardGame = new WizardGame({
          userId: game.userId,
          localId: game.localId,
          gameData: migrated,
          migratedFrom: originalVersion,
          migratedAt: new Date(),
          originalGameId: game._id,
          isShared: game.isShared || false,
          shareId: game.shareId || null,
          sharedAt: game.sharedAt || null
        });
        
        await wizardGame.save();
        
        results.successful++;
        results.details.push({
          gameId: game._id,
          localId: game.localId,
          wizardGameId: wizardGame._id,
          status: 'success',
          originalVersion: originalVersion,
          needsMigration: needsMigration
        });
        
      } catch (err) {
        console.error('[Migration] Error migrating game:', game._id, err);
        results.failed++;
        results.details.push({
          gameId: game._id,
          localId: game.localId,
          status: 'failed',
          error: err.message
        });
      }
    }
    
    res.json({
      message: 'Migration completed',
      results: results
    });
    
  } catch (error) {
    console.error('[POST /api/wizard-games/migrate] Error:', error);
    res.status(500).json({
      error: 'Migration failed',
      details: error.message
    });
  }
});

/**
 * POST /api/wizard-games
 * Create a new wizard game (v3.0 format) directly in wizard collection
 * This endpoint expects validated v3.0 format data
 */
router.post('/', auth, async (req, res) => {
  try {
    const { gameData, localId } = req.body;
    
    // Validate inputs
    if (!gameData || typeof gameData !== 'object') {
      return res.status(400).json({ error: 'gameData (object) is required' });
    }
    if (!localId || typeof localId !== 'string') {
      return res.status(400).json({ error: 'localId (string) is required' });
    }
    
    // Validate v3.0 format
    const validation = validateWizardGameData(gameData);
    if (!validation.isValid) {
      console.error('[POST /api/wizard-games] Validation failed:', validation.errors);
      return res.status(400).json({
        error: 'Invalid game data structure',
        validationErrors: validation.errors
      });
    }
    
    const userId = req.user._id;
    
    // Check for duplicates - first by localId (exact match)
    const existingByLocalId = await WizardGame.findOne({ localId: localId });
    
    if (existingByLocalId) {
      return res.status(409).json({
        error: 'Game already exists',
        existingGame: {
          id: existingByLocalId._id,
          localId: existingByLocalId.localId
        }
      });
    }
    
    // Content-based duplicate detection (detects re-uploaded games across users)
    // Uses created_at + total_rounds + sorted player names + final_scores as fingerprint
    if (gameData.created_at && gameData.gameFinished) {
      // Build query for potential duplicates based on content
      const playerNames = (gameData.players || [])
        .map(p => p.name)
        .filter(Boolean)
        .sort()
        .join(',');
      
      // Find games with same created_at timestamp and total_rounds
      // Validate and sanitize user input to prevent NoSQL injection
      const sanitizedCreatedAt = typeof gameData.created_at === 'string' ? gameData.created_at : String(gameData.created_at || '');
      const sanitizedTotalRounds = typeof gameData.total_rounds === 'number' ? gameData.total_rounds : parseInt(gameData.total_rounds, 10) || 0;
      
      // Using $eq operator to ensure values are treated as literals, not query objects
      const potentialDuplicates = await WizardGame.find({
        'gameData.created_at': { $eq: sanitizedCreatedAt },
        'gameData.total_rounds': { $eq: sanitizedTotalRounds },
        'gameData.gameFinished': { $eq: true }
      }).lean();
      
      // Check for content match
      for (const existing of potentialDuplicates) {
        const existingPlayerNames = (existing.gameData?.players || [])
          .map(p => p.name)
          .filter(Boolean)
          .sort()
          .join(',');
        
        // Match by player names
        if (existingPlayerNames === playerNames) {
          // Additional check: compare final scores if available
          const newScoreValues = Object.values(gameData.final_scores || {}).sort((a, b) => a - b).join(',');
          const existingScoreValues = Object.values(existing.gameData?.final_scores || {}).sort((a, b) => a - b).join(',');
          
          if (newScoreValues === existingScoreValues) {
            console.log(`[POST /api/wizard-games] Duplicate detected by content: existing=${existing._id}, new localId=${localId}`);
            return res.status(409).json({
              error: 'Game already exists (duplicate content detected)',
              existingGame: {
                id: existing._id,
                localId: existing.localId
              },
              reason: 'A game with the same timestamp, players, and scores already exists'
            });
          }
        }
      }
    }
    
    // Create wizard game
    const wizardGame = new WizardGame({
      userId: userId,
      localId: localId,
      gameData: gameData,
      migratedFrom: null, // Created directly as v3.0
      migratedAt: null,
      originalGameId: null
    });
    
    await wizardGame.save();
    
    res.status(201).json({
      message: 'Wizard game created successfully',
      game: {
        id: wizardGame._id,
        localId: wizardGame.localId,
        version: wizardGame.gameData.version,
        createdAt: wizardGame.createdAt
      }
    });
    
  } catch (error) {
    console.error('[POST /api/wizard-games] Error:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Duplicate game detected',
        details: 'A game with this localId already exists'
      });
    }
    
    res.status(500).json({
      error: 'Failed to create wizard game',
      details: error.message
    });
  }
});

/**
 * POST /api/wizard-games/batch-check
 * Check existence of multiple wizard games by their IDs
 */
router.post('/batch-check', auth, async (req, res) => {
  try {
    const { gameIds } = req.body;
    
    if (!Array.isArray(gameIds) || gameIds.length === 0) {
      return res.status(400).json({ error: 'gameIds array is required' });
    }
    
    // Limit batch size to prevent abuse
    if (gameIds.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 games per batch check' });
    }
    
    // Filter valid MongoDB ObjectIDs
    const validIds = gameIds.filter(id => id && typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/));
    
    if (validIds.length === 0) {
      return res.json({ results: {} });
    }
    
    // Check which games exist in wizard collection - optimized query
    const existingGames = await WizardGame.find({
      _id: { $in: validIds }
    }).select('_id').lean();
    
    // Create a map of existing game IDs
    const existingIds = new Set(existingGames.map(g => g._id.toString()));
    
    // Return result for each requested game ID
    const results = {};
    gameIds.forEach(id => {
      // Return false for invalid IDs, check existingIds for valid ones
      results[id] = validIds.includes(id) ? existingIds.has(id) : false;
    });
    
    res.json({ results });
  } catch (error) {
    console.error('[POST /api/wizard-games/batch-check] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/wizard-games/:id
 * Get a wizard game by MongoDB _id
 * Any authenticated user can view any game (global view)
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const gameId = req.params.id;
    
    // Validate ID format to prevent injection
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ error: 'Invalid game ID format' });
    }

    const game = await WizardGame.findOne({
      _id: { $eq: gameId }
    });
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json(game);
  } catch (error) {
    console.error('[GET /api/wizard-games/:id] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/wizard-games
 * Get wizard games - all games or filtered by user
 * Query params:
 *   - allGames=true: Return all games (not user-specific)
 *   - limit, skip, page: Pagination
 */
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 50, skip = 0, page, allGames } = req.query;
    
    // Build query - either all games or user-specific
    const query = allGames === 'true' ? {} : { userId: userId };
    
    // Validate and sanitize pagination parameters to prevent injection
    const parsedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
    // Support both 'skip' and 'page' parameters (page is 1-indexed)
    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const parsedSkip = page ? (parsedPage - 1) * parsedLimit : Math.max(parseInt(skip) || 0, 0);
    
    const games = await WizardGame.find(query)
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .skip(parsedSkip)
      .select('-__v');
    
    const total = await WizardGame.countDocuments(query);
    const totalPages = Math.ceil(total / parsedLimit);
    const currentPage = Math.floor(parsedSkip / parsedLimit) + 1;
    
    res.json({
      games: games,
      total: total,
      limit: parsedLimit,
      skip: parsedSkip,
      pagination: {
        currentPage: currentPage,
        totalPages: totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1
      }
    });
    
  } catch (error) {
    console.error('[GET /api/wizard-games] Error:', error);
    res.status(500).json({
      error: 'Failed to fetch wizard games',
      details: error.message
    });
  }
});

/**
 * GET /api/wizard-games/stats
 * Get migration statistics for user
 */
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const totalWizard = await WizardGame.countDocuments({ userId: userId });
    const totalLegacy = await Game.countDocuments({ userId: userId });
    const migrated = await WizardGame.countDocuments({
      userId: userId,
      migratedFrom: { $ne: null }
    });
    
    const byVersion = await WizardGame.aggregate([
      { $match: { userId: userId, migratedFrom: { $ne: null } } },
      { $group: { _id: '$migratedFrom', count: { $sum: 1 } } }
    ]);
    
    res.json({
      wizard: {
        total: totalWizard,
        migrated: migrated,
        createdAsV3: totalWizard - migrated
      },
      legacy: {
        total: totalLegacy,
        notMigrated: totalLegacy - migrated
      },
      migratedByVersion: byVersion.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    });
    
  } catch (error) {
    console.error('[GET /api/wizard-games/stats] Error:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      details: error.message
    });
  }
});

module.exports = router;
