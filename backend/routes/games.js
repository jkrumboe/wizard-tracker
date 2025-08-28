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

    // Check for duplicate by localId
    const existing = await Game.findOne({ localId });
    if (existing) {
      return res.status(200).json({
        message: 'Game already exists',
        duplicate: true,
        game: {
          id: existing._id,
          userId: existing.userId,
          gameData: existing.gameData,
          createdAt: existing.createdAt
        }
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
  } catch (error) {
    console.error('[POST /api/games] Error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// GET /games - List games for authenticated user (sorted by createdAt)
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sortOrder = 'desc' } = req.query;

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
