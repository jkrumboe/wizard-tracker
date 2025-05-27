-- Test data for Wizard Tracker database
-- This script creates sample users, players, and other test data

-- First, let's check if we have roles (required for users)
INSERT INTO roles (id, name, permissions) VALUES 
  (1, 'user', '{"can_play": true, "can_create_games": true}'),
  (2, 'admin', '{"can_play": true, "can_create_games": true, "can_moderate": true, "can_admin": true}')
ON CONFLICT (id) DO NOTHING;

-- Create test users with hashed passwords
-- Password for all test users is: "testpass123"
-- Hash generated with bcrypt, rounds=10
INSERT INTO users (username, email, password_hash, role_id, is_active) VALUES 
  ('testuser', 'test@example.com', '$2b$10$rQZ8kHWQ5qYx4vJ8ZXtxVOGHJKL3gJ9f7M2dP6xNzQwE8tR4Y1vC6', 1, true),
  ('player1', 'player1@example.com', '$2b$10$rQZ8kHWQ5qYx4vJ8ZXtxVOGHJKL3gJ9f7M2dP6xNzQwE8tR4Y1vC6', 1, true),
  ('player2', 'player2@example.com', '$2b$10$rQZ8kHWQ5qYx4vJ8ZXtxVOGHJKL3gJ9f7M2dP6xNzQwE8tR4Y1vC6', 1, true),
  ('gamer123', 'gamer@example.com', '$2b$10$rQZ8kHWQ5qYx4vJ8ZXtxVOGHJKL3gJ9f7M2dP6xNzQwE8tR4Y1vC6', 1, true),
  ('wizardpro', 'pro@example.com', '$2b$10$rQZ8kHWQ5qYx4vJ8ZXtxVOGHJKL3gJ9f7M2dP6xNzQwE8tR4Y1vC6', 1, true),
  ('admin', 'admin@example.com', '$2b$10$rQZ8kHWQ5qYx4vJ8ZXtxVOGHJKL3gJ9f7M2dP6xNzQwE8tR4Y1vC6', 2, true)
ON CONFLICT (username) DO NOTHING;

-- Create corresponding player profiles
INSERT INTO players (user_id, name, display_name, avatar, elo, peak_elo, total_games, total_wins, total_losses, win_rate, is_online) VALUES 
  (1, 'testuser', 'Test User', 'avatar1.png', 1200, 1350, 25, 15, 10, 60.00, false),
  (2, 'player1', 'The Wizard', 'avatar2.png', 1500, 1600, 45, 30, 15, 66.67, true),
  (3, 'player2', 'Card Master', 'avatar3.png', 1100, 1200, 20, 8, 12, 40.00, true),
  (4, 'gamer123', 'Gaming Guru', 'avatar4.png', 1350, 1400, 35, 22, 13, 62.86, false),
  (5, 'wizardpro', 'Wizard Pro', 'avatar5.png', 1800, 1850, 60, 45, 15, 75.00, true),
  (6, 'admin', 'Administrator', 'admin_avatar.png', 1000, 1000, 0, 0, 0, 0.00, false)
ON CONFLICT DO NOTHING;

-- Create some achievements
INSERT INTO achievements (name, description, icon, condition_type, condition_value, points) VALUES 
  ('First Win', 'Win your first game', '🏆', 'wins', 1, 10),
  ('Winning Streak', 'Win 5 games in a row', '🔥', 'streak', 5, 50),
  ('Century Club', 'Play 100 games', '💯', 'games_played', 100, 25),
  ('Perfect Prediction', 'Get all predictions correct in a round', '🎯', 'perfect_round', 1, 30),
  ('High Roller', 'Reach 1500 ELO', '⭐', 'elo', 1500, 40)
ON CONFLICT (name) DO NOTHING;

-- Grant some achievements to players
INSERT INTO player_achievements (player_id, achievement_id, earned_at) VALUES 
  (2, 1, NOW() - INTERVAL '30 days'),
  (2, 2, NOW() - INTERVAL '20 days'),
  (5, 1, NOW() - INTERVAL '60 days'),
  (5, 2, NOW() - INTERVAL '45 days'),
  (5, 5, NOW() - INTERVAL '10 days'),
  (4, 1, NOW() - INTERVAL '15 days')
ON CONFLICT DO NOTHING;

-- Create some sample game rooms (historical data)
INSERT INTO game_rooms (colyseus_room_id, room_name, host_player_id, max_players, current_players, is_private, game_mode, status, created_at, ended_at) VALUES 
  ('room_001', 'Epic Battle Arena', 2, 4, 0, false, 'ranked', 'finished', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '45 minutes'),
  ('room_002', 'Casual Friday Fun', 1, 6, 0, false, 'casual', 'finished', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '30 minutes'),
  ('room_003', 'Private VIP Room', 5, 4, 0, true, 'ranked', 'finished', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours' + INTERVAL '25 minutes')
ON CONFLICT (colyseus_room_id) DO NOTHING;

-- Create some historical games
INSERT INTO games (room_id, winner_id, total_rounds, duration_seconds, game_mode, status, started_at, ended_at) VALUES 
  (1, 2, 5, 2700, 'ranked', 'finished', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '45 minutes'),
  (2, 1, 3, 1800, 'casual', 'finished', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '30 minutes'),
  (3, 5, 4, 1500, 'ranked', 'finished', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours' + INTERVAL '25 minutes')
ON CONFLICT DO NOTHING;

-- Add game participants
INSERT INTO game_participants (game_id, player_id, final_score, final_rank, elo_change) VALUES 
  -- Game 1 participants
  (1, 2, 85, 1, 25),
  (1, 1, 70, 2, 15),
  (1, 3, 55, 3, -10),
  (1, 4, 40, 4, -20),
  
  -- Game 2 participants  
  (2, 1, 90, 1, 20),
  (2, 2, 75, 2, 10),
  (2, 3, 60, 3, -15),
  
  -- Game 3 participants
  (3, 5, 95, 1, 30),
  (3, 2, 80, 2, 5),
  (3, 4, 65, 3, -10),
  (3, 1, 50, 4, -25)
ON CONFLICT DO NOTHING;

-- Add some ELO history
INSERT INTO elo_history (player_id, old_elo, new_elo, change_amount, game_id, recorded_at) VALUES 
  (2, 1475, 1500, 25, 1, NOW() - INTERVAL '2 days'),
  (1, 1180, 1200, 20, 2, NOW() - INTERVAL '1 day'),
  (5, 1770, 1800, 30, 3, NOW() - INTERVAL '3 hours'),
  (3, 1110, 1100, -10, 1, NOW() - INTERVAL '2 days'),
  (4, 1370, 1350, -20, 1, NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- Add some player sessions for activity tracking
INSERT INTO player_sessions (player_id, session_start, session_end, games_played, elo_gained) VALUES 
  (2, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '1 hour', 1, 25),
  (1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '45 minutes', 1, 20),
  (5, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours', 1, 30),
  (4, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '2 hours', 2, -15),
  (3, NOW() - INTERVAL '1 week', NOW() - INTERVAL '1 week' + INTERVAL '30 minutes', 1, -10)
ON CONFLICT DO NOTHING;

-- Update player statistics based on the games
UPDATE players SET 
  total_games = (SELECT COUNT(*) FROM game_participants WHERE player_id = players.id),
  total_wins = (SELECT COUNT(*) FROM game_participants gp JOIN games g ON gp.game_id = g.id WHERE gp.player_id = players.id AND g.winner_id = players.id),
  total_losses = (SELECT COUNT(*) FROM game_participants gp JOIN games g ON gp.game_id = g.id WHERE gp.player_id = players.id AND g.winner_id != players.id),
  win_rate = CASE 
    WHEN (SELECT COUNT(*) FROM game_participants WHERE player_id = players.id) > 0 
    THEN ROUND((SELECT COUNT(*) FROM game_participants gp JOIN games g ON gp.game_id = g.id WHERE gp.player_id = players.id AND g.winner_id = players.id)::numeric / (SELECT COUNT(*) FROM game_participants WHERE player_id = players.id) * 100, 2)
    ELSE 0.00 
  END;

-- Set some players as online
UPDATE players SET is_online = true WHERE id IN (2, 3, 5);

-- Add some room participants for the historical rooms
INSERT INTO room_participants (room_id, player_id, joined_at, left_at, is_host) VALUES 
  (1, 2, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '45 minutes', true),
  (1, 1, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '45 minutes', false),
  (1, 3, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '45 minutes', false),
  (1, 4, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '45 minutes', false),
  
  (2, 1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '30 minutes', true),
  (2, 2, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '30 minutes', false),
  (2, 3, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '30 minutes', false),
  
  (3, 5, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours' + INTERVAL '25 minutes', true),
  (3, 2, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours' + INTERVAL '25 minutes', false),
  (3, 4, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours' + INTERVAL '25 minutes', false),
  (3, 1, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours' + INTERVAL '25 minutes', false)
ON CONFLICT DO NOTHING;

-- Show summary of created test data
SELECT 'Test Data Summary' as info;
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as player_count FROM players;
SELECT COUNT(*) as achievement_count FROM achievements;
SELECT COUNT(*) as room_count FROM game_rooms;
SELECT COUNT(*) as game_count FROM games;
SELECT COUNT(*) as participant_count FROM game_participants;

-- Show test users for reference
SELECT 'Test Users (password: testpass123)' as info;
SELECT id, username, email, role_id, is_active FROM users ORDER BY id;
