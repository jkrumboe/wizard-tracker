import express from 'express'
import cors from 'cors'
import pg from 'pg'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import bcryptjs from 'bcryptjs';

dotenv.config()
const app = express()
app.use(cors())
app.use(express.json())

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
})

// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Middleware for verifying JWT and roles
function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
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

// User login route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user || !(await bcryptjs.compare(password, user.password_hash))) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign({ id: user.id, role: user.role_id, player_id: user.player_id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Register a new standard user and create a player for that user
app.post('/api/register', async (req, res) => {
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
    );
    const newUser = userResult.rows[0];

    const token = jwt.sign({ id: newUser.id, role: newUser.role_id, player_id: newUser.player_id }, JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ token });
  } catch (err) {
    console.error('Fehler bei der Registrierung:', err);
  
    if (err.code === '23505') {
      // Überprüfe, welche Einschränkung verletzt wurde
      if (err.constraint === 'users_username_key') {
        return res.status(409).json({ error: 'Benutzername bereits vergeben.' });
      } else if (err.constraint === 'users_email_key') {
        return res.status(409).json({ error: 'E-Mail-Adresse bereits registriert.' });
      }
    }
  
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
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
           total_games = $5,
           tags = $6
       WHERE id = $7
       RETURNING *`,
      [name, avatar, elo, winRate, totalGames, tags || '[]', id]
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

// Fix query for fetching game history for a player
app.get('/api/players/:id/games', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM games WHERE players @> $1::jsonb',
      [JSON.stringify([parseInt(id)])]
    );
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
app.get('/api/players/search', async (req, res) => {
  const { tag } = req.query;

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

// Fix the POST /api/games route to include the rounds field
app.post('/api/games', async (req, res) => {
  const { date, players, winner, scores, rounds, duration } = req.body;

  // Debugging: Log the incoming request body
  console.log('Incoming request body:', req.body);

  try {
    const result = await db.query(
      'INSERT INTO games (date, players, winner, scores, rounds, duration) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [date, JSON.stringify(players), winner, JSON.stringify(scores), JSON.stringify(rounds), duration]
    );

    // Debugging: Log the result from the database
    console.log('Database insert result:', result.rows[0]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    // Debugging: Log the error
    console.error('Error saving game:', err);

    res.status(500).json({ error: 'Failed to save game' });
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

//=== Middleware for admin authentication ===//
function adminAuth(req, res, next) {
  const { username, password } = req.headers;
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return next();
  }
  res.status(403).json({ error: "Unauthorized access" });
}

// Admin routes
app.use("/api/admin", adminAuth);

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
