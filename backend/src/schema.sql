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

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE -- Role names: user, moderator, admin
);

-- Insert default roles
INSERT INTO roles (name) VALUES ('user'), ('moderator'), ('admin')
ON CONFLICT (name) DO NOTHING;

-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, -- Hashed password for security
  role_id INT REFERENCES roles(id) NOT NULL, -- Foreign key to roles table
  player_id INT REFERENCES players(id) ON DELETE SET NULL, -- Foreign key to link users and players
  email VARCHAR(255) UNIQUE;
);

-- Insert default admin user
INSERT INTO users (username, password_hash, role_id)
VALUES ('admin', '$2b$10$341mxSi9rwUS9QPhm6p/DenOMSFZAIHrIV.bL53IEx8EiO8qptTRW', (SELECT id FROM roles WHERE name = 'admin'))
ON CONFLICT (username) DO NOTHING;