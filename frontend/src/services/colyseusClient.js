import { Client } from 'colyseus.js';
import { roomAPI } from './api.js';

class ColyseusService {
  constructor() {    // Use development URL for now, can be configured for production
    const wsUrl = import.meta.env.MODE === 'production' 
      ? 'wss://wizard.jkrumboe.dev' 
      : 'ws://localhost:5055';
      
    this.client = new Client(wsUrl);
    this.currentRoom = null;
    this.lobbyRoom = null;
    this.playerData = null;
  }

  setPlayerData(player) {
    this.playerData = player;
  }

  async joinLobby() {
    try {      this.lobbyRoom = await this.client.joinOrCreate('lobby', {
        playerId: this.playerData?.id,
        playerName: this.playerData?.name || 'Anonymous'
      });

      // Add message handler for room list updates
      this.lobbyRoom.onMessage('roomListUpdated', (data) => {
        console.log('Room list updated:', data);
        // This can be used to update the UI when rooms are created/destroyed
      });

      console.log('✅ Joined lobby room:', this.lobbyRoom.sessionId);
      return this.lobbyRoom;
    } catch (error) {
      console.error('❌ Failed to join lobby:', error);
      throw error;
    }
  }

  async createGameRoom(settings = {}) {
    try {      const defaultSettings = {
        maxPlayers: 4,
        gameMode: 'classic',
        isPrivate: false,
        hostId: String(this.playerData?.id),
        hostName: this.playerData?.name || 'Anonymous'
      };

      const gameSettings = { ...defaultSettings, ...settings };
      
      // First, create room record in database via API
      const createRoomData = {
        roomName: gameSettings.roomName || `${gameSettings.hostName}'s Game`,
        maxPlayers: gameSettings.maxPlayers,
        isPrivate: gameSettings.isPrivate,
        gameMode: gameSettings.gameMode,
        settings: gameSettings
      };
        // Add password if it's a private room
      if (gameSettings.isPrivate && gameSettings.password) {
        createRoomData.password = gameSettings.password;
      }
      
      // Use the roomAPI from the new API service
      const roomData = await roomAPI.create(createRoomData);
        // Create Colyseus room with database room ID
      const colyseusOptions = {
        dbRoomId: roomData.roomId,
        roomName: gameSettings.roomName || `${gameSettings.hostName}'s Game`,
        maxPlayers: gameSettings.maxPlayers,
        gameMode: gameSettings.gameMode,
        maxRounds: gameSettings.maxRounds || 10,
        isPublic: !gameSettings.isPrivate,
        hostId: String(this.playerData?.id),
        playerId: this.playerData?.id,
        playerName: this.playerData?.name || 'Anonymous',
        avatar: this.playerData?.avatar,
        elo: this.playerData?.elo || 1000
      };
      
      // Add password for verification during join (for the host)
      if (gameSettings.isPrivate && gameSettings.password) {
        colyseusOptions.password = gameSettings.password;
      }      this.currentRoom = await this.client.create('wizard_game', colyseusOptions);
      
      // Wait for initial state to be received before considering room ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Room creation timeout'));
        }, 10000); // 10 second timeout
        
        const initialStateHandler = () => {
          clearTimeout(timeout);
          this.currentRoom.onStateChange.remove(initialStateHandler);
          resolve();
        };
        this.currentRoom.onStateChange(initialStateHandler);
        
        // Also listen for any immediate errors
        const errorHandler = (code, message) => {
          clearTimeout(timeout);
          this.currentRoom.onError.remove(errorHandler);
          reject(new Error(`Room creation failed: ${message}`));
        };
        this.currentRoom.onError(errorHandler);
      });
      
      console.log('✅ Created game room:', this.currentRoom.sessionId, 'with DB ID:', roomData.roomId);
      return this.currentRoom;
    } catch (error) {
      console.error('❌ Failed to create game room:', error);
      throw error;
    }
  }  async joinGameRoom(roomId, password = null) {
    try {
      // First check if roomId is a database ID or Colyseus room ID
      let colyseusRoomId = roomId;
      let dbRoomId = null;
      
      // If it looks like a database UUID, fetch the Colyseus room ID
      if (roomId.length === 36 && roomId.includes('-')) {
        try {
          const roomData = await roomAPI.getById(roomId);
          colyseusRoomId = roomData.colyseusRoomId || roomData.colyseus_room_id;
          dbRoomId = roomId;
          
          if (!colyseusRoomId) {
            throw new Error('Room not available for joining');
          }
        } catch {
          throw new Error('Room not found in database');
        }
      }
      
      const joinOptions = {
        playerId: this.playerData?.id,
        playerName: this.playerData?.name || 'Anonymous',
        avatar: this.playerData?.avatar,
        elo: this.playerData?.elo || 1000
      };

      // Add password if provided
      if (password) {
        joinOptions.password = password;
      }

      try {
        this.currentRoom = await this.client.joinById(colyseusRoomId, joinOptions);
        console.log('✅ Joined game room:', this.currentRoom.sessionId);
        return this.currentRoom;
      } catch (colyseusError) {
        // Check if it's a "room not found" error from Colyseus
        if (colyseusError.message && colyseusError.message.includes('not found')) {
          // The room no longer exists on the Colyseus server
          console.warn(`⚠️ Room ${colyseusRoomId} no longer exists on server`);
          
          // If we have the database room ID, we could potentially clean it up
          if (dbRoomId) {
            console.log(`🧹 Room ${dbRoomId} should be cleaned up from database`);
            throw new Error('This game room is no longer available. Please refresh the room list.');
          } else {
            throw new Error('Game room no longer exists. Please try a different room.');
          }
        }
        
        // Re-throw other Colyseus errors
        throw colyseusError;
      }
    } catch (error) {
      console.error('❌ Failed to join game room:', error);
      throw error;
    }
  }

  async quickJoinGame() {
    try {
      this.currentRoom = await this.client.join('wizard_game', {
        playerId: this.playerData?.id,
        playerName: this.playerData?.name || 'Anonymous'
      });
      
      console.log('✅ Quick joined game room:', this.currentRoom.sessionId);
      return this.currentRoom;
    } catch (error) {
      console.error('❌ Failed to quick join game:', error);
      throw error;
    }
  }

  leaveCurrentRoom() {
    if (this.currentRoom) {
      this.currentRoom.leave();
      this.currentRoom = null;
      console.log('👋 Left current game room');
    }
  }

  leaveLobby() {
    if (this.lobbyRoom) {
      this.lobbyRoom.leave();
      this.lobbyRoom = null;
      console.log('👋 Left lobby');
    }
  }

  disconnect() {
    this.leaveCurrentRoom();
    this.leaveLobby();
    console.log('🔌 Disconnected from Colyseus');
  }

  // Helper methods for common room actions
  sendMessage(type, data = {}) {
    if (this.currentRoom) {
      this.currentRoom.send(type, data);
    }
  }

  sendLobbyMessage(type, data = {}) {
    if (this.lobbyRoom) {
      this.lobbyRoom.send(type, data);
    }
  }
  // Game-specific actions
  setPlayerReady(ready = true) {
    this.sendMessage('playerReady', { ready });
  }

  makeCall(call) {
    this.sendMessage('makeCall', { call });
  }

  makeTricks(tricks) {
    this.sendMessage('makeTricks', { tricks });
  }

  updateGameSettings(settings) {
    this.sendMessage('updateGameSettings', settings);
  }

  randomizePlayerOrder() {
    this.sendMessage('randomizePlayerOrder');
  }

  startGame() {
    this.sendMessage('startGame');
  }

  // Lobby-specific actions
  refreshRooms() {
    this.sendLobbyMessage('refreshRooms');
  }

  createRoomFromLobby(settings) {
    this.sendLobbyMessage('createRoom', settings);
  }

  joinRoomFromLobby(roomId, password = null) {
    const data = { roomId };
    if (password) data.password = password;
    this.sendLobbyMessage('joinRoom', data);
  }

  updatePlayerStatus(status) {
    this.sendLobbyMessage('updatePlayerStatus', { status });
  }

  // Reconnection handling
  setLastRoomInfo(roomId, roomType = 'game') {
    localStorage.setItem('wizard_last_room', JSON.stringify({
      roomId,
      roomType,
      timestamp: Date.now()
    }));
  }

  getLastRoomInfo() {
    try {
      const stored = localStorage.getItem('wizard_last_room');
      if (!stored) return null;
      
      const roomInfo = JSON.parse(stored);
      // Only return if less than 1 hour old
      if (Date.now() - roomInfo.timestamp < 60 * 60 * 1000) {
        return roomInfo;
      }
      
      // Clean up old data
      localStorage.removeItem('wizard_last_room');
      return null;
    } catch (error) {
      console.error('Failed to get last room info:', error);
      return null;
    }
  }

  clearLastRoomInfo() {
    localStorage.removeItem('wizard_last_room');
  }

  async attemptReconnection() {
    const lastRoom = this.getLastRoomInfo();
    if (!lastRoom) return null;

    try {
      console.log('Attempting to reconnect to room:', lastRoom.roomId);
      
      if (lastRoom.roomType === 'game') {
        return await this.joinGameRoom(lastRoom.roomId);
      } else if (lastRoom.roomType === 'lobby') {
        return await this.joinLobby();
      }
    } catch (error) {
      console.error('Reconnection failed:', error);
      this.clearLastRoomInfo();
      throw error;
    }
    
    return null;
  }  // Enhanced room methods with reconnection tracking
  async createGameRoomWithTracking(settings = {}) {
    const room = await this.createGameRoom(settings);
    if (room) {
      this.setLastRoomInfo(room.sessionId, 'game');
      // Don't leave current room since we just created it and want to stay in it
      this.currentRoom = room;
    }
    return room;
  }

  async joinGameRoomWithTracking(roomId, password = null) {
    const room = await this.joinGameRoom(roomId, password);
    if (room) {
      this.setLastRoomInfo(room.sessionId, 'game');
    }
    return room;
  }
  async joinLobbyWithTracking() {
    const lobby = await this.joinLobby();
    if (lobby) {
      this.setLastRoomInfo(lobby.sessionId, 'lobby');
    }
    return lobby;
  }
}

// Create singleton instance
const colyseusService = new ColyseusService();

export default colyseusService;
