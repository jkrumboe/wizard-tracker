const express = require('express');
const Game = require('../models/Game');
const auth = require('../middleware/auth');
const cache = require('../utils/redis');
const { validateWizardGameData } = require('../schemas/wizardGameSchema');

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

    // Validate wizard game data structure
    const validation = validateWizardGameData(gameData);
    if (!validation.isValid) {
      console.error('[POST /api/games] Game data validation failed:', validation.errors);
      return res.status(400).json({ 
        error: 'Invalid game data structure', 
        validationErrors: validation.errors 
      });
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
    // Create a content hash for comparison - support both old and new schema formats
    // Normalize winner_id to always be an array for consistent comparison
    const normalizeWinnerId = (winnerId) => {
      if (!winnerId) return [];
      if (Array.isArray(winnerId)) return winnerId.sort();
      return [winnerId];
    };
    
    const contentSignature = {
      playerCount: gameData.players?.length || 0,
      totalRounds: gameData.total_rounds || gameData.totals?.total_rounds || 0,
      finalScoresJson: JSON.stringify(gameData.final_scores || gameData.totals?.final_scores || {}),
      winnerIdJson: JSON.stringify(normalizeWinnerId({ winner_ids: gameData.winner_ids, winner_id: gameData.winner_id || gameData.totals?.winner_id }))
    };

    // Find games with similar content - limit to recent games for performance
    // Use flexible querying that works with both schema formats
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const similarGames = await Game.find({
      userId,
      createdAt: { $gte: oneDayAgo } // Only check games from last 24 hours
    })
    .select('gameData _id userId createdAt')
    .limit(50) // Check more games but filter in memory
    .lean();

    // Check for exact content match (in memory to handle both schema formats)
    for (const similarGame of similarGames) {
      const similarData = similarGame.gameData || {};
      
      // Check player count
      if ((similarData.players?.length || 0) !== contentSignature.playerCount) continue;
      
      // Check total rounds (support both formats)
      const similarTotalRounds = similarData.total_rounds || similarData.totals?.total_rounds || 0;
      if (similarTotalRounds !== contentSignature.totalRounds) continue;
      
      // Check winner (support both formats and arrays)
      const similarWinnerIdJson = JSON.stringify(normalizeWinnerId({ winner_ids: similarData.winner_ids, winner_id: similarData.winner_id || similarData.totals?.winner_id }));
      if (similarWinnerIdJson !== contentSignature.winnerIdJson) continue;
      
      // Check final scores (support both formats)
      const similarScores = JSON.stringify(similarData.final_scores || similarData.totals?.final_scores || {});
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

    // Invalidate leaderboard cache when new game is created
    if (cache.isConnected) {
      await cache.delPattern('leaderboard:*');
    }

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
    const { gameType, page = 1, limit = 50 } = req.query;
    
    // Create cache key based on query parameters
    const cacheKey = `leaderboard:${gameType || 'all'}:${page}:${limit}`;
    
    // Try to get from cache first
    if (cache.isConnected) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        console.debug('✅ Leaderboard served from cache');
        return res.json(cached);
      }
    }
    
    // Fetch both Wizard games and Table games
    const TableGame = require('../models/TableGame');
    const WizardGame = require('../models/WizardGame');
    
    // Fetch all users to create a username -> userId mapping for player linking
    const User = require('../models/User');
    const allUsers = await User.find({}).select('_id username').lean();
    const usernameToUserIdMap = {};
    allUsers.forEach(user => {
      usernameToUserIdMap[user.username.toLowerCase()] = user._id.toString();
    });
    console.log(`[Leaderboard] Loaded ${allUsers.length} users for username mapping`);
    
    // Fetch all player aliases to consolidate stats
    const PlayerAlias = require('../models/PlayerAlias');
    const allAliases = await PlayerAlias.find({}).populate('userId', 'username').lean();
    const aliasToUsernameMap = {}; // Maps alias name -> registered username
    allAliases.forEach(alias => {
      if (alias.userId && alias.userId.username) {
        aliasToUsernameMap[alias.aliasName.toLowerCase()] = alias.userId.username.toLowerCase();
      }
    });
    console.log(`[Leaderboard] Loaded ${allAliases.length} player aliases for consolidation`);
    
    // Track original name casing for display
    const originalNameCasing = {}; // Maps lowercase canonical name -> first seen original casing
    
    // Helper function: Resolve a player name to the canonical username (via alias or direct match)
    const resolvePlayerName = (playerName) => {
      const lowerName = playerName.toLowerCase();
      // First check if this name is an alias - if so, use the linked username
      if (aliasToUsernameMap[lowerName]) {
        return aliasToUsernameMap[lowerName];
      }
      // Otherwise use the name as-is (lowercase for grouping)
      return lowerName;
    };
    
    // Helper function: Get the display name for a canonical username
    const getDisplayName = (canonicalName, originalPlayerName) => {
      // First, check if there's a registered user with this username
      const user = allUsers.find(u => u.username.toLowerCase() === canonicalName);
      if (user) {
        return user.username; // Use registered user's actual casing
      }
      
      // For non-registered players, preserve the original casing from games
      // Store the first seen casing for this canonical name
      if (!originalNameCasing[canonicalName] && originalPlayerName) {
        originalNameCasing[canonicalName] = originalPlayerName;
      }
      
      return originalNameCasing[canonicalName] || canonicalName;
    };
    
    // Get wizard games from WizardGame collection - only fetch needed fields
    const wizardGames = await WizardGame.find({}, {
      'gameData.players': 1,
      'gameData.winner_id': 1,
      'gameData.winner_ids': 1,
      'gameData.final_scores': 1,
      'userId': 1,
      'createdAt': 1
    }).lean(); // Use lean() for better performance
    
    // Get table games (from TableGame collection) - only fetch needed fields
    const tableGames = await TableGame.find({}, {
      'gameData': 1,
      'gameTypeName': 1,
      'lowIsBetter': 1,
      'createdAt': 1
    }).lean(); // Use lean() for better performance
    
    // Calculate player statistics grouped by NAME (not ID)
    const playerStats = {};
    const gameTypeSet = new Set(['all', 'Wizard']); // Start with 'all' and 'Wizard'
    const gameTypeSettings = { 'Wizard': { lowIsBetter: false } }; // Track lowIsBetter per game type
    
    // First, collect all available game types from table games
    tableGames.forEach(game => {
      const gameMode = game.gameTypeName || game.gameData?.gameName || 'Table Game';
      if (gameMode && gameMode !== 'Table Game') {
        gameTypeSet.add(gameMode);
        // Store the lowIsBetter setting for this game type
        const lowIsBetter = game.lowIsBetter || game.gameData?.lowIsBetter || false;
        if (!gameTypeSettings[gameMode]) {
          gameTypeSettings[gameMode] = { lowIsBetter };
        }
      }
    });
    
    // Process Wizard games
    wizardGames.forEach(game => {
      const gameData = game.gameData;
      if (!gameData || !gameData.players || !Array.isArray(gameData.players)) {
        return;
      }

      const gameMode = 'Wizard'; // All games from Game collection are Wizard
      const winnerIdRaw = gameData.winner_ids || gameData.winner_id || gameData.totals?.winner_ids || gameData.totals?.winner_id;
      const winnerIds = Array.isArray(winnerIdRaw) ? winnerIdRaw : (winnerIdRaw ? [winnerIdRaw] : []);
      const finalScores = gameData.final_scores || gameData.totals?.final_scores || {};

      gameData.players.forEach(player => {
        const playerId = player.id;
        const playerName = player.name;
        
        // Skip players without a name
        if (!playerName) return;

        // Filter by game type if specified
        if (gameType && gameType !== 'all' && gameType !== gameMode) {
          return;
        }

        // Resolve player name to canonical username (via alias if applicable)
        const canonicalName = resolvePlayerName(playerName);
        const displayName = getDisplayName(canonicalName, playerName);
        
        if (!playerStats[canonicalName]) {
          // Look up userId by matching canonical username
          const lookupUserId = usernameToUserIdMap[canonicalName];
          
          playerStats[canonicalName] = {
            id: canonicalName,
            name: displayName, // Use registered username for display
            userId: lookupUserId, // Store userId for linking to profiles
            totalGames: 0,
            wins: 0,
            totalScore: 0,
            gameTypes: {},
            lastPlayed: game.createdAt
          };
        } else {
          // Update display name if user has changed their username
          playerStats[canonicalName].name = displayName;
          
          // Try to look up by username if we didn't have it before
          if (!playerStats[canonicalName].userId) {
            const lookupUserId = usernameToUserIdMap[canonicalName];
            if (lookupUserId) {
              playerStats[canonicalName].userId = lookupUserId;
            }
          }
        }

        const stats = playerStats[canonicalName];
        
        stats.totalGames++;
        
        // Check if player is one of the winners (handles draws)
        const isWinner = winnerIds.includes(playerId);
        
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
      
      // Find winner(s) - highest or lowest score depending on lowIsBetter (supports draws)
      let winnerIds = [];
      if (Object.keys(finalScores).length > 0) {
        const lowIsBetter = game.lowIsBetter || outerGameData?.lowIsBetter || gameData.lowIsBetter || false;
        const scores = Object.entries(finalScores);
        
        if (lowIsBetter) {
          const minScore = Math.min(...scores.map(s => s[1]));
          winnerIds = scores.filter(s => s[1] === minScore).map(s => s[0]);
        } else {
          const maxScore = Math.max(...scores.map(s => s[1]));
          winnerIds = scores.filter(s => s[1] === maxScore).map(s => s[0]);
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

        // Resolve player name to canonical username (via alias if applicable)
        const canonicalName = resolvePlayerName(playerName);
        const displayName = getDisplayName(canonicalName, playerName);
        
        if (!playerStats[canonicalName]) {
          // Look up userId by matching canonical username
          const lookupUserId = usernameToUserIdMap[canonicalName];
          
          playerStats[canonicalName] = {
            id: canonicalName,
            name: displayName, // Use registered username for display
            userId: lookupUserId, // Store userId for linking to profiles
            totalGames: 0,
            wins: 0,
            totalScore: 0,
            gameTypes: {},
            lastPlayed: game.createdAt
          };
        } else {
          // Update display name if user has changed their username
          playerStats[canonicalName].name = displayName;
          
          // Try to look up by username if we didn't have it before
          if (!playerStats[canonicalName].userId) {
            const lookupUserId = usernameToUserIdMap[canonicalName];
            if (lookupUserId) {
              playerStats[canonicalName].userId = lookupUserId;
            }
          }
        }

        const stats = playerStats[canonicalName];
        
        stats.totalGames++;
        
        const isWinner = winnerIds.includes(playerId);
        
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

    // Determine if lower scores are better for the selected game type
    const selectedGameLowIsBetter = gameType && gameType !== 'all' 
      ? gameTypeSettings[gameType]?.lowIsBetter || false 
      : false;

    // Sort by wins, then win rate, then by score (considering lowIsBetter), then total games
    leaderboard.sort((a, b) => {
      // Primary sort: wins
      if (b.wins !== a.wins) return b.wins - a.wins;
      
      // Tiebreaker 1: win rate
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      
      // Tiebreaker 2: average score (direction depends on game type)
      if (a.avgScore !== b.avgScore) {
        if (selectedGameLowIsBetter) {
          // For low-is-better games, lower average is better
          return a.avgScore - b.avgScore;
        } else {
          // For high-is-better games, higher average is better
          return b.avgScore - a.avgScore;
        }
      }
      
      // Tiebreaker 3: total games
      return b.totalGames - a.totalGames;
    });

    // Get unique game types
    const gameTypes = Array.from(gameTypeSet).sort();
    
    // Apply pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 50, 100); // Max 100 per page
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedLeaderboard = leaderboard.slice(startIndex, endIndex);
    
    const response = {
      leaderboard: paginatedLeaderboard,
      gameTypes,
      gameTypeSettings, // Send the settings so frontend knows which game types have lowIsBetter
      totalGames: wizardGames.length + tableGames.length,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(leaderboard.length / limitNum),
        totalPlayers: leaderboard.length,
        hasNextPage: endIndex < leaderboard.length,
        hasPrevPage: pageNum > 1
      }
    };
    
    // Cache the result for 5 minutes
    if (cache.isConnected) {
      await cache.set(cacheKey, response, 300); // 5 minute TTL
    }
    
    res.json(response);
  } catch (error) {
    console.error('[GET /api/games/leaderboard] Error:', error);
    console.error('[GET /api/games/leaderboard] Error stack:', error.stack);
    res.status(500).json({ error: error.message, details: error.stack });
  }
});

// POST /games/batch-check - Check existence of multiple games by their IDs
// IMPORTANT: This must come BEFORE /:id route to avoid conflicts
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
    
    // Check which games exist in database - optimized query
    const existingGames = await Game.find({
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
    console.error('[POST /api/games/batch-check] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /games/:id - Get a game by MongoDB _id
router.get('/:id', async (req, res) => {
  try {
    // Validate ID format to prevent injection
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid game ID format' });
    }

    const game = await Game.findOne({ _id: { $eq: req.params.id } });
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

    // Validate ID format to prevent injection
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid game ID format' });
    }

    // Check if shareId is already in use
    const existingSharedGame = await Game.findOne({ shareId });
    if (existingSharedGame && existingSharedGame._id.toString() !== req.params.id) {
      return res.status(409).json({ error: 'Share ID already in use' });
    }

    // Verify user owns the game
    const game = await Game.findOne({ _id: { $eq: req.params.id } });
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
      .select('_id userId localId gameData shareId createdAt') // Only select needed fields
      .sort({ createdAt: sortDirection })
      .skip(skip)
      .limit(limitNum)
      .lean(); // Use lean() for better performance
    
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
