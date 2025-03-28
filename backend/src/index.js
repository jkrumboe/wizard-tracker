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

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`))
