CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  avatar TEXT,
  elo INT DEFAULT 1000,
  win_rate FLOAT DEFAULT 0,
  total_games INT DEFAULT 0,
  tags JSONB DEFAULT '[]' -- Tags for players
);

CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  players JSONB NOT NULL, -- List of player IDs
  winner INT REFERENCES players(id),
  scores JSONB NOT NULL, -- Player scores
  rounds JSONB NOT NULL -- Detailed round data
);

CREATE TABLE rounds (
  id SERIAL PRIMARY KEY,
  game_id INT REFERENCES games(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  cards INT NOT NULL, -- Number of cards in the round
  players JSONB NOT NULL -- Player-specific data for the round
);

CREATE TABLE leaderboard (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL, -- ELO, Win Rate, etc.
  rankings JSONB NOT NULL -- Rankings data
);

CREATE TABLE admin_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL -- Hashed password for security
);