import express from 'express'
import cors from 'cors'
import pg from 'pg'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken';
// import bcrypt from 'bcrypt';
import bcryptjs from 'bcryptjs';import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import http from 'http';
import crypto from 'crypto';
import { WizardGameRoom } from './rooms/WizardGameRoom.js';
import { LobbyRoom } from './rooms/LobbyRoom.js';
import dbAdapter from './db/dbAdapter.js';

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
    
    console.log(`CORS Check, Origin: ${origin}, Allowed: ${allowedOrigins.includes(origin)}`);
    
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
// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_ADMIN_SECRET = process.env.JWT_ADMIN_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET || !JWT_ADMIN_SECRET) {
  console.error(
    '❌ JWT secrets are not configured. ' +
    'Set JWT_SECRET, JWT_REFRESH_SECRET, and JWT_ADMIN_SECRET environment variables.'
  );
  process.exit(1);
}const ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access token
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
    auditLog('LOGIN_FAILED', null, { reason: 'validation_error' }, req);
    return res.status(400).json({ error: 'Invalid input data.' });
  }

  try {
    // Extract credentials but don't log them
    const { username, password } = req.body;
    
    // Delete password from req.body to prevent it from appearing in logs
    delete req.body.password;
    
    const result = await db.query(`
      SELECT u.*, p.id as player_id, p.name as player_name, p.display_name, p.avatar, p.elo, p.win_rate, p.total_games
      FROM users u 
      LEFT JOIN players p ON u.id = p.user_id 
      WHERE u.username = $1
    `, [username]);
    const user = result.rows[0];

    if (!user) {
      auditLog('LOGIN_FAILED', null, { reason: 'user_not_found' }, req);
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const isValidPassword = await bcryptjs.compare(password, user.password_hash);

    if (!isValidPassword) {
      auditLog('LOGIN_FAILED', user.id, { reason: 'invalid_credentials' }, req);
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
    auditLog('REGISTER_FAILED', null, { reason: 'validation_error' }, req);
    return res.status(400).json({ errors: errors.array() });
  }
  
  // Extract credentials but don't log them
  const { username, email, password } = req.body;
  
  // Delete password from req.body to prevent it from appearing in logs
  delete req.body.password;
  try {
    // Hash the password and create a new user first
    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await db.query(
      'INSERT INTO users (username, email, password_hash, role_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [username, email, hashedPassword, 1]
    );
    const newUser = userResult.rows[0];

    // Create a new player linked to the user
    const playerResult = await db.query(
      'INSERT INTO players (user_id, name, display_name, avatar, elo, win_rate, total_games) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [newUser.id, username, username, null, 1000, 0, 0]
    );
    const newPlayer = playerResult.rows[0];

    const { accessToken, refreshToken } = generateTokens({
      ...newUser,
      player_id: newPlayer.id
    });
    
    // Set secure HTTP-only cookies
    setTokenCookies(res, accessToken, refreshToken);
    
    const userInfo = {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role_id,
      player_id: newPlayer.id
    };
    
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

// User profile/me route - check authentication status
app.get('/api/me', verifyToken, async (req, res) => {
  try {
    // Get full user info with player data from database
    const result = await db.query(`
      SELECT u.*, p.id as player_id, p.name as player_name, p.display_name, 
             p.avatar, p.elo, p.peak_elo, p.win_rate, p.total_games, 
             p.total_wins, p.total_losses, p.current_streak, p.best_streak,
             p.is_online, p.last_seen, p.preferences, p.stats
      FROM users u
      LEFT JOIN players p ON u.id = p.user_id
      WHERE u.id = $1
    `, [req.user.id]);
    
    const user = result.rows[0];
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    const userInfo = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role_id,
      player_id: user.player_id,
      player: user.player_id ? {
        id: user.player_id,
        name: user.player_name,
        display_name: user.display_name,
        avatar: user.avatar,
        elo: user.elo,
        peak_elo: user.peak_elo,
        win_rate: user.win_rate,
        total_games: user.total_games,
        total_wins: user.total_wins,
        total_losses: user.total_losses,
        current_streak: user.current_streak,
        best_streak: user.best_streak,
        is_online: user.is_online,
        last_seen: user.last_seen,
        preferences: user.preferences,
        stats: user.stats
      } : null
    };
    
    res.json({ user: userInfo });
  } catch (err) {
    console.error('Error fetching user info:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Profile endpoint (alias for /api/me for backward compatibility)
app.get('/api/profile', verifyToken, async (req, res) => {
  try {
    // Get full user info with player data from database
    const result = await db.query(`
      SELECT u.*, p.id as player_id, p.name as player_name, p.display_name, 
             p.avatar, p.elo, p.peak_elo, p.win_rate, p.total_games, 
             p.total_wins, p.total_losses, p.current_streak, p.best_streak,
             p.is_online, p.last_seen, p.preferences, p.stats
      FROM users u
      LEFT JOIN players p ON u.id = p.user_id
      WHERE u.id = $1
    `, [req.user.id]);
    
    const user = result.rows[0];
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    const userInfo = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role_id,
      player_id: user.player_id,
      player: user.player_id ? {
        id: user.player_id,
        name: user.player_name,
        display_name: user.display_name,
        avatar: user.avatar,
        elo: user.elo,
        peak_elo: user.peak_elo,
        win_rate: user.win_rate,
        total_games: user.total_games,
        total_wins: user.total_wins,
        total_losses: user.total_losses,
        current_streak: user.current_streak,
        best_streak: user.best_streak,
        is_online: user.is_online,
        last_seen: user.last_seen,
        preferences: user.preferences,
        stats: user.stats
      } : null
    };
    
    res.json(userInfo);
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
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
app.put('/api/players/:id', verifyToken, async (req, res) => {
  try {
    const playerId = parseInt(req.params.id);
    const { name, display_name, avatar } = req.body;
    
    // Check if user can edit this profile
    const canEdit = req.user.role >= 2 || req.user.player_id === playerId;
    if (!canEdit) {
      return res.status(403).json({ error: 'Permission denied.' });
    }

    const result = await db.query(`
      UPDATE players 
      SET 
        name = COALESCE($2, name),
        display_name = COALESCE($3, display_name),
        avatar = COALESCE($4, avatar),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [playerId, name, display_name, avatar]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating player profile:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
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
app.get('/api/players/:id/games', verifyToken, async (req, res) => {
  try {
    const playerId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 20;
    
    const result = await db.query(`
      SELECT 
        g.id,
        g.created_at as date,
        g.completed_at,
        g.game_mode as mode,
        g.status,
        g.duration_seconds as duration,
        gp.final_score as score,
        gp.placement,
        gp.elo_before,
        gp.elo_after,
        gp.elo_change,
        COALESCE(
          json_agg(
            json_build_object(
              'id', op.id,
              'name', op.name,
              'avatar', op.avatar,
              'final_score', ogp.final_score,
              'placement', ogp.placement
            )
            ORDER BY ogp.placement
          ) FILTER (WHERE op.id IS NOT NULL AND op.id != $1), 
          '[]'::json
        ) as opponents,
        winner.name as winner_name,
        CASE WHEN gp.placement = 1 THEN true ELSE false END as won
      FROM games g
      JOIN game_participants gp ON g.id = gp.game_id
      LEFT JOIN game_participants ogp ON g.id = ogp.game_id
      LEFT JOIN players op ON ogp.player_id = op.id
      LEFT JOIN players winner ON g.winner_id = winner.id
      WHERE gp.player_id = $1 AND g.status = 'completed'
      GROUP BY g.id, g.created_at, g.completed_at, g.game_mode, g.status, g.duration_seconds, 
               gp.final_score, gp.placement, gp.elo_before, gp.elo_after, gp.elo_change, winner.name
      ORDER BY g.created_at DESC
      LIMIT $2
    `, [playerId, limit]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching player game history:', err);
    res.status(500).json({ error: 'Failed to fetch game history.' });
  }
});


// Fix query for fetching stats for a player
app.get('/api/players/:id/stats', verifyToken, async (req, res) => {
  try {
    const playerId = parseInt(req.params.id);
    
    const result = await db.query(`
      SELECT 
        p.total_games,
        p.total_wins as wins,
        p.total_losses as losses,
        p.elo,
        p.peak_elo,
        p.win_rate,
        p.current_streak,
        p.best_streak,
        COALESCE(SUM(gp.final_score), 0) as total_points,
        COALESCE(AVG(gp.final_score), 0) as average_score,
        COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'completed') as completed_games
      FROM players p
      LEFT JOIN game_participants gp ON p.id = gp.player_id
      LEFT JOIN games g ON gp.game_id = g.id
      WHERE p.id = $1
      GROUP BY p.id, p.total_games, p.total_wins, p.total_losses, p.elo, p.peak_elo, p.win_rate, p.current_streak, p.best_streak
    `, [playerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching player stats:', err);
    res.status(500).json({ error: 'Failed to fetch player stats.' });
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

// Get player tags - New for schema-v2
app.get('/api/players/:id/tags', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id);
    
    const result = await db.query(`
      SELECT t.id, t.name, t.color, t.description
      FROM tags t
      JOIN player_tags pt ON t.id = pt.tag_id
      WHERE pt.player_id = $1
      ORDER BY t.name
    `, [playerId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching player tags:', err);
    res.status(500).json({ error: 'Failed to fetch player tags.' });
  }
});

// Update player tags - New for schema-v2
app.put('/api/players/:id/tags', verifyToken, async (req, res) => {
  try {
    const playerId = parseInt(req.params.id);
    const { tags } = req.body;
    
    // Check if user can edit this profile
    const canEdit = req.user.role >= 2 || req.user.player_id === playerId;
    if (!canEdit) {
      return res.status(403).json({ error: 'Permission denied.' });
    }

    // Begin transaction
    await db.query('BEGIN');
    
    try {
      // Remove existing tags
      await db.query('DELETE FROM player_tags WHERE player_id = $1', [playerId]);
      
      // Add new tags
      if (tags && tags.length > 0) {
        const tagValues = tags.map((tag, index) => `($1, $${index + 2})`).join(', ');
        const tagParams = [playerId, ...tags.map(tag => tag.id)];
        
        await db.query(`
          INSERT INTO player_tags (player_id, tag_id) 
          VALUES ${tagValues}
        `, tagParams);
      }
      
      await db.query('COMMIT');
      
      // Return updated tags
      const result = await db.query(`
        SELECT t.id, t.name, t.color, t.description
        FROM tags t
        JOIN player_tags pt ON t.id = pt.tag_id
        WHERE pt.player_id = $1
        ORDER BY t.name
      `, [playerId]);
      
      res.json(result.rows);
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('Error updating player tags:', err);
    res.status(500).json({ error: 'Failed to update player tags.' });
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
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await db.query(`
      SELECT 
        g.id,
        g.created_at as date,
        g.game_mode as mode,
        g.status,
        g.duration_seconds as duration,
        g.winner_id,
        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'name', p.name,
              'avatar', p.avatar,
              'final_score', gp.final_score,
              'placement', gp.placement
            )
            ORDER BY gp.placement
          ) FILTER (WHERE p.id IS NOT NULL), 
          '[]'::json
        ) as players,
        winner.name as winner_name
      FROM games g
      LEFT JOIN game_participants gp ON g.id = gp.game_id
      LEFT JOIN players p ON gp.player_id = p.id
      LEFT JOIN players winner ON g.winner_id = winner.id
      WHERE g.status = 'completed'
      GROUP BY g.id, g.created_at, g.game_mode, g.status, g.duration_seconds, g.winner_id, winner.name
      ORDER BY g.created_at DESC
      LIMIT $1
    `, [limit]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recent games:', err);
    res.status(500).json({ error: 'Failed to fetch recent games.' });
  }
});

// Get a game by ID - Updated for schema-v2
app.get('/api/games/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(`
      SELECT 
        g.id,
        g.created_at as date,
        g.completed_at,
        g.game_mode as mode,
        g.status,
        g.duration_seconds as duration,
        g.winner_id as winner,
        COALESCE(
          json_object_agg(
            p.id, gp.final_score
          ) FILTER (WHERE p.id IS NOT NULL),
          '{}'::json
        ) as scores,
        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'name', p.name,
              'avatar', p.avatar,
              'final_score', gp.final_score,
              'placement', gp.placement
            )
            ORDER BY gp.placement
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'::json
        ) as players,
        -- Build rounds data from round_performances
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'round', gr.round_number,
              'cards', gr.cards_dealt,
              'players', (
                SELECT json_agg(
                  json_build_object(
                    'id', rp.player_id,
                    'call', rp.predicted_tricks,
                    'made', rp.actual_tricks,
                    'score', rp.points_scored
                  )
                  ORDER BY rp.player_id
                )
                FROM round_performances rp
                WHERE rp.round_id = gr.id
              )
            )
            ORDER BY gr.round_number
          ) FILTER (WHERE gr.id IS NOT NULL),
          '[]'::json
        ) as rounds
      FROM games g
      LEFT JOIN game_participants gp ON g.id = gp.game_id
      LEFT JOIN players p ON gp.player_id = p.id
      LEFT JOIN game_rounds gr ON g.id = gr.game_id
      WHERE g.id = $1
      GROUP BY g.id, g.created_at, g.completed_at, g.game_mode, g.status, g.duration_seconds, g.winner_id
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching game by ID:', err);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

//=== ELO History ===//

// Get Elo history for a player
app.get('/api/players/:id/elo-history', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT id, game_id, old_elo, new_elo, elo_change as change, timestamp
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
    auditLog('ADMIN_LOGIN_FAILED', null, { reason: 'validation_error' }, req);
    return res.status(400).json({ error: 'Invalid input data.' });
  }
  
  try {
    // Extract credentials but don't log them
    const { username, password } = req.body;
    
    // Delete password from req.body to prevent it from appearing in logs
    delete req.body.password;
    
    // Look for admin user in the users table with admin role
    const result = await db.query(`
      SELECT u.*, r.name as role_name 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.username = $1 AND r.name = 'admin'
    `, [username]);
    
    const user = result.rows[0];

    if (!user) {
      auditLog('ADMIN_LOGIN_FAILED', null, { reason: 'invalid_credentials' }, req);
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    const isValidPassword = await bcryptjs.compare(password, user.password_hash);
    if (!isValidPassword) {
      auditLog('ADMIN_LOGIN_FAILED', user.id, { reason: 'invalid_credentials' }, req);
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
    }    // Ensure admin role exists
    await db.query(`
      INSERT INTO roles (id, name) VALUES (2, 'admin') 
      ON CONFLICT (id) DO NOTHING
    `);

    // Use environment variable if present or generate a secure random username and password
    const username = process.env.ADMIN_USERNAME || 'admin';
    
    // Generate a secure random password if not provided in environment
    const password = process.env.ADMIN_PASSWORD || generateSecurePassword();
    
    // Do not display the generated password on the server console for security reasons
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await db.query(
      'INSERT INTO users (username, password_hash, role_id, email) VALUES ($1, $2, $3, $4) RETURNING id, username',
      [username, hashedPassword, 2, 'admin@localhost']
    );
    auditLog('ADMIN_SETUP', result.rows[0].id, { username }, req);
    
    // Respond with the generated password only in the HTTP response if it was generated
    if (!process.env.ADMIN_PASSWORD) {
      res.status(201).json({ 
        message: 'Admin user created successfully with a generated secure password. This password is shown ONLY ONCE in this response. Store it securely.',
        username: result.rows[0].username,
        password: password,
        passwordGenerated: true
      });
    } else {
      res.status(201).json({ 
        message: 'Admin user created successfully with the provided credentials.',
        username: result.rows[0].username,
        passwordGenerated: false
      });
    }
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

//=== MULTIPLAYER & COLYSEUS ROUTES ===//

// Get active game rooms
app.get('/api/rooms/active', async (req, res) => {
  try {
    // Clean up stale rooms first
    await dbAdapter.cleanupStaleRooms();
    
    const rooms = await dbAdapter.getActiveRooms();
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching active rooms:', error);
    res.status(500).json({ error: 'Failed to fetch active rooms' });
  }
});

// Get room details by ID (supports both database UUID and Colyseus room ID)
app.get('/api/rooms/:roomId', async (req, res) => {
  const { roomId } = req.params;
  
  try {
    let room = null;
    
    // Check if it's a database UUID (36 characters with dashes)
    if (roomId.length === 36 && roomId.includes('-')) {
      room = await dbAdapter.getRoomById(roomId);
    } else {
      // Assume it's a Colyseus room ID
      room = await dbAdapter.getRoomByColyseusId(roomId);
    }
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    res.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Create a new game room (used by frontend before creating Colyseus room)
app.post('/api/rooms', verifyToken, async (req, res) => {
  const { roomName, maxPlayers, isPrivate, gameMode, settings, password } = req.body;
  
  try {
    // Generate a temporary room ID that will be replaced by Colyseus
    const tempRoomId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Hash password if provided for private rooms
    let passwordHash = null;
    if (isPrivate && password) {
      passwordHash = await bcrypt.hash(password, 10);
    }
    
    const roomData = await dbAdapter.createRoom({
      colyseusRoomId: tempRoomId,
      roomName: roomName || `${req.user.username}'s Game`,
      hostPlayerId: req.user.player_id,
      maxPlayers: maxPlayers || 4,
      isPrivate: isPrivate || false,
      gameMode: gameMode || 'ranked',
      passwordHash: passwordHash,
      settings: settings || {}
    });
    
    res.status(201).json({
      roomId: roomData.id,
      tempColyseusId: tempRoomId,
      message: 'Room created successfully'
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Update room with actual Colyseus room ID
app.put('/api/rooms/:roomId/colyseus', async (req, res) => {
  const { roomId } = req.params;
  const { colyseusRoomId } = req.body;
  
  try {
    await dbAdapter.pool.query(
      'UPDATE game_rooms SET colyseus_room_id = $1 WHERE id = $2',
      [colyseusRoomId, roomId]
    );
    
    res.json({ message: 'Room updated with Colyseus ID' });
  } catch (error) {
    console.error('Error updating room with Colyseus ID:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// Join a room (mark player as participant)
app.post('/api/rooms/:roomId/join', verifyToken, async (req, res) => {
  const { roomId } = req.params;
  
  try {
    await dbAdapter.addPlayerToRoom(roomId, req.user.player_id);
    res.json({ message: 'Joined room successfully' });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Leave a room
app.post('/api/rooms/:roomId/leave', verifyToken, async (req, res) => {
  const { roomId } = req.params;
  
  try {
    await dbAdapter.playerLeftRoom(roomId, req.user.player_id);
    res.json({ message: 'Left room successfully' });
  } catch (error) {
    console.error('Error leaving room:', error);
    res.status(500).json({ error: 'Failed to leave room' });
  }
});

// Get player's current session info
app.get('/api/player/session', verifyToken, async (req, res) => {
  try {
    const result = await dbAdapter.pool.query(`
      SELECT ps.*, p.name, p.elo, p.is_online
      FROM player_sessions ps
      JOIN players p ON ps.player_id = p.id
      WHERE ps.player_id = $1 AND ps.is_active = true
      ORDER BY ps.created_at DESC
      LIMIT 1
    `, [req.user.player_id]);
    
    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error fetching player session:', error);
    res.status(500).json({ error: 'Failed to fetch player session' });
  }
});

// Update player online status
app.post('/api/player/status', verifyToken, async (req, res) => {
  const { isOnline } = req.body;
  
  try {
    await dbAdapter.markPlayerOnline(req.user.player_id, isOnline);
    res.json({ message: 'Player status updated' });
  } catch (error) {
    console.error('Error updating player status:', error);
    res.status(500).json({ error: 'Failed to update player status' });
  }
});

// Get game history for multiplayer games
app.get('/api/games/multiplayer', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;
  
  try {
    const result = await dbAdapter.pool.query(`
      SELECT 
        g.*,
        gr.room_name,
        p.name as winner_name,
        COUNT(gp.id) as participant_count
      FROM games g
      LEFT JOIN game_rooms gr ON g.room_id = gr.id
      LEFT JOIN players p ON g.winner_id = p.id
      LEFT JOIN game_participants gp ON g.id = gp.game_id
      WHERE g.room_id IS NOT NULL
      GROUP BY g.id, gr.room_name, p.name
      ORDER BY g.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching multiplayer games:', error);
    res.status(500).json({ error: 'Failed to fetch multiplayer games' });
  }
});

// Verify room password for private rooms
app.post('/api/rooms/:roomId/verify-password', async (req, res) => {
  const { roomId } = req.params;
  const { password } = req.body;
  
  try {
    // Get room password hash
    const result = await dbAdapter.pool.query(
      'SELECT password_hash, is_private FROM game_rooms WHERE id = $1 OR colyseus_room_id = $1',
      [roomId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    const room = result.rows[0];
    
    if (!room.is_private) {
      return res.json({ valid: true }); // Public room, no password needed
    }
    
    if (!room.password_hash) {
      return res.json({ valid: true }); // Private room but no password set
    }
    
    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }
    
    const isValid = await bcrypt.compare(password, room.password_hash);
    res.json({ valid: isValid });
  } catch (error) {
    console.error('Error verifying room password:', error);
    res.status(500).json({ error: 'Failed to verify password' });
  }
});


const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Define an async function to start the server
async function startServer() {
  try {
    // Wait for database connection before starting server
    await connectWithRetry();
    
    const PORT = process.env.PORT || 5000;

    // Create HTTP server and Colyseus game server
    const server = http.createServer(app);
    const gameServer = new Server({
      transport: new WebSocketTransport({
        server: server,
      }),
    });

    // Define game rooms
    gameServer.define('wizard_game', WizardGameRoom);
    gameServer.define('lobby', LobbyRoom);

    // Start the server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Backend läuft auf Port ${PORT}`);
      console.log(`🎮 Colyseus game server is ready!`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Connect to the database with retry mechanism
async function connectWithRetry(retries = 20, delay = 1000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.connect();
      console.log('✅ Connected to PostgreSQL DB');
      return; // Successfully connected
    } catch (err) {
      if (err.code === '57P03' || err.code === 'ECONNREFUSED') {
        console.log(`🕐 DB starting up... retrying (${i}/${retries})`);
        await new Promise(res => setTimeout(res, delay));
      } else {
        console.error('❌ DB connection error:', err);
        throw err; // Propagate the error to be handled by startServer
      }
    }
  }
  throw new Error('Failed to connect to database after maximum retries');
}

// Start the server
startServer().catch(err => {
  console.error('❌ Server startup failed:', err);
  process.exit(1);
});

// Helper function to generate a secure random password
function generateSecurePassword(length = 16) {
  // Define character sets for password
  const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
  const numberChars = '0123456789';
  const specialChars = '!@#$%^&*()-_=+[]{}|;:,.<>?';
  
  // Combine all character sets
  const allChars = uppercaseChars + lowercaseChars + numberChars + specialChars;
  
  // Generate random bytes
  const randomBytes = crypto.randomBytes(length);
  
  // Ensure password has at least one character from each required set
  let password = 
    uppercaseChars[crypto.randomInt(0, uppercaseChars.length)] +
    lowercaseChars[crypto.randomInt(0, lowercaseChars.length)] +
    numberChars[crypto.randomInt(0, numberChars.length)] +
    specialChars[crypto.randomInt(0, specialChars.length)];
  
  // Fill the rest with random characters
  for (let i = 4; i < length; i++) {
    const randomIndex = randomBytes[i] % allChars.length;
    password += allChars[randomIndex];
  }
  
  // Shuffle the password characters
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}
