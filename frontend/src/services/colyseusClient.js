import { Client } from 'colyseus.js';
import { roomAPI } from './api.js';

class ColyseusService {
  constructor() {
    // Use development URL for now, can be configured for production
    const wsUrl = import.meta.env.MODE === 'production' 
      ? 'wss://wizard.jkrumboe.dev' 
      : 'ws://localhost:5000';
      
    this.client = new Client(wsUrl);
    this.currentRoom = null;
    this.lobbyRoom = null;
    this.playerData = null;
  }

  setPlayerData(player) {
    this.playerData = player;
  }

  async joinLobby() {
    try {
      this.lobbyRoom = await this.client.joinOrCreate('lobby', {
        playerId: this.playerData?.id,
        playerName: this.playerData?.name || 'Anonymous'
      });

      console.log('✅ Joined lobby room:', this.lobbyRoom.sessionId);
      return this.lobbyRoom;
    } catch (error) {
      console.error('❌ Failed to join lobby:', error);
      throw error;
    }
  }

  async createGameRoom(settings = {}) {
    try {
      const defaultSettings = {
        maxPlayers: 4,
        gameMode: 'classic',
        isPrivate: false,
        hostId: this.playerData?.id,
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
        hostId: this.playerData?.id,
        playerId: this.playerData?.id,
        playerName: this.playerData?.name || 'Anonymous',
        avatar: this.playerData?.avatar,
        elo: this.playerData?.elo || 1000
      };
      
      // Add password for verification during join (for the host)
      if (gameSettings.isPrivate && gameSettings.password) {
        colyseusOptions.password = gameSettings.password;
      }
      
      this.currentRoom = await this.client.create('wizard_game', colyseusOptions);
      
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
      
      // If it looks like a database UUID, fetch the Colyseus room ID
      if (roomId.length === 36 && roomId.includes('-')) {
        try {
          const roomData = await roomAPI.getById(roomId);
          colyseusRoomId = roomData.colyseusRoomId || roomData.colyseus_room_id;
          
          if (!colyseusRoomId) {
            throw new Error('Room not available for joining');
          }
        } catch {
          throw new Error('Room not found');
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

      this.currentRoom = await this.client.joinById(colyseusRoomId, joinOptions);
      
      console.log('✅ Joined game room:', this.currentRoom.sessionId);
      return this.currentRoom;
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
  }
  // Enhanced room methods with reconnection tracking
  async createGameRoomWithTracking(settings = {}) {
    const room = await this.createGameRoom(settings);
    if (room) {
      this.setLastRoomInfo(room.sessionId, 'game');
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
