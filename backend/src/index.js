import express from 'express'
import cors from 'cors'
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()
const app = express()
app.use(cors())
app.use(express.json())

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
})

// Testroute
app.get('/api/players', async (req, res) => {
  const result = await db.query('SELECT * FROM players')
  res.json(result.rows)
})

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
  const { id } = req.params
  const { name, avatar, elo, winRate, totalGames } = req.body
  try {
    const result = await db.query(
      'UPDATE players SET name = $1, avatar = $2, elo = $3, win_rate = $4, total_games = $5 WHERE id = $6 RETURNING *',
      [name, avatar, elo, winRate, totalGames, id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' })
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update player' })
  }
})

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
        COALESCE(SUM((scores->>$1)::int), 0) AS total_points,
        COUNT(*) AS total_games,
        COALESCE(AVG((scores->>$1)::int), 0) AS avg_points,
        COUNT(CASE WHEN winner = $1 THEN 1 END) AS wins
      FROM games`,
      [id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching player stats:', error);
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
});

// Game routes

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
  const { date, players, winner, scores, rounds } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO games (date, players, winner, scores, rounds) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [date, JSON.stringify(players), winner, JSON.stringify(scores), JSON.stringify(rounds)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
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

// Middleware for admin authentication
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
