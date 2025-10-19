const express = require('express');
const Game = require('../models/Game');
const auth = require('../middleware/auth');

const router = express.Router();

// TEMP: Disable auth middleware for all routes
// router.use(auth);

// POST /games - Create game for authenticated user
// POST /games - Create game for authenticated user
router.post('/', async (req, res, next) => {
  try {
    const { gameData, localId } = req.body;

    // Validation
    if (!gameData || typeof gameData !== 'object') {
      console.error('[POST /api/games] Invalid gameData:', req.body);
      return res.status(400).json({ error: 'gameData (object) is required', received: req.body });
    }
    if (!localId || typeof localId !== 'string') {
      return res.status(400).json({ error: 'localId (string) is required' });
    }

    // TEMP: Allow unauthenticated game creation by using a dummy userId if not present
    let userId = null;
    if (req.user && req.user._id) {
      userId = req.user._id;
    } else {
      // Use a fixed dummy userId for unauthenticated games
      userId = '000000000000000000000000';
    }

    // Enhanced duplicate checking
    // 1. Check for duplicate by localId
    const existingByLocalId = await Game.findOne({ localId });
    if (existingByLocalId) {
      return res.status(200).json({
        message: 'Game already exists (by localId)',
        duplicate: true,
        game: {
          id: existingByLocalId._id,
          userId: existingByLocalId.userId,
          gameData: existingByLocalId.gameData,
          createdAt: existingByLocalId.createdAt
        }
      });
    }

    // 2. Check for content-based duplicates (same players, scores, rounds)
    // Create a content hash for comparison
    const contentSignature = {
      playerCount: gameData.players?.length || 0,
      totalRounds: gameData.total_rounds || 0,
      finalScoresJson: JSON.stringify(gameData.final_scores || {}),
      winnerId: gameData.winner_id || null
    };

    // Find games with similar content
    const similarGames = await Game.find({
      userId,
      'gameData.players': { $size: contentSignature.playerCount },
      'gameData.total_rounds': contentSignature.totalRounds,
      'gameData.winner_id': contentSignature.winnerId
    });

    // Check for exact content match
    for (const similarGame of similarGames) {
      const similarScores = JSON.stringify(similarGame.gameData.final_scores || {});
      if (similarScores === contentSignature.finalScoresJson) {
        console.debug('[POST /api/games] Found content duplicate:', similarGame._id);
        return res.status(200).json({
          message: 'Game already exists (content duplicate)',
          duplicate: true,
          game: {
            id: similarGame._id,
            userId: similarGame.userId,
            gameData: similarGame.gameData,
            createdAt: similarGame.createdAt
          }
        });
      }
    }

    // 3. Check if this is an imported shared game (should not be uploaded again)
    if (gameData.isImported || gameData.isShared || gameData.originalGameId) {
      console.debug('[POST /api/games] Rejecting upload of shared/imported game:', localId);
      return res.status(400).json({ 
        error: 'Imported or shared games should not be uploaded to prevent duplicates',
        isImported: true
      });
    }

    const game = new Game({
      userId,
      localId,
      gameData
    });

    await game.save();

    res.status(201).json({
      message: 'Game created successfully',
      game: {
        id: game._id,
        userId: game.userId,
        gameData: game.gameData,
        createdAt: game.createdAt
      }
    });
// GET /games/:id - Get a game by MongoDB _id
router.get('/:id', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json({ game });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /games/:id/share - Make a game shareable with a shareId
router.put('/:id/share', async (req, res) => {
  try {
    const { shareId } = req.body;
    
    if (!shareId || typeof shareId !== 'string') {
      return res.status(400).json({ error: 'shareId (string) is required' });
    }

    // Check if shareId is already in use
    const existingSharedGame = await Game.findOne({ shareId });
    if (existingSharedGame && existingSharedGame._id.toString() !== req.params.id) {
      return res.status(409).json({ error: 'Share ID already in use' });
    }

    const game = await Game.findByIdAndUpdate(
      req.params.id,
      { 
        shareId, 
        isShared: true, 
        sharedAt: new Date() 
      },
      { new: true }
    );

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json({
      message: 'Game shared successfully',
      game: {
        id: game._id,
        shareId: game.shareId,
        isShared: game.isShared,
        sharedAt: game.sharedAt
      }
    });
  } catch (error) {
    console.error('[PUT /api/games/:id/share] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /games/shared/:shareId - Get a shared game by shareId (public endpoint)
router.get('/shared/:shareId', async (req, res) => {
  try {
    // First try to find by shareId
    let game = await Game.findOne({ shareId: req.params.shareId });
    
    // If not found by shareId, try to find by localId as fallback
    // This handles cases where games were uploaded but never properly shared
    if (!game) {
      game = await Game.findOne({ localId: req.params.shareId });
    }
    
    if (!game) {
      return res.status(404).json({ error: 'Shared game not found' });
    }
    
    res.json({
      game: {
        id: game._id,
        gameData: game.gameData,
        shareId: game.shareId,
        sharedAt: game.sharedAt,
        createdAt: game.createdAt
      }
    });
  } catch (error) {
    console.error('[GET /api/games/shared/:shareId] Error:', error);
    res.status(500).json({ error: error.message });
  }
});
  } catch (error) {
    console.error('[POST /api/games] Error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// GET /games - List games for authenticated user (sorted by createdAt)
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sortOrder = 'desc', shareId } = req.query;

    // Handle shareId query specifically for shared game lookup
    if (shareId) {
      try {
        const game = await Game.findOne({ shareId });
        if (!game) {
          return res.status(404).json({ error: 'Shared game not found' });
        }
        return res.json({
          games: [{
            id: game._id,
            userId: game.userId,
            gameData: game.gameData,
            shareId: game.shareId,
            createdAt: game.createdAt
          }]
        });
      } catch (error) {
        console.error('[GET /api/games] Error finding shared game:', error);
        return res.status(500).json({ error: 'Error finding shared game' });
      }
    }

    // Validation
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      console.error('[GET /api/games] Invalid pagination:', req.query);
      return res.status(400).json({ error: 'Invalid pagination parameters', received: req.query });
    }

    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const skip = (pageNum - 1) * limitNum;


    // TEMP: Return all games if unauthenticated, else only user's games
    let userId = null;
    if (req.user && req.user._id) {
      userId = req.user._id;
    } else {
      userId = null;
    }

    let games, totalGames;
    if (userId) {
      games = await Game.find({ userId })
        .sort({ createdAt: sortDirection })
        .skip(skip)
        .limit(limitNum)
        .populate('userId', 'username');
      totalGames = await Game.countDocuments({ userId });
    } else {
      games = await Game.find({})
        .sort({ createdAt: sortDirection })
        .skip(skip)
        .limit(limitNum)
        .populate('userId', 'username');
      totalGames = await Game.countDocuments({});
    }

    res.json({
      games: games.map(game => ({
        id: game._id,
        userId: game.userId._id,
        username: game.userId.username,
        gameData: game.gameData,
        shareId: game.shareId,
        createdAt: game.createdAt
      })),
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalGames / limitNum),
        totalGames,
        hasNextPage: pageNum < Math.ceil(totalGames / limitNum),
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error('[GET /api/games] Error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// GET /games/stats - Get user's game statistics (example: count, latest, etc.)
router.get('/stats', async (req, res, next) => {
  try {
    const userId = req.user._id;
    const totalGames = await Game.countDocuments({ userId });
    const latestGame = await Game.findOne({ userId }).sort({ createdAt: -1 });

    res.json({
      username: req.user.username,
      stats: {
        totalGames,
        latestGame: latestGame ? latestGame.gameData : null
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
