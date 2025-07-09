-- Enhanced Multiplayer Database Schema for KeepWiz with Colyseus
-- Optimized for real-time multiplayer gameplay and efficient data access

-- Clear existing data (for development)
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;

-- Enable UUID extension for better distributed IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable JSONB indexing for better performance
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- ========================================
-- CORE USER & AUTHENTICATION TABLES
-- ========================================

-- Roles table
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table with enhanced authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT NOT NULL,
    role_id INTEGER REFERENCES roles(id) DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Players table with enhanced multiplayer features
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    avatar TEXT,
    elo INTEGER DEFAULT 1000,
    peak_elo INTEGER DEFAULT 1000,
    win_rate DECIMAL(5,2) DEFAULT 0.00,
    total_games INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    total_losses INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    preferences JSONB DEFAULT '{}',
    stats JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- MULTIPLAYER ROOM & SESSION TABLES
-- ========================================

-- Game rooms table for Colyseus room management
CREATE TABLE game_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    colyseus_room_id VARCHAR(255) UNIQUE NOT NULL,
    room_name VARCHAR(100) NOT NULL,
    room_type VARCHAR(50) DEFAULT 'wizard_game',
    host_player_id INTEGER REFERENCES players(id),
    max_players INTEGER DEFAULT 4,
    current_players INTEGER DEFAULT 0,
    is_private BOOLEAN DEFAULT false,
    password_hash TEXT,
    game_mode VARCHAR(50) DEFAULT 'ranked',
    settings JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'starting', 'in_progress', 'finished', 'abandoned')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER
);

-- Room participants tracking
CREATE TABLE room_participants (
    id SERIAL PRIMARY KEY,
    room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES players(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    is_host BOOLEAN DEFAULT false,
    is_ready BOOLEAN DEFAULT false,
    connection_status VARCHAR(20) DEFAULT 'connected' CHECK (connection_status IN ('connected', 'disconnected', 'reconnecting')),
    seat_position INTEGER,
    UNIQUE(room_id, player_id),
    UNIQUE(room_id, seat_position)
);

-- ========================================
-- ENHANCED GAME TABLES
-- ========================================

-- Games table with multiplayer enhancements
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    room_id UUID REFERENCES game_rooms(id),
    game_mode VARCHAR(50) DEFAULT 'ranked',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    current_round INTEGER DEFAULT 1,
    total_rounds INTEGER DEFAULT 10,
    winner_id INTEGER REFERENCES players(id),
    game_state JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER
);

-- Game participants (for completed games)
CREATE TABLE game_participants (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES players(id),
    final_score INTEGER DEFAULT 0,
    placement INTEGER,
    elo_before INTEGER,
    elo_after INTEGER,
    elo_change INTEGER DEFAULT 0,
    performance_stats JSONB DEFAULT '{}',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP WITH TIME ZONE
);

-- Rounds table with enhanced tracking
CREATE TABLE game_rounds (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    cards_dealt INTEGER NOT NULL,
    trump_suit VARCHAR(20),
    round_state JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(game_id, round_number)
);

-- Player round performance
CREATE TABLE round_performances (
    id SERIAL PRIMARY KEY,
    round_id INTEGER REFERENCES game_rounds(id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES players(id),
    predicted_tricks INTEGER,
    actual_tricks INTEGER,
    points_scored INTEGER DEFAULT 0,
    bonus_points INTEGER DEFAULT 0,
    cards_played JSONB DEFAULT '[]',
    performance_data JSONB DEFAULT '{}',
    UNIQUE(round_id, player_id)
);

-- ========================================
-- REAL-TIME FEATURES
-- ========================================

-- Player sessions for connection tracking
CREATE TABLE player_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    colyseus_session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Matchmaking queue
CREATE TABLE matchmaking_queue (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    game_mode VARCHAR(50) DEFAULT 'ranked',
    elo_range_min INTEGER,
    elo_range_max INTEGER,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, game_mode)
);

-- ========================================
-- STATISTICS & ANALYTICS
-- ========================================

-- Enhanced ELO history with more context
CREATE TABLE elo_history (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    game_id INTEGER REFERENCES games(id),
    old_elo INTEGER NOT NULL,
    new_elo INTEGER NOT NULL,
    elo_change INTEGER NOT NULL,
    game_mode VARCHAR(50) DEFAULT 'ranked',
    opponent_elos JSONB DEFAULT '[]',
    performance_factor DECIMAL(4,2) DEFAULT 1.00,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Player achievements and badges
CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    category VARCHAR(50),
    requirements JSONB DEFAULT '{}',
    points INTEGER DEFAULT 0,
    is_hidden BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE player_achievements (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
    progress JSONB DEFAULT '{}',
    unlocked_at TIMESTAMP WITH TIME ZONE,
    is_unlocked BOOLEAN DEFAULT false,
    UNIQUE(player_id, achievement_id)
);

-- ========================================
-- PERFORMANCE INDEXES
-- ========================================

-- Players indexes
CREATE INDEX idx_players_user_id ON players(user_id);
CREATE INDEX idx_players_elo ON players(elo DESC);
CREATE INDEX idx_players_online ON players(is_online) WHERE is_online = true;
CREATE INDEX idx_players_last_seen ON players(last_seen DESC);

-- Game rooms indexes
CREATE INDEX idx_game_rooms_status ON game_rooms(status);
CREATE INDEX idx_game_rooms_colyseus_id ON game_rooms(colyseus_room_id);
CREATE INDEX idx_game_rooms_host ON game_rooms(host_player_id);
CREATE INDEX idx_game_rooms_created ON game_rooms(created_at DESC);

-- Room participants indexes
CREATE INDEX idx_room_participants_room ON room_participants(room_id);
CREATE INDEX idx_room_participants_player ON room_participants(player_id);
CREATE INDEX idx_room_participants_status ON room_participants(connection_status);

-- Games indexes
CREATE INDEX idx_games_room_id ON games(room_id);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_created ON games(created_at DESC);
CREATE INDEX idx_games_mode ON games(game_mode);

-- Game participants indexes
CREATE INDEX idx_game_participants_game ON game_participants(game_id);
CREATE INDEX idx_game_participants_player ON game_participants(player_id);
CREATE INDEX idx_game_participants_placement ON game_participants(placement);

-- Round performance indexes
CREATE INDEX idx_round_performances_round ON round_performances(round_id);
CREATE INDEX idx_round_performances_player ON round_performances(player_id);

-- Session indexes
CREATE INDEX idx_player_sessions_player ON player_sessions(player_id);
CREATE INDEX idx_player_sessions_active ON player_sessions(is_active) WHERE is_active = true;
CREATE INDEX idx_player_sessions_token ON player_sessions(session_token);

-- Matchmaking indexes
CREATE INDEX idx_matchmaking_queue_mode ON matchmaking_queue(game_mode);
CREATE INDEX idx_matchmaking_queue_created ON matchmaking_queue(created_at);

-- ELO history indexes
CREATE INDEX idx_elo_history_player ON elo_history(player_id, timestamp DESC);
CREATE INDEX idx_elo_history_game ON elo_history(game_id);

-- ========================================
-- DEFAULT DATA
-- ========================================

-- Insert default roles
INSERT INTO roles (id, name, permissions) VALUES 
(1, 'player', '{"can_play": true, "can_chat": true}'),
(2, 'admin', '{"can_play": true, "can_chat": true, "can_moderate": true, "can_admin": true}'),
(3, 'moderator', '{"can_play": true, "can_chat": true, "can_moderate": true}');

-- Insert default achievements
INSERT INTO achievements (name, description, category, requirements, points) VALUES
('First Game', 'Complete your first game', 'gameplay', '{"games_played": 1}', 10),
('Perfect Prediction', 'Predict exactly right for an entire game', 'gameplay', '{"perfect_games": 1}', 50),
('Winning Streak', 'Win 5 games in a row', 'competition', '{"win_streak": 5}', 25),
('ELO Climber', 'Reach 1200 ELO', 'competition', '{"elo_threshold": 1200}', 30),
('Veteran Player', 'Play 100 games', 'gameplay', '{"games_played": 100}', 40),
('Social Butterfly', 'Play with 20 different players', 'social', '{"unique_opponents": 20}', 20);

-- ========================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ========================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update player stats when game participants are added
CREATE OR REPLACE FUNCTION update_player_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Update total games
        UPDATE players SET 
            total_games = (
                SELECT COUNT(*) 
                FROM game_participants gp 
                JOIN games g ON gp.game_id = g.id 
                WHERE gp.player_id = NEW.player_id AND g.status = 'completed'
            ),
            total_wins = (
                SELECT COUNT(*) 
                FROM game_participants gp 
                JOIN games g ON gp.game_id = g.id 
                WHERE gp.player_id = NEW.player_id AND g.status = 'completed' AND gp.placement = 1
            ),
            total_losses = (
                SELECT COUNT(*) 
                FROM game_participants gp 
                JOIN games g ON gp.game_id = g.id 
                WHERE gp.player_id = NEW.player_id AND g.status = 'completed' AND gp.placement > 1
            ),
            elo = COALESCE(NEW.elo_after, elo),
            peak_elo = GREATEST(peak_elo, COALESCE(NEW.elo_after, elo))
        WHERE id = NEW.player_id;
        
        -- Update win rate
        UPDATE players SET 
            win_rate = CASE 
                WHEN total_games > 0 THEN (total_wins::DECIMAL / total_games * 100)
                ELSE 0 
            END
        WHERE id = NEW.player_id;
        
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_player_stats_trigger 
    AFTER INSERT OR UPDATE ON game_participants 
    FOR EACH ROW EXECUTE FUNCTION update_player_stats();

-- ========================================
-- UTILITY FUNCTIONS
-- ========================================

-- Function to clean up old sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM player_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP OR 
          (last_activity < CURRENT_TIMESTAMP - INTERVAL '24 hours' AND is_active = false);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get active rooms
CREATE OR REPLACE FUNCTION get_active_rooms()
RETURNS TABLE (
    room_id UUID,
    room_name VARCHAR,
    current_players INTEGER,
    max_players INTEGER,
    host_name VARCHAR,
    game_mode VARCHAR,
    is_private BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gr.id,
        gr.room_name,
        gr.current_players,
        gr.max_players,
        p.display_name,
        gr.game_mode,
        gr.is_private
    FROM game_rooms gr
    LEFT JOIN players p ON gr.host_player_id = p.id
    WHERE gr.status IN ('waiting', 'starting')
    ORDER BY gr.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to update room participant count
CREATE OR REPLACE FUNCTION update_room_participant_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE game_rooms 
        SET current_players = (
            SELECT COUNT(*) 
            FROM room_participants 
            WHERE room_id = NEW.room_id AND left_at IS NULL
        )
        WHERE id = NEW.room_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE game_rooms 
        SET current_players = (
            SELECT COUNT(*) 
            FROM room_participants 
            WHERE room_id = NEW.room_id AND left_at IS NULL
        )
        WHERE id = NEW.room_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE game_rooms 
        SET current_players = (
            SELECT COUNT(*) 
            FROM room_participants 
            WHERE room_id = OLD.room_id AND left_at IS NULL
        )
        WHERE id = OLD.room_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_room_participant_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON room_participants
    FOR EACH ROW EXECUTE FUNCTION update_room_participant_count();

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres;
