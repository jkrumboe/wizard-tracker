import { Room } from 'colyseus';
import { MapSchema, Schema, type, ArraySchema } from '@colyseus/schema';
import dbAdapter from '../db/dbAdapter.js';

// Player schema for the room state
export class Player extends Schema {
  constructor() {
    super();
  }
}

type("string")(Player.prototype, "sessionId");
type("number")(Player.prototype, "playerId");
type("string")(Player.prototype, "name");
type("string")(Player.prototype, "avatar");
type("number")(Player.prototype, "elo");
type("boolean")(Player.prototype, "isReady");
type("boolean")(Player.prototype, "isHost");

// Round data for the game
export class RoundData extends Schema {
  constructor() {
    super();
  }
}

type("number")(RoundData.prototype, "round");
type("number")(RoundData.prototype, "cards");
type([Player])(RoundData.prototype, "players");

// Current game state
export class GameState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.rounds = new ArraySchema();
    this.gameStarted = false;
    this.gameFinished = false;
    this.currentRound = 1;
    this.maxRounds = 10;
    this.mode = "Ranked";
    this.hostId = null;
    this.isPublic = true;
    this.maxPlayers = 6;
  }
}

type({ map: Player })(GameState.prototype, "players");
type([RoundData])(GameState.prototype, "rounds");
type("boolean")(GameState.prototype, "gameStarted");
type("boolean")(GameState.prototype, "gameFinished");
type("number")(GameState.prototype, "currentRound");
type("number")(GameState.prototype, "maxRounds");
type("string")(GameState.prototype, "mode");
type("string")(GameState.prototype, "hostId");
type("boolean")(GameState.prototype, "isPublic");
type("number")(GameState.prototype, "maxPlayers");
type("string")(GameState.prototype, "roomName");

export class WizardGameRoom extends Room {
  maxClients = 6;
  async onCreate(options) {
    console.log("WizardGameRoom created!", options);
    
    this.setState(new GameState());
    this.dbRoomId = options.dbRoomId || null;
    this.dbGameId = null;
    
    // Initialize room settings from options
    this.state.maxRounds = options.maxRounds || 10;
    this.state.mode = options.gameMode || options.mode || "classic";
    this.state.isPublic = options.isPublic !== false;
    this.state.maxPlayers = options.maxPlayers || 4;
    this.state.roomName = options.roomName || `Game ${this.roomId.slice(0, 6)}`;
    this.state.hostId = options.hostId || null;
    
    // Update maxClients based on maxPlayers
    this.maxClients = this.state.maxPlayers;
    
    // Update existing database room with Colyseus room ID if dbRoomId provided
    if (this.dbRoomId) {
      try {
        await dbAdapter.pool.query(
          'UPDATE game_rooms SET colyseus_room_id = $1, status = $2 WHERE id = $3',
          [this.roomId, 'waiting', this.dbRoomId]
        );
        console.log(`✅ Updated database room ${this.dbRoomId} with Colyseus ID: ${this.roomId}`);
      } catch (error) {
        console.error('❌ Failed to update room in database:', error);
      }    } else {
      // Fallback: create new room in database if no dbRoomId provided
      try {
        // Use the numeric playerId as hostPlayerId, not the string hostId
        const hostPlayerId = options.playerId || null;
        
        const roomData = await dbAdapter.createRoom({
          colyseusRoomId: this.roomId,
          roomName: this.state.roomName,
          hostPlayerId: hostPlayerId,
          maxPlayers: this.state.maxPlayers,
          isPrivate: !this.state.isPublic,
          gameMode: this.state.mode.toLowerCase(),
          settings: {
            maxRounds: this.state.maxRounds,
            mode: this.state.mode
          }
        });
        
        this.dbRoomId = roomData.id;
        console.log(`✅ Created new room in database with ID: ${this.dbRoomId}`);
      } catch (error) {
        console.error('❌ Failed to create room in database:', error);
      }
    }

    // Set up message handlers
    this.onMessage("playerReady", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.isReady = data.ready;
        
        // Check if all players are ready to start
        const allReady = Array.from(this.state.players.values()).every(p => p.isReady);
        const enoughPlayers = this.state.players.size >= 2;
        
        if (allReady && enoughPlayers && !this.state.gameStarted) {
          this.startGame();
        }
      }
    });

    this.onMessage("makeCall", (client, data) => {
      this.handlePlayerCall(client.sessionId, data.call);
    });

    this.onMessage("makeTricks", (client, data) => {
      this.handlePlayerTricks(client.sessionId, data.tricks);
    });

    this.onMessage("nextRound", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.isHost) {
        this.nextRound();
      }
    });

    this.onMessage("updateGameSettings", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.isHost && !this.state.gameStarted) {
        if (data.maxRounds) this.state.maxRounds = data.maxRounds;
        if (data.mode) this.state.mode = data.mode;
        if (data.maxPlayers) {
          this.state.maxPlayers = data.maxPlayers;
          this.maxClients = data.maxPlayers;
        }
        if (data.roomName) this.state.roomName = data.roomName;
      }
    });

    // Auto-dispose room if empty for 10 minutes
    this.autoDispose = false;
    this.emptyRoomTimeout = setTimeout(() => {
      if (this.state.players.size === 0) {
        this.disconnect();
      }
    }, 10 * 60 * 1000);
  }  async onJoin(client, options) {
    console.log(`Player ${client.sessionId} attempting to join room ${this.roomId}`);
    
    // If this is a private room, verify password
    if (this.dbRoomId && options.password !== undefined) {
      try {
        const result = await dbAdapter.pool.query(
          'SELECT password_hash, is_private FROM game_rooms WHERE id = $1',
          [this.dbRoomId]
        );
        
        if (result.rows.length > 0) {
          const room = result.rows[0];
          if (room.is_private && room.password_hash) {
            if (!options.password) {
              throw new Error('Password required for private room');
            }
            
            const bcrypt = await import('bcrypt');
            const isValid = await bcrypt.default.compare(options.password, room.password_hash);
            if (!isValid) {
              throw new Error('Invalid password');
            }
          }
        }
      } catch (error) {
        console.error('Password verification failed:', error);
        throw new Error('Authentication failed');
      }
    }
    
    // Create player object
    const player = new Player();
    player.sessionId = client.sessionId;
    player.playerId = options.playerId;
    player.name = options.playerName;
    player.avatar = options.avatar || '';
    player.elo = options.elo || 1000;
    player.isReady = false;
    
    // Set host if first player
    if (this.state.players.size === 0) {
      player.isHost = true;
      this.state.hostId = client.sessionId;
    } else {
      player.isHost = false;
    }

    this.state.players.set(client.sessionId, player);

    // Add player to database room
    if (this.dbRoomId && options.playerId) {
      try {
        await dbAdapter.addPlayerToRoom(
          this.dbRoomId, 
          options.playerId, 
          player.isHost,
          this.state.players.size - 1
        );
        
        // Update room participant count
        await dbAdapter.updateRoomStatus(this.roomId, 'waiting', {
          currentPlayers: this.state.players.size
        });
        
        // Mark player as online
        await dbAdapter.markPlayerOnline(options.playerId, true);
        
        console.log(`✅ Player ${options.playerId} added to database room`);
      } catch (error) {
        console.error('❌ Failed to add player to database room:', error);
      }
    }

    // Clear auto-dispose timeout
    if (this.emptyRoomTimeout) {
      clearTimeout(this.emptyRoomTimeout);
      this.emptyRoomTimeout = null;
    }

    // Send welcome message
    client.send("welcome", {
      roomId: this.roomId,
      roomName: this.state.roomName,
      isHost: player.isHost
    });
  }

  async onLeave(client, consented) {
    console.log(`Player ${client.sessionId} left room ${this.roomId}`);
    
    const leavingPlayer = this.state.players.get(client.sessionId);
    
    // Update database before removing from state
    if (this.dbRoomId && leavingPlayer?.playerId) {
      try {
        await dbAdapter.playerLeftRoom(this.dbRoomId, leavingPlayer.playerId);
        
        // Update room participant count
        await dbAdapter.updateRoomStatus(this.roomId, 'waiting', {
          currentPlayers: this.state.players.size - 1
        });
        
        console.log(`✅ Player ${leavingPlayer.playerId} marked as left in database`);
      } catch (error) {
        console.error('❌ Failed to update player leave in database:', error);
      }
    }
    
    // Remove player from state
    this.state.players.delete(client.sessionId);

    // Transfer host if needed
    if (leavingPlayer && leavingPlayer.isHost && this.state.players.size > 0) {
      const newHost = Array.from(this.state.players.values())[0];
      newHost.isHost = true;
      this.state.hostId = newHost.sessionId;
      
      // Notify all clients of new host
      this.broadcast("hostChanged", { newHostId: newHost.sessionId });
    }

    // Set auto-dispose timeout if room becomes empty
    if (this.state.players.size === 0) {
      this.emptyRoomTimeout = setTimeout(() => {
        this.disconnect();
      }, 10 * 60 * 1000);
    }
  }
  async startGame() {
    if (this.state.gameStarted) return;
    
    console.log(`Starting game in room ${this.roomId}`);
    this.state.gameStarted = true;
    
    // Create game record in database
    if (this.dbRoomId) {
      try {
        const gameData = await dbAdapter.createGame(
          this.dbRoomId, 
          this.state.mode.toLowerCase(), 
          this.state.maxRounds
        );
        
        this.dbGameId = gameData.id;
        
        // Add all current players as game participants
        for (const player of this.state.players.values()) {
          if (player.playerId) {
            await dbAdapter.addGameParticipant(this.dbGameId, player.playerId);
          }
        }
        
        // Update room status to in_progress
        await dbAdapter.updateRoomStatus(this.roomId, 'in_progress', {
          startedAt: new Date()
        });
        
        console.log(`✅ Game created in database with ID: ${this.dbGameId}`);
      } catch (error) {
        console.error('❌ Failed to create game in database:', error);
      }
    }
    
    // Initialize rounds
    this.initializeRounds();
    
    // Broadcast game started
    this.broadcast("gameStarted", {
      maxRounds: this.state.maxRounds,
      mode: this.state.mode
    });
  }

  initializeRounds() {
    this.state.rounds.clear();
    
    for (let i = 1; i <= this.state.maxRounds; i++) {
      const round = new RoundData();
      round.round = i;
      round.cards = i <= 10 ? i : 20 - i;
      round.players = new ArraySchema();
      
      // Initialize players for this round
      this.state.players.forEach((player) => {
        const roundPlayer = new Player();
        roundPlayer.sessionId = player.sessionId;
        roundPlayer.playerId = player.playerId;
        roundPlayer.name = player.name;
        roundPlayer.avatar = player.avatar;
        // Add game-specific properties
        roundPlayer.call = null;
        roundPlayer.made = null;
        roundPlayer.score = 0;
        roundPlayer.totalScore = 0;
        
        round.players.push(roundPlayer);
      });
      
      this.state.rounds.push(round);
    }
  }

  handlePlayerCall(sessionId, call) {
    if (!this.state.gameStarted || this.state.gameFinished) return;
    
    const currentRound = this.state.rounds[this.state.currentRound - 1];
    if (!currentRound) return;
    
    const player = currentRound.players.find(p => p.sessionId === sessionId);
    if (player) {
      player.call = Math.max(0, Math.min(call, currentRound.cards));
    }
  }

  handlePlayerTricks(sessionId, tricks) {
    if (!this.state.gameStarted || this.state.gameFinished) return;
    
    const currentRound = this.state.rounds[this.state.currentRound - 1];
    if (!currentRound) return;
    
    const player = currentRound.players.find(p => p.sessionId === sessionId);
    if (player && player.call !== null) {
      player.made = Math.max(0, Math.min(tricks, currentRound.cards));
      
      // Calculate score
      if (player.call === player.made) {
        player.score = 20 + player.made * 10;
      } else {
        player.score = -10 * Math.abs(player.call - player.made);
      }
      
      // Calculate total score
      let totalScore = 0;
      for (let i = 0; i < this.state.currentRound; i++) {
        const roundPlayer = this.state.rounds[i].players.find(p => p.sessionId === sessionId);
        if (roundPlayer) {
          totalScore += roundPlayer.score;
        }
      }
      player.totalScore = totalScore;
    }
  }

  nextRound() {
    if (this.state.currentRound < this.state.maxRounds) {
      this.state.currentRound++;
      this.broadcast("roundChanged", { newRound: this.state.currentRound });
    } else {
      this.finishGame();
    }
  }

  async finishGame() {
    this.state.gameFinished = true;
    
    // Calculate final results
    const finalRound = this.state.rounds[this.state.maxRounds - 1];
    const results = finalRound.players.map(player => ({
      playerId: player.playerId,
      name: player.name,
      totalScore: player.totalScore
    })).sort((a, b) => b.totalScore - a.totalScore);
    
    // Broadcast game finished
    this.broadcast("gameFinished", { results });
    
    // TODO: Save game to database
    // This would integrate with your existing game saving logic
    
    console.log(`Game finished in room ${this.roomId}`, results);
  }

  onDispose() {
    console.log(`WizardGameRoom ${this.roomId} disposed`);
    if (this.emptyRoomTimeout) {
      clearTimeout(this.emptyRoomTimeout);
    }
  }
}
