const express = require('express');
const mongoose = require('mongoose');
const TableGame = require('../models/TableGame');
const auth = require('../middleware/auth');
const cache = require('../utils/redis');

const router = express.Router();

// POST /api/table-games - Create table game for authenticated user
router.post('/', auth, async (req, res, next) => {
  try {
    const { gameData, localId } = req.body;

    // Validation
    if (!gameData || typeof gameData !== 'object') {
      console.error('[POST /api/table-games] Invalid gameData:', req.body);
      return res.status(400).json({ error: 'gameData (object) is required', received: req.body });
    }
    if (!localId || typeof localId !== 'string') {
      return res.status(400).json({ error: 'localId (string) is required' });
    }

    // Get userId from authenticated user
    const userId = req.user._id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to upload table games' });
    }

    // Check for duplicate by localId
    const existingByLocalId = await TableGame.findOne({ localId, userId });
    if (existingByLocalId) {
      console.debug(`[POST /api/table-games] Duplicate found by localId: ${localId}`);
      return res.status(200).json({ 
        game: existingByLocalId, 
        duplicate: true,
        message: 'Table game already exists with this localId'
      });
    }

    // Extract metadata from gameData
    const gameTypeName = gameData.gameName || gameData.gameTypeName || null;
    const name = gameTypeName || gameData.name || `Table Game - ${new Date().toLocaleDateString()}`;
    const players = gameData.players || [];
    const playerCount = players.length;
    const totalRounds = gameData.rows || 0;
    const gameFinished = gameData.gameFinished || false;
    const targetNumber = gameData.targetNumber || null;
    const lowIsBetter = gameData.lowIsBetter || false;

    // Create new table game
    const tableGame = new TableGame({
      userId,
      localId,
      name,
      gameTypeName,
      gameData,
      gameType: 'table',
      gameFinished,
      playerCount,
      totalRounds,
      targetNumber,
      lowIsBetter
    });

    await tableGame.save();
    
    // Invalidate leaderboard cache when new table game is created
    if (cache.isConnected) {
      await cache.delPattern('leaderboard:*');
    }
    
    console.debug(`[POST /api/table-games] Created table game: ${tableGame._id} for user ${userId}`);
    
    res.status(201).json({ 
      game: tableGame,
      duplicate: false 
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/table-games - Get all table games for authenticated user
router.get('/', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const tableGames = await TableGame.find({ userId })
      .select('_id localId name gameTypeName gameData gameFinished playerCount totalRounds createdAt updatedAt')
      .sort({ createdAt: -1 });

    res.json({ games: tableGames });
  } catch (error) {
    next(error);
  }
});

// GET /api/table-games/:id - Get specific table game by ID
router.get('/:id', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const gameId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate ID format to prevent injection
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ error: 'Invalid game ID format' });
    }

    const tableGame = await TableGame.findOne({ _id: { $eq: gameId }, userId });

    if (!tableGame) {
      return res.status(404).json({ error: 'Table game not found' });
    }

    res.json({ game: tableGame });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/table-games/:id - Delete a table game
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const gameId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate ID format to prevent injection
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ error: 'Invalid game ID format' });
    }

    const tableGame = await TableGame.findOneAndDelete({ _id: { $eq: gameId }, userId });

    if (!tableGame) {
      return res.status(404).json({ error: 'Table game not found' });
    }

    res.json({ message: 'Table game deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
