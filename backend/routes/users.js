const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const PlayerAlias = require('../models/PlayerAlias');
const PlayerIdentity = require('../models/PlayerIdentity');
const auth = require('../middleware/auth');
const { authLimiter, friendsLimiter } = require('../middleware/rateLimiter');
const _ = require('lodash'); // Added for escapeRegExp
const mongoose = require('mongoose');
const cache = require('../utils/redis');
const { linkGamesToNewUser } = require('../utils/gameUserLinkage');
const identityService = require('../utils/identityService');
const router = express.Router();

// POST /users/register - Create new user (with strict rate limiting)
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (typeof username !== "string") {
      return res.status(400).json({ error: 'Username must be a string' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists (case-insensitive to match identity system)
    const escapedUsername = _.escapeRegExp(username);
    const existingUser = await User.findOne({ 
      username: { $regex: new RegExp(`^${escapedUsername}$`, 'i') }
    });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new User({
      username,
      passwordHash
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // ========== Claim/Create Player Identity & Link Previous Games ==========
    // This runs in the background and doesn't block the registration response
    // If it fails, registration still succeeds
    setImmediate(async () => {
      try {
        // 1. Claim or create player identity for the new user
        console.log('\n🎭 Claiming/creating identity for new user: %s', username);
        const identityResult = await identityService.claimIdentitiesOnRegistration(user);
        
        if (identityResult.claimed.length > 0) {
          console.log('✅ Claimed %d existing identities for %s', identityResult.claimed.length, username);
        }
        if (identityResult.created) {
          console.log('✅ Created new identity for %s', username);
        }
        if (identityResult.errors.length > 0) {
          console.warn('⚠️  Identity claim completed with errors:', identityResult.errors);
        }

        // 2. Also run legacy game linkage for backward compatibility
        console.log('\n🎮 Attempting to link previous games for new user: %s', username);
        const linkageResults = await linkGamesToNewUser(username, user._id);
        
        if (linkageResults.success) {
          const totalLinked = linkageResults.gamesLinked + 
                            linkageResults.wizardGamesLinked + 
                            linkageResults.tableGamesLinked;
          console.log('✅ Successfully linked %d previous games to %s', totalLinked, username);
        } else if (linkageResults.errors.length > 0) {
          console.warn('⚠️  Game linkage completed with errors for %s:', username, 
            linkageResults.errors);
        }
      } catch (linkError) {
        // Log the error but don't fail the registration
        console.error('❌ Failed to process identities/games for %s:', username, linkError.message);
        console.error('   Registration succeeded, but identity/game processing failed');
      }
    });

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role || 'user',
        createdAt: user.createdAt,
        profilePicture: user.profilePicture || null
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /users/login - Verify credentials and return JWT (with strict rate limiting)
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (typeof username !== "string") {
      return res.status(400).json({ error: "Invalid username format" });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role || 'user',
        createdAt: user.createdAt,
        profilePicture: user.profilePicture || null
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /users/me/link-games - Manually link games to current user (protected route)
// Useful if automatic linkage failed during registration or for retroactive linking
router.post('/me/link-games', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const username = req.user.username;

    console.log('🔗 Manual game linkage requested for user: %s', username);

    // Run the game linkage
    const linkageResults = await linkGamesToNewUser(username, userId);

    const totalLinked = linkageResults.gamesLinked + 
                       linkageResults.wizardGamesLinked + 
                       linkageResults.tableGamesLinked;

    res.json({
      success: linkageResults.success,
      message: totalLinked > 0 
        ? `Successfully linked ${totalLinked} game(s) to your account`
        : 'No games found to link',
      details: {
        gamesLinked: linkageResults.gamesLinked,
        wizardGamesLinked: linkageResults.wizardGamesLinked,
        tableGamesLinked: linkageResults.tableGamesLinked,
        totalLinked: totalLinked,
        errors: linkageResults.errors.length > 0 ? linkageResults.errors : undefined
      }
    });
  } catch (error) {
    console.error('Error in manual game linkage:', error);
    next(error);
  }
});

// GET /users/me - Get current user info (protected route)
router.get('/me', auth, async (req, res, next) => {
  try {
    // User is already attached to req by auth middleware
    res.json({
      user: {
        id: req.user._id,
        username: req.user.username,
        role: req.user.role || 'user',
        createdAt: req.user.createdAt,
        profilePicture: req.user.profilePicture || null
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /users/lookup/:username - Look up user by username (public endpoint for game player lookup)
router.get('/lookup/:username', async (req, res, next) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Case-insensitive username lookup with regex safely escaped
    const safeUsername = _.escapeRegExp(username);
    const user = await User.findOne({ 
      username: { $regex: new RegExp(`^${safeUsername}$`, 'i') } 
    }).select('_id username createdAt');

    if (!user) {
      return res.status(404).json({ 
        found: false,
        message: 'User not found' 
      });
    }

    res.json({
      found: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /users/:usernameOrId/profile - Get public profile for a user by username or ID
// Also works for player names without registered accounts
router.get('/:usernameOrId/profile', async (req, res, next) => {
  try {
    const { usernameOrId } = req.params;
    
    if (!usernameOrId) {
      return res.status(400).json({ error: 'Username or user ID is required' });
    }

    // Try to find registered user - by ID first, then by username
    let user;
    if (mongoose.Types.ObjectId.isValid(usernameOrId)) {
      user = await User.findById(usernameOrId).select('_id username createdAt profilePicture');
    }
    if (!user) {
      user = await User.findOne({ username: usernameOrId }).select('_id username createdAt profilePicture');
    }
    
    // If no registered user found, create a virtual user object for the player name
    const playerName = user ? user.username : usernameOrId;
    const isRegisteredUser = !!user;

    // If user is registered, fetch all their aliases to include games under alias names
    const PlayerAlias = require('../models/PlayerAlias');
    let searchNames = [playerName]; // Start with the username
    
    if (user) {
      const aliases = await PlayerAlias.find({ userId: user._id }).select('aliasName').lean();
      const aliasNames = aliases.map(alias => alias.aliasName);
      searchNames = [...searchNames, ...aliasNames];
      console.log(`[Profile] User "${playerName}" (ID: ${user._id}) has ${aliases.length} alias(es): ${aliasNames.join(', ')}`);
      console.log(`[Profile] Will search for games with names: ${searchNames.join(', ')}`);
    }
    
    // Create array of lowercase names for matching
    const searchNamesLower = searchNames.map(name => name.toLowerCase());
    console.log(`[Profile] Lowercase search names: ${searchNamesLower.join(', ')}`);

    // Get user's games from WizardGame and TableGame collections (not legacy Game collection)
    const WizardGame = require('../models/WizardGame');
    const TableGame = require('../models/TableGame');
    
    // Fetch ALL wizard games (not just by userId) since players might be identified by name
    const wizardGames = await WizardGame.find({})
      .select('gameData createdAt localId userId')
      .sort({ createdAt: -1 })
      .lean();

    // Fetch ALL table games
    const tableGames = await TableGame.find({})
      .select('gameData gameTypeName name lowIsBetter createdAt gameFinished userId')
      .sort({ createdAt: -1 })
      .lean();

    // Process games to extract relevant stats
    const allGames = [];
    const seenGameIds = new Set(); // Track unique games to avoid duplicates
    let totalWins = 0;
    
    // Process wizard games
    wizardGames.forEach(game => {
      const gameData = game.gameData;
      if (!gameData || !gameData.players) return;
      
      // Skip paused or unfinished games
      if (gameData.isPaused || gameData.gameFinished === false) return;
      
      // Use localId or _id as unique identifier to avoid duplicates
      const gameId = gameData.gameId || game.localId || String(game._id);
      if (seenGameIds.has(gameId)) return; // Skip duplicates
      
      // Find if user is a player in this game - match by username OR userId OR any alias
      const userPlayer = gameData.players.find(p => {
        const playerNameLower = p.name?.toLowerCase();
        const playerUsernameLower = p.username?.toLowerCase();
        
        // Check if player name matches any of our search names (username + aliases)
        const nameMatches = playerNameLower && searchNamesLower.includes(playerNameLower);
        const usernameMatches = playerUsernameLower && searchNamesLower.includes(playerUsernameLower);
        
        // Also match by userId if available
        const userIdMatches = user && (p.userId === String(user._id) || 
                     p.userId === user._id ||
                     String(p.userId) === String(user._id));
        
        return nameMatches || usernameMatches || userIdMatches;
      });
      
      // Skip if user is not a player in this game
      if (!userPlayer) return;
      
      seenGameIds.add(gameId); // Mark as seen
      
      const winnerIds = gameData.winner_ids || 
                       (gameData.winner_id ? (Array.isArray(gameData.winner_id) ? gameData.winner_id : [gameData.winner_id]) : []);
      
      // Check if user's player ID is in winner_ids
      const isWinner = winnerIds.includes(userPlayer.id) || winnerIds.some(id => String(id) === String(userPlayer.id));
      
      if (isWinner) totalWins++;
      
      allGames.push({
        id: game._id,
        gameType: 'wizard',
        created_at: game.createdAt,
        winner_ids: winnerIds,
        winner_id: winnerIds[0], // For backward compatibility
        gameData: {
          players: gameData.players,
          total_rounds: gameData.total_rounds,
          final_scores: gameData.final_scores,
          round_data: gameData.round_data, // Include for bid accuracy
          winner_ids: winnerIds
        }
      });
    });

    // Process table games
    tableGames.forEach(game => {
      const outerGameData = game.gameData;
      const gameData = outerGameData?.gameData || outerGameData; // Handle nested structure
      
      if (!gameData || !game.gameFinished || !gameData.players) {
        // Debug: Log why game was skipped
        if (gameData?.players?.some(p => searchNamesLower.includes(p.name?.toLowerCase()))) {
          console.log(`[Profile] SKIPPED game ${game._id}: gameFinished=${game.gameFinished}, hasGameData=${!!gameData}, hasPlayers=${!!gameData?.players}`);
        }
        return;
      }
      
      // For table games, match by player name against username or any alias
      const userPlayer = gameData.players.find(p => {
        const playerNameLower = p.name?.toLowerCase();
        return playerNameLower && searchNamesLower.includes(playerNameLower);
      });
      
      // Skip if user is not a player in this game
      if (!userPlayer) return;
      
      // Get the player index for matching with calculated winner
      const userPlayerIndex = gameData.players.findIndex(p => p === userPlayer);
      
      // Calculate final scores from points arrays (like leaderboard does)
      const finalScores = {};
      gameData.players.forEach((player, index) => {
        const playerId = `player_${index}`;
        const points = player.points || [];
        const totalScore = points.reduce((sum, p) => {
          const parsed = parseFloat(p);
          return sum + (isNaN(parsed) ? 0 : parsed);
        }, 0);
        finalScores[playerId] = totalScore;
      });
      
      // Calculate winner(s) dynamically based on scores
      let calculatedWinnerIds = [];
      const lowIsBetter = game.lowIsBetter || outerGameData?.lowIsBetter || gameData.lowIsBetter || false;
      
      if (Object.keys(finalScores).length > 0) {
        const scores = Object.entries(finalScores);
        if (lowIsBetter) {
          const minScore = Math.min(...scores.map(s => s[1]));
          calculatedWinnerIds = scores.filter(s => s[1] === minScore).map(s => s[0]);
        } else {
          const maxScore = Math.max(...scores.map(s => s[1]));
          calculatedWinnerIds = scores.filter(s => s[1] === maxScore).map(s => s[0]);
        }
      }
      
      // Use stored winner_ids as fallback
      const storedWinnerIds = gameData.winner_ids || 
                       (gameData.winner_id ? (Array.isArray(gameData.winner_id) ? gameData.winner_id : [gameData.winner_id]) : []);
      
      // Get winner name(s) for fallback matching (for guests without proper IDs)
      const winnerName = gameData.winner_name || outerGameData?.winner_name;
      const winnerNamesLower = winnerName ? [winnerName.toLowerCase()] : [];
      
      // Check winner using calculated winners (primary), then stored winner_ids, then winner_name
      const userPlayerId = `player_${userPlayerIndex}`;
      const isWinnerByCalculation = calculatedWinnerIds.includes(userPlayerId);
      const isWinnerByStoredId = storedWinnerIds.includes(userPlayer.id) || storedWinnerIds.some(id => String(id) === String(userPlayer.id));
      const isWinnerByName = userPlayer.name && winnerNamesLower.includes(userPlayer.name.toLowerCase());
      const isWinner = isWinnerByCalculation || isWinnerByStoredId || isWinnerByName;
      
      // Use calculated winner IDs for the response
      const winnerIds = calculatedWinnerIds.length > 0 ? calculatedWinnerIds : storedWinnerIds;
      
      // Debug log for table games
      console.log(`[Profile] Found table game ${game._id} (${game.gameTypeName}): player="${userPlayer.name}" playerIndex=${userPlayerIndex}, calculatedWinners=${JSON.stringify(calculatedWinnerIds)}, storedWinnerIds=${JSON.stringify(storedWinnerIds)}, winnerName="${winnerName}", isWinner=${isWinner} (byCalc=${isWinnerByCalculation}, byStoredId=${isWinnerByStoredId}, byName=${isWinnerByName})`);
      
      if (isWinner) totalWins++;
      
      allGames.push({
        id: game._id,
        gameType: 'table',
        gameTypeName: game.gameTypeName || game.name,
        name: game.name,
        created_at: game.createdAt,
        winner_ids: winnerIds,
        winner_id: winnerIds[0],
        lowIsBetter: game.lowIsBetter,
        gameData: {
          players: gameData.players,
          winner_ids: winnerIds
        }
      });
    });

    // Sort allGames by date and limit to most recent 200
    allGames.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const limitedGames = allGames.slice(0, 200);

    res.json({
      id: user?._id || null,
      _id: user?._id || null,
      username: playerName,
      createdAt: user?.createdAt || null,
      profilePicture: user?.profilePicture || null,
      isRegisteredUser: isRegisteredUser,
      totalGames: limitedGames.length,
      totalWins: totalWins,
      aliases: searchNames, // Include all search names (username + aliases) for frontend matching
      games: limitedGames
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    next(error);
  }
});

// PUT /users/me/profile-picture - Update profile picture (protected route)
router.put('/me/profile-picture', auth, async (req, res, next) => {
  try {
    const { profilePicture } = req.body;

    // 1. Validate profile picture data exists
    if (!profilePicture || typeof profilePicture !== 'string') {
      return res.status(400).json({ error: 'Valid profile picture data is required' });
    }

    // 2. Check if it's a valid base64 data URL with proper format
    if (!profilePicture.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Profile picture must be a valid image data URL' });
    }

    // 3. Validate image type (whitelist only safe formats)
    const allowedTypes = [
      'data:image/jpeg',
      'data:image/jpg', 
      'data:image/png',
      'data:image/gif',
      'data:image/webp'
    ];
    
    const hasValidType = allowedTypes.some(type => profilePicture.startsWith(type));
    if (!hasValidType) {
      return res.status(400).json({ error: 'Only JPEG, PNG, GIF, and WebP images are allowed' });
    }

    // 4. Validate base64 format
    const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
    if (!base64Regex.test(profilePicture)) {
      return res.status(400).json({ error: 'Invalid base64 image format' });
    }

    // 5. Extract and validate base64 data
    const base64Data = profilePicture.split(',')[1];
    if (!base64Data || base64Data.length === 0) {
      return res.status(400).json({ error: 'Empty image data' });
    }

    // 6. Validate base64 encoding (allow whitespace which will be cleaned)
    // Remove any whitespace/newlines that might be in the base64 string
    const cleanBase64 = base64Data.replace(/\s/g, '');
    const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Pattern.test(cleanBase64)) {
      return res.status(400).json({ error: 'Invalid base64 encoding' });
    }

    // Reconstruct the profile picture with cleaned base64
    const mimeType = profilePicture.split(',')[0];
    const cleanedProfilePicture = `${mimeType},${cleanBase64}`;
    
    // 7. Check size limits (use cleaned version for accurate size check)
    // 7. Check size limits (use cleaned version for accurate size check)
    const minSize = 100; // Minimum ~75 bytes original
    const maxSize = 10485760; // ~7.5MB original (10MB base64)
    
    if (cleanedProfilePicture.length < minSize) {
      return res.status(400).json({ error: 'Image file is too small or corrupted' });
    }
    
    if (cleanedProfilePicture.length > maxSize) {
      return res.status(400).json({ error: 'Profile picture is too large (max 5MB)' });
    }

    // 8. Additional security: Check for common malicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /onerror=/i,
      /onload=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(cleanedProfilePicture))) {
      return res.status(400).json({ error: 'Invalid image content detected' });
    }

    // Update the profile picture in the database
    // Note: req.user is a lean object, so we need to use findByIdAndUpdate
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { profilePicture: cleanedProfilePicture },
      { new: true, select: '-passwordHash' }
    ).lean();

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Clear the user cache so next request gets fresh data
    if (cache.isConnected) {
      await cache.del(`user:${req.user._id}`);
    }

    res.json({
      message: 'Profile picture updated successfully',
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        createdAt: updatedUser.createdAt,
        profilePicture: updatedUser.profilePicture
      }
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /users/me/profile-picture - Delete profile picture (protected route)
router.delete('/me/profile-picture', auth, async (req, res, next) => {
  try {
    // Remove the profile picture
    req.user.profilePicture = null;
    await req.user.save();

    res.json({
      message: 'Profile picture deleted successfully',
      user: {
        id: req.user._id,
        username: req.user.username,
        createdAt: req.user.createdAt,
        profilePicture: null
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /users/me/profile-picture - Get profile picture URL (protected route)
router.get('/me/profile-picture', auth, async (req, res, next) => {
  try {
    res.json({
      profilePicture: req.user.profilePicture || null
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /users/:userId/name - Update user's username (protected route)
router.patch('/:userId/name', auth, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { name } = req.body;

    // Verify the user is updating their own username
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only update your own username' });
    }

    // Validate name
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Valid username is required' });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 3 || trimmedName.length > 50) {
      return res.status(400).json({ error: 'Username must be between 3 and 50 characters' });
    }

    // Escape regex metacharacters in trimmedName
    const escapedName = _.escapeRegExp(trimmedName);
    // Check if username already exists (case-insensitive)
    const existingUser = await User.findOne({ 
      username: { $regex: new RegExp(`^${escapedName}$`, 'i') },
      _id: { $ne: req.user._id }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Check if new username conflicts with any existing player alias
    const PlayerAlias = require('../models/PlayerAlias');
    const conflictingAlias = await PlayerAlias.findOne({ 
      aliasName: trimmedName 
    }).populate('userId', 'username');

    // Allow if the alias belongs to the current user (reverting to old username)
    if (conflictingAlias && conflictingAlias.userId._id.toString() !== req.user._id.toString()) {
      return res.status(400).json({ 
        error: `Username "${trimmedName}" is already in use as a player alias for user "${conflictingAlias.userId?.username || 'Unknown'}"` 
      });
    }

    // Fetch the user as a Mongoose document (not lean) so we can use .save()
    const userDoc = await User.findById(req.user._id);
    if (!userDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Store old username before updating
    const oldUsername = userDoc.username;

    // Update the username
    userDoc.username = trimmedName;
    await userDoc.save();

    // If reverting to an old username that's currently an alias, delete that alias
    if (conflictingAlias && conflictingAlias.userId._id.toString() === req.user._id.toString()) {
      await PlayerAlias.deleteOne({ _id: conflictingAlias._id });
      console.log(`✅ Deleted alias "${trimmedName}" as user reverted to this username`);
    }

    // When changing to a NEW username (not reverting):
    // Delete all old aliases for this user to keep only the most recent previous username
    // This frees up old names and prevents alias accumulation
    if (oldUsername !== trimmedName && (!conflictingAlias || conflictingAlias.userId._id.toString() !== req.user._id.toString())) {
      try {
        // Get all existing aliases for this user
        const existingAliases = await PlayerAlias.find({ userId: userDoc._id });
        
        // Delete all existing aliases (we'll create a new one for the current old username)
        if (existingAliases.length > 0) {
          const deletedCount = await PlayerAlias.deleteMany({ userId: userDoc._id });
          console.log(`✅ Deleted ${deletedCount.deletedCount} old alias(es) for user ${userDoc.username} (freeing up old names)`);
        }
      } catch (cleanupErr) {
        console.error('Failed to clean up old aliases:', cleanupErr);
        // Don't fail the request if cleanup fails
      }
    }

    // Create/update player alias for the old username so games are consolidated
    if (oldUsername !== trimmedName) {
      try {
        // Check if alias already exists for this old username
        const existingAlias = await PlayerAlias.findOne({
          userId: userDoc._id,
          aliasName: oldUsername
        });

        if (!existingAlias) {
          // Create new alias for old username (user is creator of their own alias)
          await PlayerAlias.create({
            userId: userDoc._id,
            aliasName: oldUsername,
            createdBy: userDoc._id, // User creates their own alias
            notes: `Username changed from "${oldUsername}" to "${trimmedName}" on ${new Date().toISOString()}`
          });
          console.log(`✅ Created alias "${oldUsername}" → "${trimmedName}"`);
        }
      } catch (aliasErr) {
        console.error('Failed to create player alias:', aliasErr);
        // Don't fail the request if alias creation fails
      }

      // Update PlayerIdentity with new display name
      try {
        const identityResult = await identityService.handleUsernameChange(
          userDoc,
          oldUsername,
          trimmedName
        );
        if (identityResult.updated) {
          console.log(`✅ Updated player identity: "${oldUsername}" → "${trimmedName}"`);
        }
        if (identityResult.errors.length > 0) {
          console.warn('⚠️  Identity update completed with errors:', identityResult.errors);
        }
      } catch (identityErr) {
        console.error('Failed to update player identity:', identityErr);
        // Don't fail the request if identity update fails
      }
    }

    // Clear leaderboard cache since username has changed
    const cache = require('../utils/redis');
    if (cache.isConnected) {
      try {
        // Delete all leaderboard cache keys
        const keys = await cache.client.keys('leaderboard:*');
        if (keys.length > 0) {
          await cache.client.del(keys);
          console.log(`✅ Cleared ${keys.length} leaderboard cache entries after username update`);
        }
      } catch (cacheErr) {
        console.error('Failed to clear leaderboard cache:', cacheErr);
        // Don't fail the request if cache clear fails
      }
    }

    // Generate new JWT with updated username
    const token = jwt.sign(
      { userId: userDoc._id, username: userDoc.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Username updated successfully',
      token,
      user: {
        id: userDoc._id,
        username: userDoc.username,
        createdAt: userDoc.createdAt,
        profilePicture: userDoc.profilePicture || null
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /users/all - Get all users (protected route)
router.get('/all', auth, async (req, res, next) => {
  try {
    // Get all users but exclude password and limit data
    const users = await User.find()
      .select('_id username createdAt profilePicture')
      .sort({ username: 1 })
      .lean(); // Use lean() for better performance

    res.json({
      users: users.map(user => ({
        id: user._id.toString(),
        username: user.username,
        createdAt: user.createdAt,
        profilePicture: user.profilePicture || null
      }))
    });
  } catch (error) {
    next(error);
  }
});

// GET /users/:userId/friends - Get user's friends list (protected route)
router.get('/:userId/friends', friendsLimiter, auth, async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Verify the user is requesting their own friends
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only view your own friends list' });
    }

    const user = await User.findById(userId).populate('friends', '_id username createdAt profilePicture');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      friends: user.friends.map(friend => ({
        id: friend._id.toString(),
        username: friend.username,
        createdAt: friend.createdAt,
        profilePicture: friend.profilePicture || null
      }))
    });
  } catch (error) {
    next(error);
  }
});

// GET /users/:userId/friends/batch-check - Get all friends data in one request (protected route)
// Combines friends list, received requests, and sent requests to reduce polling overhead
router.get('/:userId/friends/batch-check', friendsLimiter, auth, async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Verify the user is requesting their own data
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only view your own friends data' });
    }

    // Fetch all data in parallel for efficiency
    const [user, receivedRequests, sentRequests] = await Promise.all([
      User.findById(userId).populate('friends', '_id username createdAt profilePicture'),
      FriendRequest.find({
        receiver: userId,
        status: 'pending'
      })
      .populate('sender', '_id username profilePicture createdAt')
      .sort({ createdAt: -1 }),
      FriendRequest.find({
        sender: userId,
        status: 'pending'
      })
      .populate('receiver', '_id username profilePicture createdAt')
      .sort({ createdAt: -1 })
    ]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      friends: (user.friends || []).map(friend => ({
        id: friend._id.toString(),
        username: friend.username,
        createdAt: friend.createdAt,
        profilePicture: friend.profilePicture || null
      })),
      receivedRequests: receivedRequests
        .filter(req => req.sender) // Filter out requests with missing sender
        .map(req => ({
          id: req._id.toString(),
          sender: {
            id: req.sender._id.toString(),
            username: req.sender.username,
            profilePicture: req.sender.profilePicture || null,
            createdAt: req.sender.createdAt
          },
          status: req.status,
          createdAt: req.createdAt
        })),
      sentRequests: sentRequests
        .filter(req => req.receiver) // Filter out requests with missing receiver
        .map(req => ({
          id: req._id.toString(),
          receiver: {
            id: req.receiver._id.toString(),
            username: req.receiver.username,
            profilePicture: req.receiver.profilePicture || null,
            createdAt: req.receiver.createdAt
          },
          status: req.status,
          createdAt: req.createdAt
        }))
    });
  } catch (error) {
    console.error('[GET /friends/batch-check] Error:', error);
    next(error);
  }
});

// POST /users/:userId/friends/:friendId - Add a friend (protected route)
router.post('/:userId/friends/:friendId', auth, async (req, res, next) => {
  try {
    const { userId, friendId } = req.params;

    // Verify the user is adding friends to their own list
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only manage your own friends list' });
    }

    // Can't add yourself as a friend
    if (userId === friendId) {
      return res.status(400).json({ error: 'You cannot add yourself as a friend' });
    }

    // Validate friendId is a valid ObjectId to prevent injection
    if (!mongoose.Types.ObjectId.isValid(friendId)) {
      return res.status(400).json({ error: 'Invalid friend ID format' });
    }

    // Check if friend exists using $eq for safety
    const friend = await User.findOne({ _id: { $eq: friendId } });
    if (!friend) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already friends
    if (req.user.friends.includes(friendId)) {
      return res.status(400).json({ error: 'User is already in your friends list' });
    }

    // Add friend
    req.user.friends.push(friendId);
    await req.user.save();

    res.json({
      message: 'Friend added successfully',
      friend: {
        id: friend._id.toString(),
        username: friend.username,
        createdAt: friend.createdAt,
        profilePicture: friend.profilePicture || null
      }
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /users/:userId/friends/:friendId - Remove a friend (protected route)
router.delete('/:userId/friends/:friendId', auth, async (req, res, next) => {
  try {
    const { userId, friendId } = req.params;

    // Verify the user is removing friends from their own list
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only manage your own friends list' });
    }

    // Validate friendId is a valid ObjectId to prevent injection
    if (!mongoose.Types.ObjectId.isValid(friendId)) {
      return res.status(400).json({ error: 'Invalid friend ID format' });
    }

    // Remove friend from current user's list
    req.user.friends = req.user.friends.filter(id => id.toString() !== friendId);
    await req.user.save();

    // Also remove current user from the other user's friends list (mutual unfriend)
    const friend = await User.findOne({ _id: { $eq: friendId } });
    if (friend) {
      friend.friends = friend.friends.filter(id => id.toString() !== userId);
      await friend.save();
    }

    res.json({
      message: 'Friend removed successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ============ FRIEND REQUEST ROUTES ============

// POST /users/:userId/friend-requests - Send a friend request (protected route)
router.post('/:userId/friend-requests', auth, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { receiverId } = req.body;

    // Validate receiverId is a valid string and valid ObjectId
    if (typeof receiverId !== "string" || !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ error: "Invalid receiverId" });
    }

    // Verify the user is sending from their own account
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only send friend requests from your own account' });
    }

    // Can't send request to yourself
    if (userId === receiverId) {
      return res.status(400).json({ error: 'You cannot send a friend request to yourself' });
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already friends
    if (req.user.friends.includes(receiverId)) {
      return res.status(400).json({ error: 'You are already friends with this user' });
    }

    // Check if there's already a pending request between these users
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender: userId, receiver: receiverId, status: 'pending' },
        { sender: receiverId, receiver: userId, status: 'pending' }
      ]
    });

    if (existingRequest) {
      if (existingRequest.sender.toString() === userId) {
        return res.status(400).json({ error: 'You already sent a friend request to this user' });
      } else {
        return res.status(400).json({ error: 'This user already sent you a friend request. Check your pending requests.' });
      }
    }

    // Create new friend request
    const friendRequest = new FriendRequest({
      sender: userId,
      receiver: receiverId,
      status: 'pending'
    });

    await friendRequest.save();

    // Populate sender info for response
    await friendRequest.populate('sender', '_id username profilePicture createdAt');
    await friendRequest.populate('receiver', '_id username profilePicture createdAt');

    res.status(201).json({
      message: 'Friend request sent successfully',
      friendRequest: {
        id: friendRequest._id.toString(),
        sender: {
          id: friendRequest.sender._id.toString(),
          username: friendRequest.sender.username,
          profilePicture: friendRequest.sender.profilePicture || null,
          createdAt: friendRequest.sender.createdAt
        },
        receiver: {
          id: friendRequest.receiver._id.toString(),
          username: friendRequest.receiver.username,
          profilePicture: friendRequest.receiver.profilePicture || null,
          createdAt: friendRequest.receiver.createdAt
        },
        status: friendRequest.status,
        createdAt: friendRequest.createdAt
      }
    });
  } catch (error) {
    // Handle duplicate request error
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Friend request already exists' });
    }
    next(error);
  }
});

// GET /users/:userId/friend-requests/received - Get received friend requests (protected route)
router.get('/:userId/friend-requests/received', friendsLimiter, auth, async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Verify the user is requesting their own friend requests
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only view your own friend requests' });
    }

    const requests = await FriendRequest.find({
      receiver: userId,
      status: 'pending'
    })
    .populate('sender', '_id username profilePicture createdAt')
    .sort({ createdAt: -1 });

    res.json({
      requests: requests.map(req => ({
        id: req._id.toString(),
        sender: {
          id: req.sender._id.toString(),
          username: req.sender.username,
          profilePicture: req.sender.profilePicture || null,
          createdAt: req.sender.createdAt
        },
        status: req.status,
        createdAt: req.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
});

// GET /users/:userId/friend-requests/sent - Get sent friend requests (protected route)
router.get('/:userId/friend-requests/sent', friendsLimiter, auth, async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Verify the user is requesting their own friend requests
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only view your own friend requests' });
    }

    const requests = await FriendRequest.find({
      sender: userId,
      status: 'pending'
    })
    .populate('receiver', '_id username profilePicture createdAt')
    .sort({ createdAt: -1 });

    res.json({
      requests: requests.map(req => ({
        id: req._id.toString(),
        receiver: {
          id: req.receiver._id.toString(),
          username: req.receiver.username,
          profilePicture: req.receiver.profilePicture || null,
          createdAt: req.receiver.createdAt
        },
        status: req.status,
        createdAt: req.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
});

// POST /users/:userId/friend-requests/:requestId/accept - Accept a friend request (protected route)
router.post('/:userId/friend-requests/:requestId/accept', auth, async (req, res, next) => {
  try {
    const { userId, requestId } = req.params;

    // Verify the user is accepting their own friend request
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only accept your own friend requests' });
    }

    // Find the friend request
    const friendRequest = await FriendRequest.findById(requestId)
      .populate('sender', '_id username profilePicture createdAt')
      .populate('receiver', '_id username profilePicture createdAt');

    if (!friendRequest) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    // Verify the current user is the receiver
    if (friendRequest.receiver._id.toString() !== userId) {
      return res.status(403).json({ error: 'You can only accept friend requests sent to you' });
    }

    // Check if request is still pending
    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ error: 'This friend request has already been processed' });
    }

    // Update request status
    friendRequest.status = 'accepted';
    await friendRequest.save();

    // Add both users to each other's friends list
    const sender = await User.findById(friendRequest.sender._id);
    const receiver = await User.findById(friendRequest.receiver._id);

    if (!sender.friends.includes(receiver._id)) {
      sender.friends.push(receiver._id);
      await sender.save();
    }

    if (!receiver.friends.includes(sender._id)) {
      receiver.friends.push(sender._id);
      await receiver.save();
    }

    res.json({
      message: 'Friend request accepted',
      friend: {
        id: friendRequest.sender._id.toString(),
        username: friendRequest.sender.username,
        profilePicture: friendRequest.sender.profilePicture || null,
        createdAt: friendRequest.sender.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /users/:userId/friend-requests/:requestId/reject - Reject a friend request (protected route)
router.post('/:userId/friend-requests/:requestId/reject', auth, async (req, res, next) => {
  try {
    const { userId, requestId } = req.params;

    // Verify the user is rejecting their own friend request
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only reject your own friend requests' });
    }

    // Find the friend request
    const friendRequest = await FriendRequest.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    // Verify the current user is the receiver
    if (friendRequest.receiver.toString() !== userId) {
      return res.status(403).json({ error: 'You can only reject friend requests sent to you' });
    }

    // Check if request is still pending
    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ error: 'This friend request has already been processed' });
    }

    // Update request status
    friendRequest.status = 'rejected';
    await friendRequest.save();

    res.json({
      message: 'Friend request rejected'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /users/:userId/friend-requests/:requestId - Cancel a sent friend request (protected route)
router.delete('/:userId/friend-requests/:requestId', auth, async (req, res, next) => {
  try {
    const { userId, requestId } = req.params;

    // Verify the user is canceling their own friend request
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only cancel your own friend requests' });
    }

    // Find the friend request
    const friendRequest = await FriendRequest.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    // Verify the current user is the sender
    if (friendRequest.sender.toString() !== userId) {
      return res.status(403).json({ error: 'You can only cancel friend requests you sent' });
    }

    // Check if request is still pending
    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ error: 'This friend request has already been processed' });
    }

    // Delete the request
    await FriendRequest.findByIdAndDelete(requestId);

    res.json({
      message: 'Friend request cancelled'
    });
  } catch (error) {
    next(error);
  }
});

// GET /users/admin/preview-link-games - Preview what games would be linked (admin only)
router.get('/admin/preview-link-games', auth, async (req, res, next) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    console.log('🔍 Admin requested game linkage preview');

    // Get all users with their aliases
    const users = await User.find().select('_id username');
    
    const preview = {
      totalUsers: users.length,
      usersWithGames: 0,
      totalGamesToLink: 0,
      userDetails: []
    };

    // Check each user for linkable games
    for (const user of users) {
      try {
        // Get user's aliases
        const aliases = await PlayerAlias.find({ userId: user._id }).select('aliasName').lean();
        const aliasNames = aliases.map(a => a.aliasName);
        const searchNames = [user.username, ...aliasNames];

        // Build case-insensitive regex patterns
        const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nameRegexes = searchNames.map(name => new RegExp(`^${escapeRegExp(name)}$`, 'i'));

        // Count games that would be linked (not already linked to this user)
        const Game = require('../models/Game');
        const WizardGame = require('../models/WizardGame');
        const TableGame = require('../models/TableGame');

        const [gamesCount, wizardCount, tableCount] = await Promise.all([
          Game.countDocuments({
            'gameData.players': { $elemMatch: { name: { $in: nameRegexes } } },
            $or: [
              { userId: { $exists: false } },
              { userId: null },
              { userId: { $ne: user._id } }
            ]
          }),
          WizardGame.countDocuments({
            'gameData.players': { $elemMatch: { name: { $in: nameRegexes } } },
            $or: [
              { userId: { $exists: false } },
              { userId: null },
              { userId: { $ne: user._id } }
            ]
          }),
          TableGame.countDocuments({
            'gameData.players': { $elemMatch: { name: { $in: nameRegexes } } },
            $or: [
              { userId: { $exists: false } },
              { userId: null },
              { userId: { $ne: user._id } }
            ]
          })
        ]);

        const totalForUser = gamesCount + wizardCount + tableCount;

        if (totalForUser > 0) {
          preview.usersWithGames++;
          preview.totalGamesToLink += totalForUser;
          preview.userDetails.push({
            userId: user._id.toString(),
            username: user.username,
            gamesToLink: totalForUser,
            aliases: aliasNames,
            gameBreakdown: {
              games: gamesCount,
              wizardGames: wizardCount,
              tableGames: tableCount
            }
          });
        }
      } catch (userError) {
        console.error(`Error checking user ${user.username}:`, userError.message);
      }
    }

    // Sort by games to link (descending)
    preview.userDetails.sort((a, b) => b.gamesToLink - a.gamesToLink);

    console.log(`✅ Preview complete: ${preview.usersWithGames} users with ${preview.totalGamesToLink} games to link`);

    res.json(preview);
  } catch (error) {
    console.error('❌ Error in game linkage preview:', error);
    next(error);
  }
});

// POST /users/admin/link-all-games - Retroactively link games for all users (admin only)
router.post('/admin/link-all-games', auth, async (req, res, next) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    console.log('🔗 Admin triggered game linkage for all users');

    // Get all users
    const users = await User.find().select('_id username');
    
    const results = {
      totalUsers: users.length,
      processed: 0,
      successful: 0,
      failed: 0,
      totalGamesLinked: 0,
      details: []
    };

    // Process each user
    for (const user of users) {
      try {
        results.processed++;
        console.log('Processing user %d/%d: %s', results.processed, users.length, user.username);
        
        const linkageResults = await linkGamesToNewUser(user.username, user._id);
        const gamesLinked = linkageResults.gamesLinked + 
                          linkageResults.wizardGamesLinked + 
                          linkageResults.tableGamesLinked;
        
        if (gamesLinked > 0 || linkageResults.errors.length === 0) {
          results.successful++;
          results.totalGamesLinked += gamesLinked;
          
          if (gamesLinked > 0) {
            results.details.push({
              userId: user._id.toString(),
              username: user.username,
              gamesLinked: gamesLinked,
              success: true
            });
          }
        } else {
          results.failed++;
          results.details.push({
            userId: user._id.toString(),
            username: user.username,
            success: false,
            errors: linkageResults.errors
          });
        }
      } catch (error) {
        results.failed++;
        console.error('❌ Error processing user %s:', user.username, error.message);
        results.details.push({
          userId: user._id.toString(),
          username: user.username,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`✅ Completed linking games for ${results.totalUsers} users`);
    console.log(`   Successful: ${results.successful}, Failed: ${results.failed}`);
    console.log(`   Total games linked: ${results.totalGamesLinked}`);

    res.json({
      success: true,
      message: `Processed ${results.totalUsers} users, linked ${results.totalGamesLinked} games`,
      results
    });
  } catch (error) {
    console.error('❌ Error in admin game linkage:', error);
    next(error);
  }
});

// POST /users/admin/link-user-games/:userId - Link games for a specific user (admin only)
router.post('/admin/link-user-games/:userId', auth, async (req, res, next) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;

    // Get the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('🔗 Admin triggered game linkage for user: %s', user.username);

    // Run the game linkage
    const linkageResults = await linkGamesToNewUser(user.username, userId);

    const totalLinked = linkageResults.gamesLinked + 
                       linkageResults.wizardGamesLinked + 
                       linkageResults.tableGamesLinked;

    res.json({
      success: linkageResults.success,
      message: totalLinked > 0 
        ? `Successfully linked ${totalLinked} game(s) for user ${user.username}`
        : `No games found to link for user ${user.username}`,
      details: {
        username: user.username,
        gamesLinked: linkageResults.gamesLinked,
        wizardGamesLinked: linkageResults.wizardGamesLinked,
        tableGamesLinked: linkageResults.tableGamesLinked,
        totalLinked: totalLinked,
        errors: linkageResults.errors.length > 0 ? linkageResults.errors : undefined
      }
    });
  } catch (error) {
    console.error('Error in admin user game linkage:', error);
    next(error);
  }
});

// GET /users/admin/all - Get all users with full details (admin only)
router.get('/admin/all', auth, async (req, res, next) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const users = await User.find()
      .select('_id username email role createdAt lastLogin profilePicture')
      .sort({ username: 1 });

    res.json({
      users: users.map(user => ({
        id: user._id.toString(),
        _id: user._id.toString(), // Keep for backwards compatibility
        username: user.username,
        email: user.email || null,
        role: user.role || 'user',
        createdAt: user.createdAt,
        lastLogin: user.lastLogin || null,
        profilePicture: user.profilePicture || null
      }))
    });
  } catch (error) {
    next(error);
  }
});

// PUT /users/:userId/username - Update username across all database collections (admin only)
router.put('/:userId/username', auth, async (req, res, next) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;
    const { username } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Validate userId is a valid ObjectId to prevent injection
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const trimmedUsername = username.trim();

    // Check if username already exists (excluding current user)
    const existingUser = await User.findOne({ 
      username: trimmedUsername,
      _id: { $ne: userId }
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Check if new username conflicts with any existing player alias
    const PlayerAlias = require('../models/PlayerAlias');
    const conflictingAlias = await PlayerAlias.findOne({ 
      aliasName: trimmedUsername 
    }).populate('userId', 'username');

    if (conflictingAlias) {
      return res.status(400).json({ 
        error: `Username "${trimmedUsername}" is already in use as a player alias for user "${conflictingAlias.userId?.username || 'Unknown'}"` 
      });
    }

    // Get old username before updating
    const user = await User.findOne({ _id: { $eq: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const oldUsername = user.username;

    // Update username in User collection
    user.username = trimmedUsername;
    await user.save();

    // Update username in all Game documents where user is a player
    const Game = require('../models/Game');
    await Game.updateMany(
      { 'players.playerId': userId },
      { $set: { 'players.$[elem].playerName': trimmedUsername } },
      { arrayFilters: [{ 'elem.playerId': userId }] }
    );

    // Update username in all TableGame documents
    const TableGame = require('../models/TableGame');
    await TableGame.updateMany(
      { 'players.playerId': userId },
      { $set: { 'players.$[elem].playerName': trimmedUsername } },
      { arrayFilters: [{ 'elem.playerId': userId }] }
    );
    await TableGame.updateMany(
      { 'rounds.scores.playerId': userId },
      { $set: { 'rounds.$[].scores.$[elem].playerName': trimmedUsername } },
      { arrayFilters: [{ 'elem.playerId': userId }] }
    );

    // Update username in all WizardGame documents
    const WizardGame = require('../models/WizardGame');
    await WizardGame.updateMany(
      { 'gameData.players.user_id': userId },
      { $set: { 'gameData.players.$[elem].name': trimmedUsername } },
      { arrayFilters: [{ 'elem.user_id': userId }] }
    );

    // Update notes on all player aliases linked to this user
    const userAliases = await PlayerAlias.find({ userId });
    if (userAliases.length > 0) {
      const timestamp = new Date().toISOString();
      const updateNote = `\n[${timestamp}] Username changed from "${oldUsername}" to "${trimmedUsername}" by admin: ${req.user.username}`;
      
      for (const alias of userAliases) {
        alias.notes = (alias.notes || '') + updateNote;
        await alias.save();
      }
      
      console.log('✅ Updated notes on %d player alias(es) for username change', userAliases.length);
    }

    // Update username in UserGameTemplate suggestions
    const UserGameTemplate = require('../models/UserGameTemplate');
    await UserGameTemplate.updateMany(
      { userId },
      { $set: { userName: trimmedUsername } }
    );

    // Update username in TemplateSuggestion
    const TemplateSuggestion = require('../models/TemplateSuggestion');
    await TemplateSuggestion.updateMany(
      { userId },
      { $set: { userName: trimmedUsername } }
    );

    console.log('✅ Username updated from "%s" to "%s" across all collections', oldUsername, trimmedUsername);

    res.json({
      message: 'Username updated successfully across all records',
      user: {
        _id: user._id,
        username: user.username,
        role: user.role || 'user',
        createdAt: user.createdAt
      },
      updatedCollections: [
        'User',
        'Game (players)',
        'WizardGame (players)',
        'TableGame (players and scores)',
        'UserGameTemplate',
        'TemplateSuggestion',
        'PlayerAlias (notes updated)'
      ],
      aliasesUpdated: userAliases.length
    });
  } catch (error) {
    console.error('Error updating username:', error);
    next(error);
  }
});

// PUT /users/:userId/role - Update user role (admin only)
router.put('/:userId/role', auth, async (req, res, next) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "user" or "admin"' });
    }

    // Validate userId is a valid ObjectId to prevent injection
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const user = await User.findOne({ _id: { $eq: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldRole = user.role || 'user';
    user.role = role;
    await user.save();

    console.log('✅ User role updated from "%s" to "%s" for user: %s', oldRole, role, user.username);

    res.json({
      message: 'User role updated successfully',
      user: {
        _id: user._id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    next(error);
  }
});

// ==================== Player Alias Management (Admin Only) ====================

// GET /users/admin/player-aliases - Get all player aliases (admin only)
router.get('/admin/player-aliases', auth, async (req, res, next) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const aliases = await PlayerAlias.find()
      .populate('userId', 'username profilePicture')
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      aliases: aliases.map(alias => ({
        _id: alias._id.toString(),
        aliasName: alias.aliasName,
        user: alias.userId ? {
          id: alias.userId._id.toString(),
          username: alias.userId.username,
          profilePicture: alias.userId.profilePicture || null
        } : null,
        createdBy: alias.createdBy ? {
          id: alias.createdBy._id.toString(),
          username: alias.createdBy.username
        } : null,
        notes: alias.notes || '',
        createdAt: alias.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching player aliases:', error);
    next(error);
  }
});

// POST /users/admin/player-aliases - Create a new player alias (admin only)
router.post('/admin/player-aliases', auth, async (req, res, next) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { aliasName, userId, notes, linkGamesNow } = req.body;

    // Validation
    if (!aliasName || !aliasName.trim()) {
      return res.status(400).json({ error: 'Alias name is required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Validate userId is a valid ObjectId to prevent injection
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const trimmedAliasName = aliasName.trim();

    // Check if user exists using $eq for safety
    const targetUser = await User.findOne({ _id: { $eq: userId } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if alias already exists
    const existingAlias = await PlayerAlias.findOne({ aliasName: trimmedAliasName });
    if (existingAlias) {
      const existingUser = await User.findById(existingAlias.userId);
      return res.status(400).json({ 
        error: `Alias "${trimmedAliasName}" is already linked to user "${existingUser?.username || 'Unknown'}"` 
      });
    }

    // Check if alias is same as target user's username
    if (trimmedAliasName.toLowerCase() === targetUser.username.toLowerCase()) {
      return res.status(400).json({ 
        error: 'Alias name cannot be the same as the user\'s registered username' 
      });
    }

    // Create the alias
    const playerAlias = new PlayerAlias({
      userId: userId,
      aliasName: trimmedAliasName,
      createdBy: req.user._id,
      notes: notes || ''
    });

    await playerAlias.save();

    console.log('✅ Created player alias: "%s" -> User: %s (by admin: %s)', 
      trimmedAliasName, targetUser.username, req.user.username);

    // Optionally link games immediately
    let linkageResults = null;
    if (linkGamesNow) {
      try {
        linkageResults = await linkGamesToNewUser(trimmedAliasName, userId);
        console.log('📊 Linked %d games for alias "%s"', 
          (linkageResults.gamesLinked || 0) + (linkageResults.wizardGamesLinked || 0) + (linkageResults.tableGamesLinked || 0),
          trimmedAliasName);
      } catch (linkError) {
        console.error('⚠️  Error linking games for alias:', linkError);
        // Don't fail the alias creation if linkage fails
      }
    }

    // Return the created alias with populated user info
    const populatedAlias = await PlayerAlias.findById(playerAlias._id)
      .populate('userId', 'username profilePicture')
      .populate('createdBy', 'username')
      .lean();

    res.status(201).json({
      message: 'Player alias created successfully',
      alias: {
        _id: populatedAlias._id.toString(),
        aliasName: populatedAlias.aliasName,
        user: {
          id: populatedAlias.userId._id.toString(),
          username: populatedAlias.userId.username,
          profilePicture: populatedAlias.userId.profilePicture || null
        },
        createdBy: {
          id: populatedAlias.createdBy._id.toString(),
          username: populatedAlias.createdBy.username
        },
        notes: populatedAlias.notes || '',
        createdAt: populatedAlias.createdAt
      },
      linkageResults: linkageResults ? {
        gamesLinked: linkageResults.gamesLinked || 0,
        wizardGamesLinked: linkageResults.wizardGamesLinked || 0,
        tableGamesLinked: linkageResults.tableGamesLinked || 0,
        totalLinked: (linkageResults.gamesLinked || 0) + 
                     (linkageResults.wizardGamesLinked || 0) + 
                     (linkageResults.tableGamesLinked || 0)
      } : null
    });
  } catch (error) {
    console.error('Error creating player alias:', error);
    next(error);
  }
});

// DELETE /users/admin/player-aliases/:aliasId - Delete a player alias (admin only)
router.delete('/admin/player-aliases/:aliasId', auth, async (req, res, next) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { aliasId } = req.params;

    // Validate aliasId is a valid ObjectId to prevent injection
    if (!mongoose.Types.ObjectId.isValid(aliasId)) {
      return res.status(400).json({ error: 'Invalid alias ID format' });
    }

    const alias = await PlayerAlias.findOne({ _id: { $eq: aliasId } }).populate('userId', 'username');
    if (!alias) {
      return res.status(404).json({ error: 'Player alias not found' });
    }

    const aliasName = alias.aliasName;
    const username = alias.userId?.username || 'Unknown';

    await PlayerAlias.deleteOne({ _id: { $eq: aliasId } });

    console.log('🗑️  Deleted player alias: "%s" -> User: %s (by admin: %s)', 
      aliasName, username, req.user.username);

    res.json({
      message: 'Player alias deleted successfully',
      aliasName: aliasName,
      username: username
    });
  } catch (error) {
    console.error('Error deleting player alias:', error);
    next(error);
  }
});

// GET /users/admin/player-names - Search for player names in games (admin only)
router.get('/admin/player-names', auth, async (req, res, next) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { search } = req.query;

    if (!search || search.trim().length < 2) {
      return res.status(400).json({ error: 'Search term must be at least 2 characters' });
    }

    const searchTerm = search.trim();
    const Game = require('../models/Game');
    const WizardGame = require('../models/WizardGame');
    const TableGame = require('../models/TableGame');

    // Escape regex special characters to prevent injection
    const escapedSearchTerm = _.escapeRegExp(searchTerm);
    // Create case-insensitive regex for partial matching
    const searchRegex = new RegExp(escapedSearchTerm, 'i');

    // Find distinct player names across all game types
    const [games, wizardGames, tableGames] = await Promise.all([
      Game.find({ 'gameData.players.name': searchRegex })
        .select('gameData.players')
        .limit(50)
        .lean(),
      WizardGame.find({ 'gameData.players.name': searchRegex })
        .select('gameData.players')
        .limit(50)
        .lean(),
      TableGame.find({ 'gameData.players.name': searchRegex })
        .select('gameData.players')
        .limit(50)
        .lean()
    ]);

    // Extract unique player names
    const playerNamesSet = new Set();

    [...games, ...wizardGames, ...tableGames].forEach(game => {
      if (game.gameData?.players) {
        game.gameData.players.forEach(player => {
          if (player.name && searchRegex.test(player.name)) {
            playerNamesSet.add(player.name);
          }
        });
      }
    });

    // Convert to array and sort
    const playerNames = Array.from(playerNamesSet).sort((a, b) => 
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    res.json({
      playerNames: playerNames.slice(0, 20), // Limit to 20 results
      totalFound: playerNames.length
    });
  } catch (error) {
    console.error('Error searching player names:', error);
    next(error);
  }
});

module.exports = router;

