import express from 'express'
import cors from 'cors'
import pg from 'pg'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import bcryptjs from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

dotenv.config()
const app = express()

// Trust proxy for proper IP detection (important for rate limiting and logging)
app.set('trust proxy', 1);

// Log environment info for debugging
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔧 Backend starting up...`);

// Configure CORS for production security
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Always allow the production domains, plus development domains for local testing
    const allowedOrigins = [
      'https://wizard.jkrumboe.dev',
      'https://jkrumboe.dev',
      'http://localhost:3000', 
      'http://localhost:5173', 
      'http://localhost:8088'
    ];
    
    console.log(`CORS Check - NODE_ENV: ${process.env.NODE_ENV}, Origin: ${origin}, Allowed: ${allowedOrigins.includes(origin)}`);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.error(`CORS blocked origin: ${origin}. Allowed origins: ${allowedOrigins.join(', ')}`);
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  exposedHeaders: ['set-cookie'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}

app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' })) // Limit JSON payload size
app.use(cookieParser())

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

// Additional CORS handling for preflight requests
app.options('*', (req, res) => {
  console.log(`OPTIONS request from origin: ${req.headers.origin}`);
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,Origin,X-Requested-With,Accept');
  res.sendStatus(200);
});

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
})

// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_change_in_production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your_refresh_secret_change_in_production';
const JWT_ADMIN_SECRET = process.env.JWT_ADMIN_SECRET || 'your_admin_jwt_secret_change_in_production';

// Token expiration times
const ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access token
const REFRESH_TOKEN_EXPIRY = '7d'; // Longer-lived refresh token
const ADMIN_TOKEN_EXPIRY = '1h'; // Admin token expiry

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);

// Middleware for verifying JWT and roles
function verifyToken(req, res, next) {
  // Check for token in cookies first, then fallback to Authorization header
  let token = req.cookies.accessToken;
  
  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader?.split(' ')[1];
  }
  
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }
    res.status(400).json({ error: 'Invalid token.' });
  }
}

function authorizeRoles(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
}

// Helper function for audit logging
function auditLog(action, userId, details = {}, req = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    userId,
    ip: req?.ip || req?.connection?.remoteAddress || 'unknown',
    userAgent: req?.get('User-Agent') || 'unknown',
    ...details
  };
  
  console.log(`🔐 AUDIT: ${JSON.stringify(logEntry)}`);
  
  // In production, you might want to store this in a separate audit log table
  // or send to a logging service like CloudWatch, Datadog, etc.
}

// Helper function to generate tokens
function generateTokens(user) {
  const payload = { 
    id: user.id, 
    role: user.role_id || user.role, 
    player_id: user.player_id 
  };
  
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  
  return { accessToken, refreshToken };
}

// Helper function to set secure cookies
function setTokenCookies(res, accessToken, refreshToken) {
  const cookieOptions = {
    httpOnly: true,
    secure: true, // Always use secure cookies (requires HTTPS)
    sameSite: 'strict',
    path: '/'
  };
  
  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000 // 15 minutes
  });
  
  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// User login route
app.post('/api/login', authLimiter, [
  body('username').trim().escape().isLength({ min: 1, max: 50 }),
  body('password').isLength({ min: 1 })
], async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    auditLog('LOGIN_FAILED', null, { reason: 'validation_error', errors: errors.array() }, req);
    return res.status(400).json({ error: 'Invalid input data.' });
  }

  const { username, password } = req.body;
  
  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user) {
      auditLog('LOGIN_FAILED', null, { reason: 'user_not_found', username }, req);
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const isValidPassword = await bcryptjs.compare(password, user.password_hash);
    if (!isValidPassword) {
      auditLog('LOGIN_FAILED', user.id, { reason: 'invalid_password', username }, req);
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    
    // Set secure HTTP-only cookies
    setTokenCookies(res, accessToken, refreshToken);
    
    const userInfo = {
      id: user.id,
      username: user.username,
      role: user.role_id,
      player_id: user.player_id
    };
    
    auditLog('LOGIN_SUCCESS', user.id, { username }, req);
      res.json({ 
      user: userInfo,
      message: 'Login successful'
    });
  } catch (err) {
    console.error('Error during login:', err);
    auditLog('LOGIN_ERROR', null, { reason: 'server_error', error: err.message }, req);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Register a new standard user and create a player for that user
app.post('/api/register', authLimiter, [
  body('username').isAlphanumeric().trim().escape().isLength({ min: 3, max: 30 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    auditLog('REGISTER_FAILED', null, { reason: 'validation_error', errors: errors.array() }, req);
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password } = req.body;
  try {
    // Create a new player
    const playerResult = await db.query(
      'INSERT INTO players (name, avatar, elo, win_rate, total_games) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [username, null, 1000, 0, 0]
    );
    const newPlayer = playerResult.rows[0];

    // Hash the password and create a new user linked to the player
    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await db.query(
      'INSERT INTO users (username, email, password_hash, role_id, player_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [username, email, hashedPassword, 1, newPlayer.id]
    );    const newUser = userResult.rows[0];

    const { accessToken, refreshToken } = generateTokens(newUser);
    
    // Set secure HTTP-only cookies
    setTokenCookies(res, accessToken, refreshToken);
    
    const userInfo = {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role_id,
      player_id: newUser.player_id    };
    
    auditLog('REGISTER_SUCCESS', newUser.id, { username, email }, req);
      res.status(201).json({ 
      user: userInfo,
      token: accessToken, // Include for backward compatibility during transition
      message: 'Registration successful'
    });
  } catch (err) {
    console.error('Error during registration:', err);
    auditLog('REGISTER_ERROR', null, { reason: 'server_error', error: err.message, username, email }, req);

    if (err.code === '23505') {
      // Check which constraint was violated
      if (err.constraint === 'users_username_key') {
        return res.status(409).json({ error: 'Username already taken.' });
      } else if (err.constraint === 'users_email_key') {
        return res.status(409).json({ error: 'Email address already registered.' });
      }
    }

    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Refresh token route
app.post('/api/refresh', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  
  if (!refreshToken) {
    auditLog('REFRESH_FAILED', null, { reason: 'no_refresh_token' }, req);
    return res.status(401).json({ error: 'No refresh token provided.' });
  }
  
  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    
    // Verify user still exists
    const result = await db.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    const user = result.rows[0];
    
    if (!user) {
      auditLog('REFRESH_FAILED', decoded.id, { reason: 'user_not_found' }, req);
      return res.status(401).json({ error: 'User not found.' });
    }
    
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    
    // Set new secure cookies
    setTokenCookies(res, accessToken, newRefreshToken);
    
    const userInfo = {
      id: user.id,
      username: user.username,
      role: user.role_id,
      player_id: user.player_id
    };
    
    auditLog('REFRESH_SUCCESS', user.id, { username: user.username }, req);
    
    res.json({ 
      user: userInfo,
      message: 'Token refreshed successfully'
    });
  } catch (err) {
    console.error('Error refreshing token:', err);
    auditLog('REFRESH_ERROR', null, { reason: 'invalid_token', error: err.message }, req);
    res.status(401).json({ error: 'Invalid refresh token.' });
  }
});

// Logout route
app.post('/api/logout', (req, res) => {
  // Try to get user info from token for audit logging
  let userId = null;
  try {
    const token = req.cookies.accessToken;
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.id;
    }
  } catch (err) {
    // Token might be expired or invalid, but we still want to clear cookies
  }
  
  auditLog('LOGOUT', userId, {}, req);
  
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

// Example protected route
app.get('/api/protected', verifyToken, authorizeRoles(['admin']), (req, res) => {
  res.json({ message: 'This is a protected route for admins.' });
});

// Testroute
// app.get('/api/players', async (req, res) => {
//   const result = await db.query('SELECT * FROM players')
//   res.json(result.rows)
// })

// Player routes

// Get all players
app.get('/api/players', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM players')
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch players' })
  }
})

// Add a new player
app.post('/api/players', async (req, res) => {
  const { name, avatar, elo, winRate, totalGames } = req.body
  try {
    const result = await db.query(
      'INSERT INTO players (name, avatar, elo, win_rate, total_games) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, avatar, elo, winRate, totalGames]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to add player' })
  }
})

// Get a player by ID
app.get('/api/players/:id', async (req, res) => {
  const { id } = req.params

  if (!id || id === 'undefined') {
    return res.status(400).json({ error: 'Missing or invalid player ID' });
  }

  try {
    const result = await db.query('SELECT * FROM players WHERE id = $1', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' })
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch player' })
  }
})

// Update a player
app.put('/api/players/:id', async (req, res) => {
  const { id } = req.params;
  const { name, avatar, elo, winRate, totalGames, tags } = req.body;

  // ✅ Validate types
  if (typeof name !== 'string' || name.length > 50) {
    return res.status(400).json({ error: 'Invalid name format' });
  }

  if (avatar && typeof avatar !== 'string') {
    return res.status(400).json({ error: 'Invalid avatar format' });
  }

  try {
    const result = await db.query(
      `UPDATE players
       SET name = $1,
           avatar = $2,
           elo = $3,
           win_rate = $4,
           total_games = $5
       WHERE id = $6
       RETURNING *`,
      [name, avatar, elo, winRate, totalGames, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating player:', err);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

// Update player tags
app.put('/api/players/:id/tags', async (req, res) => {
  const { id } = req.params;
  const { tags } = req.body;

  // Debugging: Log the incoming request parameters and body
  // console.log('Incoming request to update player tags:', { id, tags });

  if (!Array.isArray(tags)) {
    console.error('Invalid tags format. Tags must be an array.');
    return res.status(400).json({ error: 'Tags must be an array' });
  }

  try {
    // Debugging: Log the deletion query
    // console.log(`Deleting existing tags for player with ID: ${id}`);
    await db.query('DELETE FROM player_tags WHERE player_id = $1', [id]);

    // Debugging: Log the insertion process
    // console.log(`Inserting new tags for player with ID: ${id}`);
    const tagInsertPromises = tags.map(async (tag) => {
      // console.log(`Inserting tag with ID: ${tag.id} for player ID: ${id}`);
      const tagResult = await db.query(
        'INSERT INTO player_tags (player_id, tag_id) VALUES ($1, $2) RETURNING *',
        [id, tag.id]
      );
      // console.log('Inserted tag result:', tagResult.rows[0]);
      return tagResult.rows[0];
    });

    const insertedTags = await Promise.all(tagInsertPromises);

    // Debugging: Log the final response
    // console.log('Player tags updated successfully:', insertedTags);
    res.json({ message: 'Player tags updated successfully', tags: insertedTags });
  } catch (err) {
    console.error('Error updating player tags:', err);
    res.status(500).json({ error: 'Failed to update player tags' });
  }
});


// Delete a player
app.delete('/api/players/:id', async (req, res) => {
  const { id } = req.params
  try {
    const result = await db.query('DELETE FROM players WHERE id = $1 RETURNING *', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' })
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete player' })
  }
})

// Fetch recent games for a specific player
app.get('/api/players/:id/games', async (req, res) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit);

  try {
    let query = `
      SELECT * FROM games
      WHERE players @> $1::jsonb
      ORDER BY date DESC
    `;
    const params = [JSON.stringify([parseInt(id)])];

    if (!isNaN(limit)) {
      query += ' LIMIT $2';
      params.push(limit);
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching player games:', error);
    res.status(500).json({ error: 'Failed to fetch player games' });
  }
});


// Fix query for fetching stats for a player
app.get('/api/players/:id/stats', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT 
        COALESCE(SUM(CAST(scores->>$1 AS INT)), 0) AS total_points,
        COUNT(*) AS total_games,
        COALESCE(AVG(CAST(scores->>$1 AS INT)), 0) AS avg_points,
        COUNT(CASE WHEN CAST(winner AS TEXT) = $1 THEN 1 END) AS wins
      FROM games
      WHERE players @> $2::jsonb`,
      [id, JSON.stringify([parseInt(id)])]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching player stats:', error);
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
});

// Fetch all tags
app.get('/api/tags', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM tags')
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch tags' })
  }
})

// Fetch tags by player ID
app.get('/api/players/:id/tags', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT t.id, t.name 
       FROM tags t
       INNER JOIN player_tags pt ON t.id = pt.tag_id
       WHERE pt.player_id = $1`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tags for player:', error);
    res.status(500).json({ error: 'Failed to fetch tags for player' });
  }
});

// Fetch players by tag ID
app.get('/api/players/search/:tag', async (req, res) => {
  const { tag } = req.params;

  if (!tag) {
    return res.status(400).json({ error: 'Tag is required for search' });
  }

  try {
    const result = await db.query(
      `SELECT p.id, p.name, p.avatar, p.elo, p.win_rate, p.total_games
       FROM players p
       INNER JOIN player_tags pt ON p.id = pt.player_id
       INNER JOIN tags t ON pt.tag_id = t.id
       WHERE t.name ILIKE $1`,
      [`%${tag}%`]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error searching players by tag:', error);
    res.status(500).json({ error: 'Failed to search players by tag' });
  }
});

//=== ELO ===//
function calculateElo(playerElo, opponentElo, score, kFactor = 32) {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  return Math.round(playerElo + kFactor * (score - expectedScore));
}

//=== Game routes ===//

// Get all games
app.get('/api/games', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM games')
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch games' })
  }
})

// Add a new game with Elo calculation
app.post('/api/games', async (req, res) => {
    const { players, scores, winner, rounds, duration, mode } = req.body;
  
    try {
      console.log('Incoming request body:', req.body);
  
      // Insert game data
      const gameResult = await db.query(
        `INSERT INTO games (date, players, winner, scores, rounds, duration, mode) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id`,
        [
          new Date(),
          JSON.stringify(players),
          winner,
          JSON.stringify(scores),
          JSON.stringify(rounds),
          duration,
          mode || 'Ranked',
        ]
      );
      const gameId = gameResult.rows[0].id;
      console.log('Game inserted successfully with ID:', gameId);
  
      // Fetch player Elo data
      const playerData = await db.query('SELECT id, elo FROM players WHERE id = ANY($1)', [players]);
      const playerEloMap = Object.fromEntries(playerData.rows.map((p) => [p.id, p.elo]));
  
      // Calculate new Elo ratings
      const newEloMap = {};
      for (const playerId of players) {
        const playerElo = playerEloMap[playerId];
        const opponents = players.filter((id) => id !== playerId);
        const opponentEloAvg = opponents.reduce((sum, id) => sum + playerEloMap[id], 0) / opponents.length;
        const score = playerId === winner ? 1 : 0;
        newEloMap[playerId] = calculateElo(playerElo, opponentEloAvg, score);
      }
  
      // Update Elo ratings
      for (const [playerId, newElo] of Object.entries(newEloMap)) {
        await db.query('UPDATE players SET elo = $1 WHERE id = $2', [newElo, playerId]);
      }
  
      // Log Elo history
      for (const [playerId, newElo] of Object.entries(newEloMap)) {
        const oldElo = playerEloMap[playerId];
        const change = newElo - oldElo;
        await db.query(
          'INSERT INTO elo_history (player_id, game_id, old_elo, new_elo, change) VALUES ($1, $2, $3, $4, $5)',
          [playerId, gameId, oldElo, newElo, change]
        );
      }
  
      console.log('Elo update process completed successfully.');
      res.status(201).json({ message: 'Game saved and Elo updated', newEloMap });
    } catch (error) {
      console.error('Error saving game or updating Elo:', error);
      res.status(500).json({ error: 'Failed to save game or update Elo' });
    }
  });

// Get recent games
app.get('/api/games/recent', async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  try {
    const result = await db.query(
      'SELECT * FROM games ORDER BY date DESC LIMIT $1',
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recent games:', err);
    res.status(500).json({ error: 'Failed to fetch recent games' });
  }
});

// Get a game by ID
app.get('/api/games/:id', async (req, res) => {
  const { id } = req.params
  try {
    const result = await db.query('SELECT * FROM games WHERE id = $1', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' })
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch game' })
  }
})

//=== ELO History ===//

// Get Elo history for a player
app.get('/api/players/:id/elo-history', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT id, game_id, old_elo, new_elo, change, timestamp
       FROM elo_history
       WHERE player_id = $1
       ORDER BY timestamp DESC`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No Elo history found for this player' });
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching Elo history:', err);
    res.status(500).json({ error: 'Failed to fetch Elo history' });
  }
});

//=== Middleware for admin authentication ===//

// Admin login route
app.post('/api/admin/login', authLimiter, [
  body('username').trim().escape().isLength({ min: 1, max: 50 }),
  body('password').isLength({ min: 1 })
], async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    auditLog('ADMIN_LOGIN_FAILED', null, { reason: 'validation_error', errors: errors.array() }, req);
    return res.status(400).json({ error: 'Invalid input data.' });
  }

  const { username, password } = req.body;
  
  try {
    // Look for admin user in the users table with admin role
    const result = await db.query(`
      SELECT u.*, r.name as role_name 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.username = $1 AND r.name = 'admin'
    `, [username]);
    
    const user = result.rows[0];

    if (!user) {
      auditLog('ADMIN_LOGIN_FAILED', null, { reason: 'user_not_found', username }, req);
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    const isValidPassword = await bcryptjs.compare(password, user.password_hash);
    if (!isValidPassword) {
      auditLog('ADMIN_LOGIN_FAILED', user.id, { reason: 'invalid_password', username }, req);
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    // Generate admin JWT token
    const adminToken = jwt.sign(
      { 
        id: user.id,
        username: user.username,
        role: 'admin',
        player_id: user.player_id
      },
      JWT_ADMIN_SECRET,
      { expiresIn: ADMIN_TOKEN_EXPIRY }
    );
    
    // Set secure HTTP-only cookie for admin token
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
      sameSite: 'strict',
      path: '/api/admin',
      maxAge: 60 * 60 * 1000 // 1 hour
    };
    
    res.cookie('adminToken', adminToken, cookieOptions);
    
    const userInfo = {
      id: user.id,
      username: user.username,
      role: 'admin'
    };
    
    auditLog('ADMIN_LOGIN_SUCCESS', user.id, { username }, req);
    res.json({ 
      user: userInfo,
      message: 'Admin login successful'
    });
  } catch (err) {
    console.error('Error during admin login:', err);
    auditLog('ADMIN_LOGIN_ERROR', null, { reason: 'server_error', error: err.message }, req);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Admin logout route
app.post('/api/admin/logout', (req, res) => {
  // Try to get user info from token for audit logging
  let userId = null;
  try {
    const token = req.cookies.adminToken;
    if (token) {
      const decoded = jwt.verify(token, JWT_ADMIN_SECRET);
      userId = decoded.id;
    }
  } catch (err) {
    // Token might be expired or invalid, but we still want to clear cookies
  }
  
  auditLog('ADMIN_LOGOUT', userId, {}, req);
  
  // Clear the admin token cookie
  res.clearCookie('adminToken', { path: '/api/admin' });
  res.json({ message: 'Admin logged out successfully' });
});

// Middleware for verifying admin JWT token
function verifyAdminToken(req, res, next) {
  const token = req.cookies.adminToken;
  
  if (!token) {
    auditLog('ADMIN_ACCESS_DENIED', null, { reason: 'no_token', path: req.path }, req);
    return res.status(401).json({ error: 'Admin authentication required.' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_ADMIN_SECRET);
    
    // Verify that the user has admin role
    if (decoded.role !== 'admin') {
      auditLog('ADMIN_ACCESS_DENIED', decoded.id, { reason: 'insufficient_role', role: decoded.role }, req);
      return res.status(403).json({ error: 'Admin access required.' });
    }
    
    // Attach admin info to request
    req.admin = decoded;
    auditLog('ADMIN_ACCESS_GRANTED', decoded.id, { username: decoded.username, path: req.path }, req);
    next();
  } catch (err) {
    auditLog('ADMIN_ACCESS_DENIED', null, { reason: 'invalid_token', error: err.message }, req);
    return res.status(401).json({ error: 'Invalid or expired admin token.' });
  }
}

// Route to setup default admin user (for initial setup)
app.post('/api/setup-admin', async (req, res) => {
  try {
    // Check if any admin users already exist
    const existingAdmins = await db.query(`
      SELECT COUNT(*) as count 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE r.name = 'admin'
    `);
    
    if (existingAdmins.rows[0].count > 0) {
      return res.status(409).json({ error: 'Admin users already exist. Use /api/admin/login to authenticate.' });
    }

    // Ensure admin role exists
    await db.query(`
      INSERT INTO roles (id, name) VALUES (2, 'admin') 
      ON CONFLICT (id) DO NOTHING
    `);

    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await db.query(
      'INSERT INTO users (username, password_hash, role_id, email) VALUES ($1, $2, $3, $4) RETURNING id, username',
      [username, hashedPassword, 2, 'admin@localhost']
    );
    
    auditLog('ADMIN_SETUP', result.rows[0].id, { username }, req);
    res.status(201).json({ 
      message: 'Default admin user created successfully.',
      username: result.rows[0].username
    });
  } catch (err) {
    console.error('Error creating default admin user:', err);
    res.status(500).json({ error: 'Failed to create default admin user.' });
  }
});

// Legacy adminAuth function - DEPRECATED
function adminAuth(req, res, next) {
  // This is the old insecure method - redirect to new system
  res.status(401).json({ 
    error: "This authentication method is deprecated. Please use /api/admin/login to authenticate.",
    redirectTo: "/api/admin/login"
  });
}

// Admin routes - protected by verifyAdminToken middleware
app.use("/api/admin", (req, res, next) => {
  // Skip authentication for login, logout, and setup routes
  if (req.path === '/login' || req.path === '/logout') {
    return next();
  }
  return verifyAdminToken(req, res, next);
});

// Admin: Manage Players
app.get("/api/admin/players", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM players");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch players" });
  }
});


// Admin: Add a new player
app.post("/api/admin/players", async (req, res) => {
  const { name, avatar, elo, winRate, totalGames } = req.body;
  try {
    const result = await db.query(
      "INSERT INTO players (name, avatar, elo, win_rate, total_games) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [name, avatar, elo, winRate, totalGames]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add player" });
  }
});

// Admin: Manage Games
app.get("/api/admin/games", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM games");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch games" });
  }
});

/* Add a default admin user for testing purposes
app.post('/api/setup-default-admin', async (req, res) => {
  const username = 'admin';
  const password = 'admin123';
  const role = 'admin';

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO admin_users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
      [username, hashedPassword]
    );
    res.status(201).json({ message: 'Default admin user created or already exists.' });
  } catch (err) {
    console.error('Error creating default admin user:', err);
    res.status(500).json({ error: 'Failed to create default admin user.' });
  }
});*/

// ...other admin routes for updating and deleting players/games...

// ...existing code...

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function connectWithRetry(retries = 20, delay = 1000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.connect()
      console.log('✅ Connected to PostgreSQL DB')
      break
    } catch (err) {
      if (err.code === '57P03') {
        console.log(`🕐 DB starting up... retrying (${i}/${retries})`)
        await new Promise(res => setTimeout(res, delay))
      } else {
        console.error('❌ DB connection error:', err)
        process.exit(1)
      }
    }
  }
}
connectWithRetry()


const PORT = process.env.PORT || 5000
app.listen(PORT, '0.0.0.0', () => console.log(`Backend läuft auf Port ${PORT}`))
