const express = require('express');
const mongoose = require('mongoose');
const TableGame = require('../models/TableGame');
const PlayerIdentity = require('../models/PlayerIdentity');
const auth = require('../middleware/auth');
const cache = require('../utils/redis');
const identityService = require('../utils/identityService');

const router = express.Router();

// GET /api/table-games/public/:id - Get table game by ID (public, no auth required)
// PUBLIC ENDPOINT - No authentication required
router.get('/public/:id', async (req, res, next) => {
  try {
    const gameId = req.params.id;

    // Validate ID format to prevent injection
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ error: 'Invalid game ID format' });
    }

    const tableGame = await TableGame.findOne({ _id: { $eq: gameId } });

    if (!tableGame) {
      return res.status(404).json({ error: 'Table game not found' });
    }

    // Return limited public information
    res.json({
      game: {
        _id: tableGame._id,
        id: tableGame._id,
        localId: tableGame.localId,
        name: tableGame.name,
        gameTypeName: tableGame.gameTypeName,
        gameData: tableGame.gameData,
        gameFinished: tableGame.gameFinished,
        playerCount: tableGame.playerCount,
        totalRounds: tableGame.totalRounds,
        createdAt: tableGame.createdAt
      }
    });
  } catch (error) {
    console.error('[GET /api/table-games/public/:id] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

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

    // Check for duplicate by localId (exact match across all users)
    const existingByLocalId = await TableGame.findOne({ localId });
    if (existingByLocalId) {
      console.debug(`[POST /api/table-games] Duplicate found by localId: ${localId}`);
      return res.status(200).json({ 
        game: existingByLocalId, 
        duplicate: true,
        message: 'Table game already exists with this localId'
      });
    }

    // Content-based duplicate detection (detects re-uploaded games across users)
    if (gameData.created_at && gameData.gameFinished) {
      const playerNames = (gameData.players || [])
        .map(p => p.name)
        .filter(Boolean)
        .sort()
        .join(',');
      
      const totalRounds = gameData.rows || 0;
      
      // Validate and sanitize user input to prevent NoSQL injection
      const sanitizedCreatedAt = typeof gameData.created_at === 'string' ? gameData.created_at : String(gameData.created_at || '');
      const sanitizedTotalRounds = typeof totalRounds === 'number' ? totalRounds : parseInt(totalRounds, 10) || 0;
      
      // Find games with same created_at and similar structure
      // Using $eq operator to ensure values are treated as literals, not query objects
      const potentialDuplicates = await TableGame.find({
        'gameData.created_at': { $eq: sanitizedCreatedAt },
        'gameData.gameFinished': { $eq: true },
        totalRounds: { $eq: sanitizedTotalRounds }
      }).lean();
      
      for (const existing of potentialDuplicates) {
        const existingPlayerNames = (existing.gameData?.players || [])
          .map(p => p.name)
          .filter(Boolean)
          .sort()
          .join(',');
        
        if (existingPlayerNames === playerNames) {
          // Compare final totals if available
          const getPlayerTotals = (players) => {
            return (players || [])
              .map(p => (p.points || []).reduce((sum, pt) => sum + (Number(pt) || 0), 0))
              .sort((a, b) => a - b)
              .join(',');
          };
          
          const newTotals = getPlayerTotals(gameData.players);
          const existingTotals = getPlayerTotals(existing.gameData?.players);
          
          if (newTotals === existingTotals) {
            console.log(`[POST /api/table-games] Duplicate detected by content: existing=${existing._id}, new localId=${localId}`);
            return res.status(200).json({ 
              game: existing, 
              duplicate: true,
              message: 'Table game already exists (duplicate content detected)'
            });
          }
        }
      }
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

    // Resolve player identities before saving
    const resolvedGameData = { ...gameData };
    if (resolvedGameData.players && Array.isArray(resolvedGameData.players)) {
      for (const player of resolvedGameData.players) {
        if (player.name && !player.identityId) {
          // Preserve original ID for reversibility
          if (player.id) {
            player.originalId = player.id;
          }
          
          // Find or create identity
          const identity = await PlayerIdentity.findOrCreateByName(player.name, {
            type: 'guest',
            createdBy: userId
          });
          player.identityId = identity._id;
        }
      }
      
      // Set winner identity
      if (resolvedGameData.winner_id || resolvedGameData.winner_ids) {
        const winnerIds = resolvedGameData.winner_ids || [resolvedGameData.winner_id];
        const winnerIdentityIds = [];
        
        for (const winnerId of winnerIds) {
          const winnerPlayer = resolvedGameData.players.find(p => 
            p.id === winnerId || p.originalId === winnerId
          );
          if (winnerPlayer && winnerPlayer.identityId) {
            winnerIdentityIds.push(winnerPlayer.identityId);
          }
        }
        
        if (winnerIdentityIds.length > 0) {
          resolvedGameData.winner_identityIds = winnerIdentityIds;
          if (winnerIdentityIds.length === 1) {
            resolvedGameData.winner_identityId = winnerIdentityIds[0];
          }
        }
      }
    }

    // Create new table game
    const tableGame = new TableGame({
      userId,
      localId,
      name,
      gameTypeName,
      gameData: resolvedGameData,
      gameType: 'table',
      gameFinished,
      playerCount,
      totalRounds,
      targetNumber,
      lowIsBetter,
      identitiesMigrated: true,
      migratedAt: new Date()
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

// GET /api/table-games - Get table games (all or user-specific)
router.get('/', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { allGames } = req.query;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Build query - either all games or user-specific
    const query = allGames === 'true' ? {} : { userId };

    const tableGames = await TableGame.find(query)
      .select('_id localId name gameTypeName gameData gameFinished playerCount totalRounds createdAt updatedAt')
      .sort({ createdAt: -1 });

    res.json({ games: tableGames, total: tableGames.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/table-games/by-identity/:identityId - Get games by player identity
router.get('/by-identity/:identityId', auth, async (req, res, next) => {
  try {
    const { identityId } = req.params;
    const { limit = 50, skip = 0, gameType } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(identityId)) {
      return res.status(400).json({ error: 'Invalid identity ID format' });
    }
    
    const games = await TableGame.findByPlayerIdentity(identityId, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      gameType
    });
    
    res.json({ games, total: games.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/table-games/:id - Get specific table game by ID
// Users can view games they own OR games they participated in
router.get('/:id', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const username = req.user.username;
    const gameId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate ID format to prevent injection
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ error: 'Invalid game ID format' });
    }

    // First try to find game by ID (without userId filter to allow viewing participated games)
    const tableGame = await TableGame.findOne({ _id: { $eq: gameId } });

    if (!tableGame) {
      return res.status(404).json({ error: 'Table game not found' });
    }

    // Check if user has access: either owner or participant
    const isOwner = tableGame.userId && tableGame.userId.toString() === userId.toString();
    
    // Get user's identity to check for participation
    const userIdentity = await PlayerIdentity.findOne({ 
      userId: { $eq: userId },
      isDeleted: false 
    });
    
    // Get all identity IDs associated with this user (including linked/merged identities)
    const userIdentityIds = new Set();
    if (userIdentity) {
      userIdentityIds.add(userIdentity._id.toString());
      // Add linked identities
      if (userIdentity.linkedIdentities) {
        userIdentity.linkedIdentities.forEach(li => {
          userIdentityIds.add(li.identityId.toString());
        });
      }
    }
    
    // Also find any guest identities that were merged into this user's identity
    const mergedIdentities = await PlayerIdentity.find({
      mergedInto: userIdentity?._id,
      isDeleted: false
    }).select('_id');
    mergedIdentities.forEach(mi => {
      userIdentityIds.add(mi._id.toString());
    });
    
    // Check by name for legacy support
    const usernameLower = username?.toLowerCase();
    const namesToCheck = new Set([usernameLower].filter(Boolean));
    
    // Check if user is a participant
    const gameData = tableGame.gameData?.gameData || tableGame.gameData;
    const players = gameData?.players || [];
    
    const isParticipant = players.some(player => {
      if (!player) return false;
      // Check by identity ID
      if (player.identityId && userIdentityIds.has(player.identityId.toString())) return true;
      // Check by player ID matching user ID
      if (player.id && player.id === userId.toString()) return true;
      // Check by player name matching username or any alias (case-insensitive)
      if (player.name && namesToCheck.has(player.name.toLowerCase())) return true;
      return false;
    });

    if (!isOwner && !isParticipant) {
      return res.status(403).json({ error: 'You do not have permission to view this game' });
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
