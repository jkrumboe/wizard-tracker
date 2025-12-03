const express = require('express');
const Game = require('../models/Game');
const auth = require('../middleware/auth');

const router = express.Router();

// POST /games - Create game for authenticated user (requires authentication)
router.post('/', auth, async (req, res, next) => {
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

    // Get userId from authenticated user
    const userId = req.user._id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to upload games' });
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
  } catch (error) {
    console.error('[POST /api/games] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /games/leaderboard - Calculate leaderboard from all games
// IMPORTANT: This must come BEFORE /:id route to avoid conflicts
// PUBLIC ENDPOINT - No authentication required
router.get('/leaderboard', async (req, res, next) => {
  
  try {
    const { gameType } = req.query;
    
    // Fetch both Wizard games and Table games
    const TableGame = require('../models/TableGame');
    
    // Get wizard games (from Game collection)
    const wizardGames = await Game.find({});
    
    // Get table games (from TableGame collection)
    const tableGames = await TableGame.find({});
    
    // Calculate player statistics grouped by NAME (not ID)
    const playerStats = {};
    const gameTypeSet = new Set(['all', 'Wizard']); // Start with 'all' and 'Wizard'
    
    // First, collect all available game types from table games
    tableGames.forEach(game => {
      const gameMode = game.gameTypeName || game.gameData?.gameName || 'Table Game';
      if (gameMode && gameMode !== 'Table Game') {
        gameTypeSet.add(gameMode);
      }
    });
    
    // Process Wizard games
    wizardGames.forEach(game => {
      const gameData = game.gameData;
      if (!gameData || !gameData.players || !Array.isArray(gameData.players)) {
        return;
      }

      const gameMode = 'Wizard'; // All games from Game collection are Wizard
      const winnerId = gameData.winner_id;
      const finalScores = gameData.final_scores || {};

      gameData.players.forEach(player => {
        const playerId = player.id;
        const playerName = player.name;
        
        // Skip players without a name
        if (!playerName) return;

        // Filter by game type if specified
        if (gameType && gameType !== 'all' && gameType !== gameMode) {
          return;
        }

        // Use NAME as the key to group same players with different IDs
        if (!playerStats[playerName]) {
          playerStats[playerName] = {
            id: playerName,
            name: playerName,
            totalGames: 0,
            wins: 0,
            totalScore: 0,
            gameTypes: {},
            lastPlayed: game.createdAt
          };
        }

        const stats = playerStats[playerName];
        
        stats.totalGames++;
        
        const isWinner = playerId === winnerId || 
                        (winnerId && gameData.players.find(p => p.id === winnerId)?.name === playerName);
        
        if (isWinner) {
          stats.wins++;
        }
        
        if (finalScores[playerId] !== undefined) {
          stats.totalScore += finalScores[playerId];
        }

        if (!stats.gameTypes[gameMode]) {
          stats.gameTypes[gameMode] = { games: 0, wins: 0, totalScore: 0 };
        }
        stats.gameTypes[gameMode].games++;
        if (isWinner) {
          stats.gameTypes[gameMode].wins++;
        }
        if (finalScores[playerId] !== undefined) {
          stats.gameTypes[gameMode].totalScore += finalScores[playerId];
        }

        if (new Date(game.createdAt) > new Date(stats.lastPlayed)) {
          stats.lastPlayed = game.createdAt;
        }
      });
    });
    
    // Process Table games
    tableGames.forEach(game => {
      // Table games have nested structure: gameData.gameData
      const outerGameData = game.gameData;
      const gameData = outerGameData?.gameData || outerGameData;
      
      if (!gameData || !gameData.players || !Array.isArray(gameData.players)) {
        return;
      }

      const gameMode = game.gameTypeName || game.gameData?.gameName || 'Table Game';
      
      // Table games store points arrays, not final_scores
      // Calculate final scores from points arrays
      const finalScores = {};
      gameData.players.forEach((player, index) => {
        const playerId = `player_${index}`; // Use index as ID since table games don't have player IDs
        const points = player.points || [];
        const totalScore = points.reduce((sum, p) => {
          const parsed = parseFloat(p);
          return sum + (isNaN(parsed) ? 0 : parsed);
        }, 0);
        finalScores[playerId] = totalScore;
      });
      
      // Find winner (highest or lowest score depending on lowIsBetter)
      let winnerId = null;
      if (Object.keys(finalScores).length > 0) {
        const lowIsBetter = game.lowIsBetter || outerGameData?.lowIsBetter || gameData.lowIsBetter || false;
        const scores = Object.entries(finalScores);
        if (lowIsBetter) {
          winnerId = scores.reduce((min, curr) => curr[1] < min[1] ? curr : min)[0];
        } else {
          winnerId = scores.reduce((max, curr) => curr[1] > max[1] ? curr : max)[0];
        }
      }

      gameData.players.forEach((player, index) => {
        const playerId = `player_${index}`;
        const playerName = player.name;
        
        if (!playerName) return;

        // Filter by game type if specified
        if (gameType && gameType !== 'all' && gameType !== gameMode) {
          return;
        }

        if (!playerStats[playerName]) {
          playerStats[playerName] = {
            id: playerName,
            name: playerName,
            totalGames: 0,
            wins: 0,
            totalScore: 0,
            gameTypes: {},
            lastPlayed: game.createdAt
          };
        }

        const stats = playerStats[playerName];
        
        stats.totalGames++;
        
        const isWinner = playerId === winnerId;
        
        if (isWinner) {
          stats.wins++;
        }
        
        if (finalScores[playerId] !== undefined) {
          stats.totalScore += finalScores[playerId];
        }

        if (!stats.gameTypes[gameMode]) {
          stats.gameTypes[gameMode] = { games: 0, wins: 0, totalScore: 0 };
        }
        stats.gameTypes[gameMode].games++;
        if (isWinner) {
          stats.gameTypes[gameMode].wins++;
        }
        if (finalScores[playerId] !== undefined) {
          stats.gameTypes[gameMode].totalScore += finalScores[playerId];
        }

        if (new Date(game.createdAt) > new Date(stats.lastPlayed)) {
          stats.lastPlayed = game.createdAt;
        }
      });
    });

    // Convert to array and calculate derived stats
    const leaderboard = Object.values(playerStats).map(player => {
      const winRate = player.totalGames > 0 
        ? ((player.wins / player.totalGames) * 100).toFixed(1) 
        : 0;
      const avgScore = player.totalGames > 0 
        ? (player.totalScore / player.totalGames).toFixed(1) 
        : 0;

      return {
        ...player,
        winRate: parseFloat(winRate),
        avgScore: parseFloat(avgScore)
      };
    });

    // Sort by wins, then win rate, then total games
    leaderboard.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.totalGames - a.totalGames;
    });

    // Get unique game types
    const gameTypes = Array.from(gameTypeSet).sort();
    
    res.json({
      leaderboard,
      gameTypes,
      totalGames: wizardGames.length + tableGames.length
    });
  } catch (error) {
    console.error('[GET /api/games/leaderboard] Error:', error);
    console.error('[GET /api/games/leaderboard] Error stack:', error.stack);
    res.status(500).json({ error: error.message, details: error.stack });
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
router.put('/:id/share', auth, async (req, res) => {
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

    // Verify user owns the game
    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to share this game' });
    }

    // Update the game
    game.shareId = shareId;
    game.isShared = true;
    game.sharedAt = new Date();
    await game.save();

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

// GET /games - List games for authenticated user (sorted by createdAt)
router.get('/', auth, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sortOrder = 'desc', shareId } = req.query;

    // Handle shareId query specifically for shared game lookup
    if (shareId) {
      try {
        const game = await Game.findOne({ shareId: { $eq: shareId } });
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

    // Get userId from authenticated user
    const userId = req.user._id;

    // Query for games where:
    // 1. User is the owner (userId matches), OR
    // 2. User is a player (userId appears in gameData.player_ids array)
    const games = await Game.find({
      $or: [
        { userId: userId },
        { 'gameData.player_ids': userId.toString() }
      ]
    })
      .sort({ createdAt: sortDirection })
      .skip(skip)
      .limit(limitNum);
    
    const totalGames = await Game.countDocuments({
      $or: [
        { userId: userId },
        { 'gameData.player_ids': userId.toString() }
      ]
    });

    res.json({
      games: games.map(game => ({
        id: game._id,
        userId: game.userId,
        localId: game.localId,
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
router.get('/stats', auth, async (req, res, next) => {
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
