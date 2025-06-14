// Database adapter for Colyseus integration with PostgreSQL
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

class DatabaseAdapter {
  constructor() {
    this.pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    });
    
    this.connect();
  }
  
  async connect() {
    try {
      await this.pool.connect();
      console.log('✅ DatabaseAdapter connected to PostgreSQL');
    } catch (error) {
      console.error('❌ DatabaseAdapter connection error:', error);
    }
  }
  
  // Room management
  async createRoom(roomData) {
    const { 
      colyseusRoomId, 
      roomName, 
      hostPlayerId, 
      maxPlayers, 
      isPrivate, 
      passwordHash = null, 
      gameMode = 'ranked',
      settings = {},
      roomType = 'wizard_game'
    } = roomData;
    
    try {
      const result = await this.pool.query(`
        INSERT INTO game_rooms
          (colyseus_room_id, room_name, host_player_id, max_players, is_private, 
           password_hash, game_mode, settings, room_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [
        colyseusRoomId,
        roomName,
        hostPlayerId,
        maxPlayers,
        isPrivate,
        passwordHash,
        gameMode,
        JSON.stringify(settings),
        roomType
      ]);
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error creating room in database:', error);
      throw error;
    }
  }
  
  async updateRoomStatus(roomId, status, metadata = {}) {
    try {
      const updates = ['status = $2'];
      const values = [roomId, status];
      
      // Add additional updates if provided
      if (metadata.startedAt) {
        updates.push('started_at = $3');
        values.push(metadata.startedAt);
      }
      
      if (metadata.endedAt) {
        const nextParamIndex = values.length + 1;
        updates.push(`ended_at = $${nextParamIndex}`);
        values.push(metadata.endedAt);
      }
      
      if (metadata.currentPlayers !== undefined) {
        const nextParamIndex = values.length + 1;
        updates.push(`current_players = $${nextParamIndex}`);
        values.push(metadata.currentPlayers);
      }
      
      const query = `
        UPDATE game_rooms 
        SET ${updates.join(', ')} 
        WHERE colyseus_room_id = $1
        RETURNING id
      `;
      
      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error updating room status:', error);
      throw error;
    }
  }
  
  async getRoomByColyseusId(colyseusRoomId) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM game_rooms WHERE colyseus_room_id = $1',
        [colyseusRoomId]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error getting room by Colyseus ID:', error);
      throw error;
    }
  }
    async getRoomById(roomId) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM game_rooms WHERE id = $1',
        [roomId]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error getting room by ID:', error);
      throw error;
    }
  }
  
  async cleanupStaleRooms() {
    try {
      // Mark rooms as abandoned if they haven't been updated recently
      // and have status 'waiting' but no active Colyseus connection
      const result = await this.pool.query(`
        UPDATE game_rooms 
        SET status = 'abandoned', ended_at = NOW()
        WHERE status = 'waiting' 
        AND created_at < NOW() - INTERVAL '1 hour'
        AND colyseus_room_id IS NOT NULL
        RETURNING id, room_name, colyseus_room_id
      `);
      
      console.log(`🧹 Cleaned up ${result.rowCount} stale rooms`);
      return result.rows;
    } catch (error) {
      console.error('❌ Error cleaning up stale rooms:', error);
      throw error;
    }
  }
  
  // Player session management
  async addPlayerToRoom(roomId, playerId, isHost = false, seatPosition = null) {
    try {
      const result = await this.pool.query(`
        INSERT INTO room_participants
          (room_id, player_id, is_host, seat_position)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (room_id, player_id) 
        DO UPDATE SET is_host = $3, left_at = NULL, seat_position = $4
        RETURNING id
      `, [roomId, playerId, isHost, seatPosition]);
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error adding player to room:', error);
      throw error;
    }
  }
  
  async playerLeftRoom(roomId, playerId) {
    try {
      const result = await this.pool.query(`
        UPDATE room_participants
        SET left_at = NOW(), connection_status = 'disconnected'
        WHERE room_id = $1 AND player_id = $2
        RETURNING id
      `, [roomId, playerId]);
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error updating player left room:', error);
      throw error;
    }
  }
  
  async updatePlayerConnectionStatus(roomId, playerId, status) {
    try {
      const result = await this.pool.query(`
        UPDATE room_participants
        SET connection_status = $3
        WHERE room_id = $1 AND player_id = $2
        RETURNING id
      `, [roomId, playerId, status]);
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error updating player connection status:', error);
      throw error;
    }
  }
  
  async markPlayerReady(roomId, playerId, isReady) {
    try {
      const result = await this.pool.query(`
        UPDATE room_participants
        SET is_ready = $3
        WHERE room_id = $1 AND player_id = $2
        RETURNING id
      `, [roomId, playerId, isReady]);
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error marking player ready:', error);
      throw error;
    }
  }
  
  // Game management
  async createGame(roomId, gameMode, totalRounds) {
    try {
      const result = await this.pool.query(`
        INSERT INTO games
          (room_id, game_mode, total_rounds, started_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING id
      `, [roomId, gameMode, totalRounds]);
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error creating game:', error);
      throw error;
    }
  }
  
  async completeGame(gameId, winnerId, status = 'completed', durationSeconds = null) {
    try {
      const result = await this.pool.query(`
        UPDATE games
        SET status = $2, winner_id = $3, completed_at = NOW(), duration_seconds = $4
        WHERE id = $1
        RETURNING id
      `, [gameId, status, winnerId, durationSeconds]);
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error completing game:', error);
      throw error;
    }
  }
  
  async addGameParticipant(gameId, playerId) {
    try {
      // Get player's current ELO
      const playerResult = await this.pool.query(
        'SELECT elo FROM players WHERE id = $1',
        [playerId]
      );
      
      const playerElo = playerResult.rows[0]?.elo || 1000;
      
      const result = await this.pool.query(`
        INSERT INTO game_participants
          (game_id, player_id, elo_before)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [gameId, playerId, playerElo]);
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error adding game participant:', error);
      throw error;
    }
  }
  
  async createGameRound(gameId, roundNumber, cardsDealt, trumpSuit) {
    try {
      const result = await this.pool.query(`
        INSERT INTO game_rounds
          (game_id, round_number, cards_dealt, trump_suit)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [gameId, roundNumber, cardsDealt, trumpSuit]);
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error creating game round:', error);
      throw error;
    }
  }
  
  async recordRoundPerformance(roundId, playerId, predictedTricks, actualTricks, points) {
    try {
      const result = await this.pool.query(`
        INSERT INTO round_performances
          (round_id, player_id, predicted_tricks, actual_tricks, points_scored)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [roundId, playerId, predictedTricks, actualTricks, points]);
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error recording round performance:', error);
      throw error;
    }
  }
  
  // Player management
  async markPlayerOnline(playerId, isOnline = true) {
    try {
      const result = await this.pool.query(`
        UPDATE players
        SET is_online = $2, last_seen = NOW()
        WHERE id = $1
        RETURNING id
      `, [playerId, isOnline]);
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error updating player online status:', error);
      throw error;
    }
  }
  
  async updatePlayerSession(playerId, sessionId, colyseusSessionId) {
    try {
      const result = await this.pool.query(`
        INSERT INTO player_sessions
          (player_id, session_token, colyseus_session_id, is_active, expires_at)
        VALUES ($1, $2, $3, true, NOW() + INTERVAL '24 hours')
        RETURNING id
      `, [playerId, sessionId, colyseusSessionId]);
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error updating player session:', error);
      throw error;
    }
  }
  
  // Utility methods
  async getActiveRooms() {
    try {
      const result = await this.pool.query(`SELECT * FROM get_active_rooms()`);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting active rooms:', error);
      throw error;
    }
  }
  
  // ELO update
  async updatePlayerElo(gameId, playerId, oldElo, newElo) {
    try {
      // Update player ELO
      await this.pool.query(
        'UPDATE players SET elo = $1, peak_elo = GREATEST(peak_elo, $1) WHERE id = $2',
        [newElo, playerId]
      );
      
      // Record ELO history
      await this.pool.query(`
        INSERT INTO elo_history
          (player_id, game_id, old_elo, new_elo, elo_change)
        VALUES ($1, $2, $3, $4, $5)
      `, [playerId, gameId, oldElo, newElo, newElo - oldElo]);
      
      // Update game participant record
      await this.pool.query(`
        UPDATE game_participants
        SET elo_after = $1, elo_change = $2
        WHERE game_id = $3 AND player_id = $4
      `, [newElo, newElo - oldElo, gameId, playerId]);
      
      return true;
    } catch (error) {
      console.error('❌ Error updating player ELO:', error);
      throw error;
    }
  }
  
  // Connection helper
  async testConnection() {
    try {
      const result = await this.pool.query('SELECT NOW()');
      console.log('✅ Database connection test successful:', result.rows[0]);
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      return false;
    }
  }
  
  // Clean up resources
  async close() {
    try {
      await this.pool.end();
      console.log('✅ Database connection pool closed');
    } catch (error) {
      console.error('❌ Error closing database connection pool:', error);
    }
  }
}

// Export a singleton instance
const dbAdapter = new DatabaseAdapter();
export default dbAdapter;
