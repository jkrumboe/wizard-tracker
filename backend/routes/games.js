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
    
    // Fetch all users and player identities for ID-based matching
    const User = require('../models/User');
    const PlayerIdentity = require('../models/PlayerIdentity');
    
    const allUsers = await User.find({ role: { $ne: 'guest' } }).select('_id username').lean();
    const userIdMap = {}; // Maps userId string -> user object
    allUsers.forEach(user => {
      userIdMap[user._id.toString()] = user;
    });
    console.log(`[Leaderboard] Loaded ${allUsers.length} users`);
    
    // Load all identities to map identityId -> userId and get ELO data
    const allIdentities = await PlayerIdentity.find({ isDeleted: false })
      .select('_id userId displayName eloByGameType')
      .lean();
    const identityToUserIdMap = {}; // Maps identityId string -> userId string
    const userDisplayNames = {}; // Maps userId string -> display name
    
    const userEloByGameType = {}; // Maps userId string -> { gameType: elo data }
    
    allIdentities.forEach(identity => {
      const identityIdStr = identity._id.toString();
      const userIdStr = identity.userId?.toString();
      
      if (userIdStr) {
        identityToUserIdMap[identityIdStr] = userIdStr;
        
        // Use registered username if available, otherwise use identity displayName
        if (!userDisplayNames[userIdStr]) {
          const user = userIdMap[userIdStr];
          userDisplayNames[userIdStr] = user ? user.username : identity.displayName;
        }
        
        // Store ELO data for this user
        if (identity.eloByGameType) {
          userEloByGameType[userIdStr] = identity.eloByGameType;
        }
      }
    });
    
    console.log(`[Leaderboard] Loaded ${allIdentities.length} player identities`);
    
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
    
    // Calculate player statistics grouped by USER ID (using identity system)
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
        const playerOriginalId = player.originalId;
        const playerName = player.name;
        const identityId = player.identityId;
        
        // Skip players without identity (shouldn't happen after migration)
        if (!identityId) {
          console.warn(`[Leaderboard] Player without identityId in game: ${playerName}`);
          return;
        }

        // Filter by game type if specified
        if (gameType && gameType !== 'all' && gameType !== gameMode) {
          return;
        }

        // Map identityId to userId using identity system
        const identityIdStr = identityId.toString();
        const userId = identityToUserIdMap[identityIdStr];
        
        if (!userId) {
          console.warn(`[Leaderboard] No userId found for identity ${identityIdStr}`);
          return;
        }
        
        const displayName = userDisplayNames[userId] || playerName;
        
        if (!playerStats[userId]) {
          playerStats[userId] = {
            id: userId,
            name: displayName,
            userId: userId,
            totalGames: 0,
            wins: 0,
            totalScore: 0,
            gameTypes: {},
            lastPlayed: game.createdAt
          };
        }

        const stats = playerStats[userId];
        
        stats.totalGames++;
        
        // Check if player is one of the winners (handles draws)
        // Check both player.id and player.originalId since winner_ids may contain either
        const isWinner = winnerIds.includes(playerId) || 
                        (playerOriginalId && winnerIds.includes(playerOriginalId)) ||
                        winnerIds.some(id => String(id) === String(playerId)) ||
                        (playerOriginalId && winnerIds.some(id => String(id) === String(playerOriginalId)));
        
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
      let winnerNameLower = null;
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
      
      // Fallback: check winner_name for players without proper IDs
      const winnerName = gameData.winner_name || outerGameData?.winner_name;
      if (winnerName) {
        winnerNameLower = winnerName.toLowerCase();
      }

      gameData.players.forEach((player, index) => {
        const playerId = `player_${index}`;
        const playerName = player.name;
        const identityId = player.identityId;
        
        // Skip players without identity
        if (!identityId) {
          console.warn(`[Leaderboard] Player without identityId in table game: ${playerName}`);
          return;
        }

        // Filter by game type if specified
        if (gameType && gameType !== 'all' && gameType !== gameMode) {
          return;
        }

        // Map identityId to userId using identity system
        const identityIdStr = identityId.toString();
        const userId = identityToUserIdMap[identityIdStr];
        
        if (!userId) {
          console.warn(`[Leaderboard] No userId found for identity ${identityIdStr}`);
          return;
        }
        
        const displayName = userDisplayNames[userId] || playerName;
        
        if (!playerStats[userId]) {
          playerStats[userId] = {
            id: userId,
            name: displayName,
            userId: userId,
            totalGames: 0,
            wins: 0,
            totalScore: 0,
            gameTypes: {},
            lastPlayed: game.createdAt
          };
        }

        const stats = playerStats[userId];
        
        stats.totalGames++;
        
        // Check winner by ID or by name (fallback for guests without proper IDs)
        const isWinnerById = winnerIds.includes(playerId);
        const isWinnerByName = winnerNameLower && playerName.toLowerCase() === winnerNameLower;
        const isWinner = isWinnerById || isWinnerByName;
        
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

    // Helper function to normalize game type for ELO lookup
    const normalizeGameType = (type) => {
      if (!type) return 'wizard';
      return type.toLowerCase().replace(/\s+/g, '-');
    };

    // Convert to array and calculate derived stats
    const leaderboard = Object.values(playerStats).map(player => {
      const winRate = player.totalGames > 0 
        ? ((player.wins / player.totalGames) * 100).toFixed(1) 
        : 0;
      const avgScore = player.totalGames > 0 
        ? (player.totalScore / player.totalGames).toFixed(1) 
        : 0;

      // Get ELO for this player for the selected game type
      const userElo = userEloByGameType[player.userId];
      let elo = 1000; // Default ELO
      if (userElo) {
        if (gameType && gameType !== 'all') {
          const normalizedType = normalizeGameType(gameType);
          const eloData = userElo[normalizedType] || userElo.get?.(normalizedType);
          if (eloData) {
            elo = eloData.rating || 1000;
          }
        } else {
          // For 'all', use the highest ELO across all game types
          let maxElo = 1000;
          const eloEntries = userElo instanceof Map ? [...userElo.entries()] : Object.entries(userElo);
          for (const [, eloData] of eloEntries) {
            if (eloData && eloData.rating > maxElo) {
              maxElo = eloData.rating;
            }
          }
          elo = maxElo;
        }
      }

      return {
        ...player,
        winRate: parseFloat(winRate),
        avgScore: parseFloat(avgScore),
        elo: Math.round(elo)
      };
    });

    // Determine if lower scores are better for the selected game type
    const selectedGameLowIsBetter = gameType && gameType !== 'all' 
      ? gameTypeSettings[gameType]?.lowIsBetter || false 
      : false;

    // Sort by ELO, then wins, then avg score (considering lowIsBetter), then win rate
    leaderboard.sort((a, b) => {
      // Primary sort: ELO (higher is better)
      if (b.elo !== a.elo) return b.elo - a.elo;
      
      // Tiebreaker 1: wins
      if (b.wins !== a.wins) return b.wins - a.wins;
      
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
      
      // Tiebreaker 3: win rate
      return b.winRate - a.winRate;
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

// GET /games/recent - Get recent games (public endpoint for homepage)
// PUBLIC ENDPOINT - No authentication required
router.get('/recent', async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100); // Max 100 games

    // Create cache key
    const cacheKey = `recent-games:${limitNum}`;

    // Try to get from cache first
    if (cache.isConnected) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        console.debug('✅ Recent games served from cache');
        return res.json(cached);
      }
    }

    // Fetch both Wizard games and Table games
    const TableGame = require('../models/TableGame');
    const WizardGame = require('../models/WizardGame');

    // Get recent wizard games
    const wizardGames = await WizardGame.find({})
      .select('_id localId gameData createdAt')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    // Get recent table games (only finished ones)
    const tableGames = await TableGame.find({ gameFinished: true })
      .select('_id localId name gameTypeName gameData gameFinished playerCount totalRounds createdAt')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    // Format wizard games
    const formattedWizardGames = wizardGames.map(game => {
      const gameData = game.gameData || {};
      return {
        id: game._id,
        cloudId: game._id,
        localId: game.localId,
        players: (gameData.players || []).map(p => ({
          name: p.name || p.username || 'Unknown',
          id: p.id
        })),
        winner_id: gameData.winner_id || gameData.winner_ids?.[0],
        final_scores: gameData.final_scores || {},
        created_at: game.createdAt || gameData.created_at,
        total_rounds: gameData.total_rounds || 0,
        gameFinished: gameData.gameFinished !== false,
        gameType: 'wizard'
      };
    });

    // Format table games
    const formattedTableGames = tableGames.map(game => {
      const gameData = game.gameData || {};
      const players = gameData.players || [];
      
      // Calculate winner based on scores
      let winnerName = "Not determined";
      if (players.length > 0) {
        const playersWithScores = players.map(player => {
          const total = (player.points || []).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0);
          return { ...player, total };
        });

        const lowIsBetter = gameData.lowIsBetter || false;
        const winner = playersWithScores.reduce((best, current) => {
          if (!best) return current;
          if (lowIsBetter) {
            return current.total < best.total ? current : best;
          } else {
            return current.total > best.total ? current : best;
          }
        }, null);

        winnerName = winner?.name || "Not determined";
      }

      return {
        id: game._id,
        cloudId: game._id,
        localId: game.localId,
        name: game.name || game.gameTypeName || 'Table Game',
        players: players.map(p => p.name || 'Unknown'),
        created_at: game.createdAt,
        totalRounds: game.totalRounds || 0,
        gameFinished: game.gameFinished,
        gameType: 'table',
        winner_name: winnerName
      };
    });

    // Combine and sort by date
    const allGames = [...formattedWizardGames, ...formattedTableGames]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limitNum);

    const response = {
      games: allGames,
      totalGames: allGames.length
    };

    // Cache the result for 2 minutes
    if (cache.isConnected) {
      await cache.set(cacheKey, response, 120); // 2 minute TTL
    }

    res.json(response);
  } catch (error) {
    console.error('[GET /api/games/recent] Error:', error);
    res.status(500).json({ error: error.message });
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

// POST /games/friend-leaderboard - Get head-to-head statistics for selected players
// PUBLIC ENDPOINT - No authentication required
router.post('/friend-leaderboard', async (req, res, next) => {
  try {
    const { playerNames, gameType } = req.body;
    
    if (!Array.isArray(playerNames) || playerNames.length < 2) {
      return res.status(400).json({ error: 'At least 2 player names are required' });
    }
    
    if (playerNames.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 players allowed' });
    }
    
    // Helper to check for dangerous property names that could cause prototype pollution
    const isDangerousKey = (key) => {
      return key === '__proto__' || key === 'constructor' || key === 'prototype';
    };
    
    // Normalize player names for comparison and filter out dangerous keys
    const normalizedPlayerNames = playerNames
      .map(name => name.toLowerCase().trim())
      .filter(name => !isDangerousKey(name));
    
    // Build identity lookup maps using PlayerIdentity
    const PlayerIdentity = require('../models/PlayerIdentity');
    
    // Find all identities that match the player names (by name or identity aliases)
    const matchingIdentities = await PlayerIdentity.find({
      isDeleted: false,
      $or: [
        { normalizedName: { $in: normalizedPlayerNames } },
        { 'aliases.normalizedName': { $in: normalizedPlayerNames } }
      ]
    }).populate('userId', 'username').lean();
    
    // Also find guest identities that are merged into the matching identities
    const matchingIdentityIds = matchingIdentities.map(i => i._id);
    const mergedGuestIdentities = await PlayerIdentity.find({
      isDeleted: false,
      mergedInto: { $in: matchingIdentityIds }
    }).lean();
    
    // Build maps for identity resolution
    const nameToIdentityMap = Object.create(null); // name -> identityId
    const identityToCanonicalMap = Object.create(null); // identityId -> canonicalName
    const identityIdSet = new Set();
    
    // Process matching identities
    matchingIdentities.forEach(identity => {
      const identityId = identity._id.toString();
      const canonicalName = identity.userId?.username?.toLowerCase() || identity.displayName.toLowerCase();
      
      identityToCanonicalMap[identityId] = canonicalName;
      identityIdSet.add(identityId);
      
      // Map display name to identity
      if (!isDangerousKey(identity.normalizedName)) {
        nameToIdentityMap[identity.normalizedName] = identityId;
      }
      
      // Map all aliases to identity
      if (identity.aliases) {
        identity.aliases.forEach(alias => {
          if (!isDangerousKey(alias.normalizedName)) {
            nameToIdentityMap[alias.normalizedName] = identityId;
          }
        });
      }
      
      // Also check linked identities
      if (identity.linkedIdentities) {
        identity.linkedIdentities.forEach(li => {
          const linkedId = li.identityId.toString();
          identityToCanonicalMap[linkedId] = canonicalName;
          identityIdSet.add(linkedId);
        });
      }
    });
    
    // Process merged guest identities (e.g., Feemke merged into feemi)
    mergedGuestIdentities.forEach(guestIdentity => {
      const guestIdentityId = guestIdentity._id.toString();
      const parentIdentityId = guestIdentity.mergedInto.toString();
      
      // Find the canonical name from the parent identity
      if (identityToCanonicalMap[parentIdentityId]) {
        const canonicalName = identityToCanonicalMap[parentIdentityId];
        identityToCanonicalMap[guestIdentityId] = canonicalName;
        identityIdSet.add(guestIdentityId);
        
        // Map the guest's display name to point to this identity
        if (!isDangerousKey(guestIdentity.normalizedName)) {
          nameToIdentityMap[guestIdentity.normalizedName] = guestIdentityId;
        }
        
        // Map the guest's aliases too
        if (guestIdentity.aliases) {
          guestIdentity.aliases.forEach(alias => {
            if (!isDangerousKey(alias.normalizedName)) {
              nameToIdentityMap[alias.normalizedName] = guestIdentityId;
            }
          });
        }
      }
    });
    
    // Helper function: Resolve a player name to the canonical username
    const resolvePlayerName = (playerName, playerId = null, identityId = null) => {
      const lowerName = playerName?.toLowerCase().trim();
      
      // First try by identityId if available
      if (identityId) {
        const idStr = identityId.toString();
        if (identityToCanonicalMap[idStr]) {
          return identityToCanonicalMap[idStr];
        }
      }
      
      // Then try by name in identity map
      if (lowerName && nameToIdentityMap[lowerName]) {
        const identityId = nameToIdentityMap[lowerName];
        if (identityToCanonicalMap[identityId]) {
          return identityToCanonicalMap[identityId];
        }
      }
      
      return lowerName;
    };
    
    // Build a set of all canonical names we're interested in (including identity aliases)
    const targetCanonicalNames = new Set();
    normalizedPlayerNames.forEach(name => {
      targetCanonicalNames.add(resolvePlayerName(name));
    });
    
    // Also add the original names in case they ARE the canonical names
    normalizedPlayerNames.forEach(name => targetCanonicalNames.add(name));
    
    // Fetch games
    const TableGame = require('../models/TableGame');
    const WizardGame = require('../models/WizardGame');
    
    const wizardGames = await WizardGame.find({}, {
      'gameData.players': 1,
      'gameData.winner_id': 1,
      'gameData.winner_ids': 1,
      'gameData.final_scores': 1,
      'createdAt': 1
    }).lean();
    
    const tableGames = await TableGame.find({}, {
      'gameData': 1,
      'gameTypeName': 1,
      'lowIsBetter': 1,
      'createdAt': 1
    }).lean();
    
    // Initialize statistics using Object.create(null) to prevent prototype pollution
    const playerStats = Object.create(null);
    const headToHead = Object.create(null); // headToHead[playerA][playerB] = { wins: 0, losses: 0, draws: 0, games: 0 }
    const sharedGames = []; // Games where at least 2 of the selected players participated
    
    // Initialize stats for each player (skip dangerous keys as extra safety)
    targetCanonicalNames.forEach(name => {
      if (isDangerousKey(name)) return;
      
      playerStats[name] = {
        name: name,
        displayName: playerNames.find(n => resolvePlayerName(n) === name) || name,
        wins: 0,
        losses: 0,
        draws: 0,
        totalGames: 0,
        totalScore: 0,
        avgScore: 0,
        winRate: 0,
        gamesWithFriends: 0
      };
      headToHead[name] = Object.create(null);
      targetCanonicalNames.forEach(otherName => {
        if (name !== otherName && !isDangerousKey(otherName)) {
          headToHead[name][otherName] = { wins: 0, losses: 0, draws: 0, games: 0 };
        }
      });
    });
    
    // Process Wizard games
    wizardGames.forEach(game => {
      const gameData = game.gameData;
      if (!gameData || !gameData.players || !Array.isArray(gameData.players)) return;
      
      const gameMode = 'Wizard';
      if (gameType && gameType !== 'all' && gameType !== gameMode) return;
      
      // Get participants from this game that are in our target list
      const participantsInGame = [];
      const playerIdToCanonical = {};
      
      gameData.players.forEach(player => {
        if (!player.name) return;
        // Use identityId for resolution if available, fallback to name
        const canonical = resolvePlayerName(player.name, player.id, player.identityId);
        if (targetCanonicalNames.has(canonical)) {
          participantsInGame.push({ 
            id: player.id, 
            identityId: player.identityId?.toString(),
            canonical, 
            originalName: player.name 
          });
          playerIdToCanonical[player.id] = canonical;
        }
      });
      
      // Only process games where at least 2 of our target players participated
      if (participantsInGame.length < 2) return;
      
      const winnerIdRaw = gameData.winner_ids || gameData.winner_id || gameData.totals?.winner_ids || gameData.totals?.winner_id;
      const winnerIds = Array.isArray(winnerIdRaw) ? winnerIdRaw : (winnerIdRaw ? [winnerIdRaw] : []);
      const finalScores = gameData.final_scores || gameData.totals?.final_scores || {};
      
      // Determine who won among our participants
      const participantWinners = participantsInGame.filter(p => winnerIds.includes(p.id));
      const isDraw = participantWinners.length > 1;
      
      // Update stats for each participant
      participantsInGame.forEach(participant => {
        const stats = playerStats[participant.canonical];
        if (!stats) return;
        
        stats.gamesWithFriends++;
        stats.totalGames++;
        
        const isWinner = winnerIds.includes(participant.id);
        
        if (isDraw && isWinner) {
          stats.draws++;
        } else if (isWinner) {
          stats.wins++;
        } else {
          stats.losses++;
        }
        
        if (finalScores[participant.id] !== undefined) {
          stats.totalScore += finalScores[participant.id];
        }
        
        // Update head-to-head against other participants
        participantsInGame.forEach(opponent => {
          if (opponent.canonical === participant.canonical) return;
          
          const h2h = headToHead[participant.canonical]?.[opponent.canonical];
          if (!h2h) return;
          
          h2h.games++;
          
          const iWon = winnerIds.includes(participant.id);
          const opponentWon = winnerIds.includes(opponent.id);
          
          if (iWon && opponentWon) {
            // Both tied for 1st - it's a draw between them
            h2h.draws++;
          } else if (iWon && !opponentWon) {
            // I won (even if tied with others), opponent didn't
            h2h.wins++;
          } else if (!iWon && opponentWon) {
            // Opponent won, I didn't
            h2h.losses++;
          }
          // If neither won (3rd player won), don't count as win/loss/draw
        });
      });
      
      // Add to shared games
      sharedGames.push({
        id: game._id,
        type: 'Wizard',
        date: game.createdAt,
        players: participantsInGame.map(p => ({
          name: p.originalName,
          canonical: p.canonical,
          score: finalScores[p.id] || 0,
          won: winnerIds.includes(p.id)
        }))
      });
    });
    
    // Process Table games
    tableGames.forEach(game => {
      const outerGameData = game.gameData;
      const gameData = outerGameData?.gameData || outerGameData;
      
      if (!gameData || !gameData.players || !Array.isArray(gameData.players)) return;
      
      const gameMode = game.gameTypeName || game.gameData?.gameName || 'Table Game';
      if (gameType && gameType !== 'all' && gameType !== gameMode) return;
      
      // Get participants from this game that are in our target list
      const participantsInGame = [];
      const playerIndexToCanonical = {};
      
      gameData.players.forEach((player, index) => {
        if (!player.name) return;
        // Use identityId for resolution if available, fallback to name
        const canonical = resolvePlayerName(player.name, player.id || player.originalId, player.identityId);
        if (targetCanonicalNames.has(canonical)) {
          const playerId = player.id || player.originalId || `player_${index}`;
          participantsInGame.push({ 
            id: playerId, 
            index, 
            identityId: player.identityId?.toString(),
            canonical, 
            originalName: player.name 
          });
          playerIndexToCanonical[index] = canonical;
        }
      });
      
      // Only process games where at least 2 of our target players participated
      if (participantsInGame.length < 2) return;
      
      // Calculate final scores from points arrays
      const finalScores = {};
      gameData.players.forEach((player, index) => {
        const playerId = player.id || player.originalId || `player_${index}`;
        const points = player.points || [];
        const totalScore = points.reduce((sum, p) => {
          const parsed = parseFloat(p);
          return sum + (isNaN(parsed) ? 0 : parsed);
        }, 0);
        finalScores[playerId] = totalScore;
      });
      
      // Find winner(s) - first try to calculate from scores
      let winnerIds = [];
      let winnerNameLower = null;
      const lowIsBetter = game.lowIsBetter || outerGameData?.lowIsBetter || gameData.lowIsBetter || false;
      if (Object.keys(finalScores).length > 0) {
        const scores = Object.entries(finalScores);
        
        if (lowIsBetter) {
          const minScore = Math.min(...scores.map(s => s[1]));
          winnerIds = scores.filter(s => s[1] === minScore).map(s => s[0]);
        } else {
          const maxScore = Math.max(...scores.map(s => s[1]));
          winnerIds = scores.filter(s => s[1] === maxScore).map(s => s[0]);
        }
      }
      
      // Fallback: check winner_name for players without proper IDs
      const winnerName = gameData.winner_name || outerGameData?.winner_name;
      if (winnerName) {
        winnerNameLower = winnerName.toLowerCase();
      }
      
      // Check winners by ID or by name
      const isWinnerByIdOrName = (participant) => {
        if (winnerIds.includes(participant.id)) return true;
        if (winnerNameLower && participant.originalName?.toLowerCase() === winnerNameLower) return true;
        return false;
      };
      
      const participantWinners = participantsInGame.filter(p => isWinnerByIdOrName(p));
      const isDraw = participantWinners.length > 1;
      
      // Update stats for each participant
      participantsInGame.forEach(participant => {
        const stats = playerStats[participant.canonical];
        if (!stats) return;
        
        stats.gamesWithFriends++;
        stats.totalGames++;
        
        const isWinner = isWinnerByIdOrName(participant);
        
        if (isDraw && isWinner) {
          stats.draws++;
        } else if (isWinner) {
          stats.wins++;
        } else {
          stats.losses++;
        }
        
        if (finalScores[participant.id] !== undefined) {
          stats.totalScore += finalScores[participant.id];
        }
        
        // Update head-to-head against other participants
        participantsInGame.forEach(opponent => {
          if (opponent.canonical === participant.canonical) return;
          
          const h2h = headToHead[participant.canonical]?.[opponent.canonical];
          if (!h2h) return;
          
          h2h.games++;
          
          const iWon = isWinnerByIdOrName(participant);
          const opponentWon = isWinnerByIdOrName(opponent);
          
          if (iWon && opponentWon) {
            // Both tied for 1st - it's a draw between them
            h2h.draws++;
          } else if (iWon && !opponentWon) {
            // I won (even if tied with others), opponent didn't
            h2h.wins++;
          } else if (!iWon && opponentWon) {
            // Opponent won, I didn't
            h2h.losses++;
          }
          // If neither won (3rd player won), don't count as win/loss/draw
        });
      });
      
      // Add to shared games
      sharedGames.push({
        id: game._id,
        type: gameMode,
        date: game.createdAt,
        players: participantsInGame.map(p => ({
          name: p.originalName,
          canonical: p.canonical,
          score: finalScores[p.id] || 0,
          won: isWinnerByIdOrName(p)
        }))
      });
    });
    
    // Calculate derived stats and build response
    const leaderboard = Object.values(playerStats)
      .filter(stats => stats.gamesWithFriends > 0)
      .map(stats => ({
        ...stats,
        avgScore: stats.totalGames > 0 ? parseFloat((stats.totalScore / stats.totalGames).toFixed(1)) : 0,
        winRate: stats.totalGames > 0 ? parseFloat(((stats.wins / stats.totalGames) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => {
        // Sort by wins first, then win rate, then avg score
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.avgScore - a.avgScore;
      });
    
    // Sort shared games by date (most recent first)
    sharedGames.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json({
      leaderboard,
      headToHead,
      recentGames: sharedGames,
      totalSharedGames: sharedGames.length
    });
    
  } catch (error) {
    console.error('[POST /api/games/friend-leaderboard] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
