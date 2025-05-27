import { Room } from 'colyseus';
import { MapSchema, Schema, type, ArraySchema } from '@colyseus/schema';
import dbAdapter from '../db/dbAdapter.js';

// Available room information for the lobby
export class RoomInfo extends Schema {
  constructor() {
    super();
  }
}

type("string")(RoomInfo.prototype, "roomId");
type("string")(RoomInfo.prototype, "roomName");
type("string")(RoomInfo.prototype, "hostName");
type("number")(RoomInfo.prototype, "currentPlayers");
type("number")(RoomInfo.prototype, "maxPlayers");
type("string")(RoomInfo.prototype, "mode");
type("number")(RoomInfo.prototype, "maxRounds");
type("boolean")(RoomInfo.prototype, "gameStarted");
type("boolean")(RoomInfo.prototype, "isPublic");
type("string")(RoomInfo.prototype, "createdAt");

// Player in lobby
export class LobbyPlayer extends Schema {
  constructor() {
    super();
  }
}

type("string")(LobbyPlayer.prototype, "sessionId");
type("number")(LobbyPlayer.prototype, "playerId");
type("string")(LobbyPlayer.prototype, "name");
type("string")(LobbyPlayer.prototype, "avatar");
type("number")(LobbyPlayer.prototype, "elo");
type("string")(LobbyPlayer.prototype, "status"); // "browsing", "in_game", "creating"

// Lobby state
export class LobbyState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.availableRooms = new MapSchema();
  }
}

type({ map: LobbyPlayer })(LobbyState.prototype, "players");
type({ map: RoomInfo })(LobbyState.prototype, "availableRooms");

export class LobbyRoom extends Room {
  maxClients = 1000; // Large number for lobby
  async onCreate(options) {
    console.log("LobbyRoom created!");
    
    this.setState(new LobbyState());
    
    // Set up message handlers
    this.onMessage("createRoom", (client, data) => {
      this.handleCreateRoom(client, data);
    });

    this.onMessage("joinRoom", (client, data) => {
      this.handleJoinRoom(client, data);
    });

    this.onMessage("refreshRooms", (client) => {
      this.refreshAvailableRooms();
    });

    this.onMessage("updatePlayerStatus", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && data.status) {
        player.status = data.status;
      }
    });

    // Periodic refresh of available rooms
    this.refreshInterval = setInterval(() => {
      this.refreshAvailableRooms();
    }, 5000); // Refresh every 5 seconds

    // Initialize available rooms
    await this.refreshAvailableRooms();
  }

  onJoin(client, options) {
    console.log(`Player ${client.sessionId} joined lobby`);
    
    // Create lobby player
    const player = new LobbyPlayer();
    player.sessionId = client.sessionId;
    player.playerId = options.playerId;
    player.name = options.playerName;
    player.avatar = options.avatar || '';
    player.elo = options.elo || 1000;
    player.status = "browsing";

    this.state.players.set(client.sessionId, player);

    // Send current lobby state
    client.send("lobbyJoined", {
      totalPlayers: this.state.players.size,
      availableRooms: Array.from(this.state.availableRooms.values())
    });
  }

  onLeave(client, consented) {
    console.log(`Player ${client.sessionId} left lobby`);
    this.state.players.delete(client.sessionId);
  }

  async handleCreateRoom(client, data) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    try {
      // Update player status
      player.status = "creating";

      // Create new game room
      const gameRoom = await this.presence.create("wizard_game", {
        maxRounds: data.maxRounds || 10,
        mode: data.mode || "Ranked",
        isPublic: data.isPublic !== false,
        maxPlayers: data.maxPlayers || 6,
        roomName: data.roomName || `${player.name}'s Game`,
        hostId: client.sessionId,
        hostName: player.name
      });

      // Send room details to client
      client.send("roomCreated", {
        roomId: gameRoom.roomId,
        roomName: data.roomName || `${player.name}'s Game`
      });

      // Update player status
      player.status = "in_game";

      // Refresh room list
      setTimeout(() => this.refreshAvailableRooms(), 1000);

    } catch (error) {
      console.error("Error creating room:", error);
      client.send("error", { message: "Failed to create room" });
      player.status = "browsing";
    }
  }

  async handleJoinRoom(client, data) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    try {
      // Update player status
      player.status = "in_game";

      // Send join confirmation
      client.send("roomJoined", {
        roomId: data.roomId,
        playerInfo: {
          playerId: player.playerId,
          playerName: player.name,
          avatar: player.avatar,
          elo: player.elo
        }
      });

    } catch (error) {
      console.error("Error joining room:", error);
      client.send("error", { message: "Failed to join room" });
      player.status = "browsing";
    }
  }
  async refreshAvailableRooms() {
    try {
      // Clear current room list
      this.state.availableRooms.clear();

      // Get active rooms from database
      const dbRooms = await dbAdapter.getActiveRooms();
      
      for (const room of dbRooms) {
        if (!room.is_private) {
          const roomInfo = new RoomInfo();
          roomInfo.roomId = room.room_id;
          roomInfo.roomName = room.room_name;
          roomInfo.hostName = room.host_name || "Unknown";
          roomInfo.currentPlayers = room.current_players;
          roomInfo.maxPlayers = room.max_players;
          roomInfo.mode = room.game_mode || "ranked";
          roomInfo.maxRounds = 10; // Default, could be stored in settings
          roomInfo.gameStarted = false; // Based on room status
          roomInfo.isPublic = !room.is_private;
          roomInfo.createdAt = new Date().toISOString();

          this.state.availableRooms.set(room.room_id, roomInfo);
        }
      }

      // Also get current Colyseus rooms for real-time data
      try {
        const colyseusRooms = await this.presence.getRoomListings("wizard_game");
        
        for (const room of colyseusRooms) {
          if (room.metadata && room.metadata.isPublic) {
            const existingRoom = this.state.availableRooms.get(room.roomId);
            if (existingRoom) {
              // Update with real-time data
              existingRoom.currentPlayers = room.clients;
              existingRoom.gameStarted = room.metadata.gameStarted || false;
            } else {
              // Room not in database, add it
              const roomInfo = new RoomInfo();
              roomInfo.roomId = room.roomId;
              roomInfo.roomName = room.metadata.roomName || `Game ${room.roomId.slice(0, 6)}`;
              roomInfo.hostName = room.metadata.hostName || "Unknown";
              roomInfo.currentPlayers = room.clients;
              roomInfo.maxPlayers = room.metadata.maxPlayers || 6;
              roomInfo.mode = room.metadata.mode || "Ranked";
              roomInfo.maxRounds = room.metadata.maxRounds || 10;
              roomInfo.gameStarted = room.metadata.gameStarted || false;
              roomInfo.isPublic = room.metadata.isPublic !== false;
              roomInfo.createdAt = room.metadata.createdAt || new Date().toISOString();

              this.state.availableRooms.set(room.roomId, roomInfo);
            }
          }
        }
      } catch (colyseusError) {
        console.error('Error getting Colyseus room listings:', colyseusError);
      }

      // Broadcast room list update to all clients
      this.broadcast("roomListUpdated", {
        rooms: Array.from(this.state.availableRooms.values())
      });

    } catch (error) {
      console.error("Error refreshing rooms:", error);
    }
  }

  onDispose() {
    console.log("LobbyRoom disposed");
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}
