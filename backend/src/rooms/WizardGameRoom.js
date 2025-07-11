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
type("number")(Player.prototype, "call");
type("number")(Player.prototype, "made");
type("number")(Player.prototype, "score");
type("number")(Player.prototype, "totalScore");

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
    this.phase = "waiting";
    this.playerOrder = new ArraySchema();
    this.dealerIndex = 0;
    this.currentCallIndex = 0;
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
type("string")(GameState.prototype, "phase");
type(["string"])(GameState.prototype, "playerOrder");
type("number")(GameState.prototype, "dealerIndex");
type("number")(GameState.prototype, "currentCallIndex");

export class WizardGameRoom extends Room {
  maxClients = 6;
  async onCreate(options) {
    console.debug("WizardGameRoom created!", options);
    
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
    
    // Set room metadata for discovery
    this.setMetadata({
      roomName: this.state.roomName,
      hostName: options.hostName || "Unknown",
      maxPlayers: this.state.maxPlayers,
      currentPlayers: 0,
      mode: this.state.mode,
      maxRounds: this.state.maxRounds,
      gameStarted: false,
      isPublic: this.state.isPublic,
      createdAt: new Date().toISOString()
    });
    
    // Set room as private if needed (this affects matchMaker.query results)
    if (!this.state.isPublic) {
      this.setPrivate(true);
    }
    
    // Update existing database room with Colyseus room ID if dbRoomId provided
    if (this.dbRoomId) {
      try {
        await dbAdapter.pool.query(
          'UPDATE game_rooms SET colyseus_room_id = $1, status = $2 WHERE id = $3',
          [this.roomId, 'waiting', this.dbRoomId]
        );
        console.debug(`✅ Updated database room ${this.dbRoomId} with Colyseus ID: ${this.roomId}`);
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
        console.debug(`✅ Created new room in database with ID: ${this.dbRoomId}`);
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
      console.debug(`!!!Player ${client.sessionId} made tricks:`, data.call, "ID:", data.playerId, "Bypass:", data.bypassTurnOrder);
      // console.debug("Client", client)
      this.handlePlayerCall(client.sessionId, data.call, data.playerId, data.bypassTurnOrder);
    });
    
    this.onMessage("makeTricks", (client, data) => {
      console.debug(`!!!Player ${client.sessionId} made tricks:`, data.tricks, "ID:", data.playerId, "Bypass:", data.bypassTurnOrder);
      this.handlePlayerTricks(client.sessionId, data.tricks, data.playerId, data.bypassTurnOrder);
    });

    this.onMessage("randomizePlayerOrder", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.isHost && !this.state.gameStarted) {
        this.randomizePlayerOrder();
      }
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
  }
  
  async onJoin(client, options) {
    console.debug(`Player ${client.sessionId} attempting to join room ${this.roomId}`);
    
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

    // Update room metadata with current player count
    this.setMetadata({
      ...this.metadata,
      currentPlayers: this.state.players.size
    });

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
        
        console.debug(`✅ Player ${options.playerId} added to database room`);
      } catch (error) {
        console.error('❌ Failed to add player to database room:', error);
      }
    }

    // Clear auto-dispose timeout
    if (this.emptyRoomTimeout) {
      clearTimeout(this.emptyRoomTimeout);
      this.emptyRoomTimeout = null;
    }    // Send welcome message
    client.send("welcome", {
      roomId: this.roomId,
      roomName: this.state.roomName,
      isHost: player.isHost
    });

    // Broadcast to other players that someone joined
    this.broadcast("playerJoined", {
      playerId: player.playerId,
      playerName: player.name,
      sessionId: client.sessionId
    }, { except: client });
  }

  async onLeave(client, consented) {
    console.debug(`Player ${client.sessionId} left room ${this.roomId}`);
    
    const leavingPlayer = this.state.players.get(client.sessionId);
    
    // Update database before removing from state
    if (this.dbRoomId && leavingPlayer?.playerId) {
      try {
        await dbAdapter.playerLeftRoom(this.dbRoomId, leavingPlayer.playerId);
        
        // Update room participant count
        await dbAdapter.updateRoomStatus(this.roomId, 'waiting', {
          currentPlayers: this.state.players.size - 1
        });
        
        console.debug(`✅ Player ${leavingPlayer.playerId} marked as left in database`);
      } catch (error) {
        console.error('❌ Failed to update player leave in database:', error);
      }
    }      // Remove player from state
    this.state.players.delete(client.sessionId);

    // Update room metadata with current player count
    this.setMetadata({
      ...this.metadata,
      currentPlayers: this.state.players.size
    });

    // Broadcast to remaining players that someone left
    if (leavingPlayer) {
      this.broadcast("playerLeft", {
        playerId: leavingPlayer.playerId,
        playerName: leavingPlayer.name,
        sessionId: client.sessionId
      });
    }

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
      }, 5 * 60 * 1000); // 5 mins
    }
  }
  
  async startGame() {
    if (this.state.gameStarted) return;
    console.debug(`Starting game in room ${this.roomId}`);
    this.state.gameStarted = true;
    this.state.phase = "calling";
    
    // Initialize player order if not already set
    if (this.state.playerOrder.length === 0) {
      this.state.playerOrder.clear();
      Array.from(this.state.players.keys()).forEach(sessionId => {
        this.state.playerOrder.push(sessionId);
      });
    }
    
    // Set dealer index and current call index
    this.state.dealerIndex = 0;
    this.state.currentCallIndex = (this.state.dealerIndex + 1) % this.state.playerOrder.length;
    
    // Update room metadata to reflect game started
    this.setMetadata({
      ...this.metadata,
      gameStarted: true
    });
    
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
        
        console.debug(`✅ Game created in database with ID: ${this.dbGameId}`);
      } catch (error) {
        console.error('❌ Failed to create game in database:', error);
      }
    }
    
    // Initialize rounds
    this.initializeRounds();
    
    // Broadcast game started
    this.broadcast("gameStarted", {
      maxRounds: this.state.maxRounds,
      mode: this.state.mode,
      phase: this.state.phase,
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

  handlePlayerCall(sessionId, call, playerId, bypassTurnOrder = false) {
    if (!this.state.gameStarted || this.state.gameFinished || this.state.phase !== "calling") return;
    
    // Check if it's a host player (who can call for any player)
    const requestingPlayer = this.state.players.get(sessionId);
    const isHost = requestingPlayer && requestingPlayer.isHost;
    
    // Check if it's this player's turn to call (unless host with bypass flag)
    const currentPlayerSessionId = this.state.playerOrder[this.state.currentCallIndex];
    if (!bypassTurnOrder && !isHost && sessionId !== currentPlayerSessionId) {
      console.debug(`Player ${sessionId} tried to call out of turn. Current turn: ${currentPlayerSessionId}`);
      return;
    }
    
    const currentRound = this.state.rounds[this.state.currentRound - 1];
    if (!currentRound) return;
      // Find the player whose call is being made
    // If host is making a call for someone else, use the provided playerId
    let player;
    if (playerId && playerId !== requestingPlayer.playerId) {
      // Host is making a call for another player
      player = currentRound.players.find(p => p.playerId == playerId);    } else {
      // Player is making their own call
      player = currentRound.players.find(p => p.sessionId === sessionId);
    }
    
    if (!player) {
      console.debug(`Could not find player with playerId ${playerId} or sessionId ${sessionId} in the current round`);
      return;
    }
    
    // Player found, proceed with call
    player.call = Math.max(0, Math.min(call, currentRound.round));
      
    // Update the player's state in the main players collection too
    // This ensures all clients see the call value
    const mainPlayerState = this.state.players.get(player.sessionId);
      if (mainPlayerState) {
        mainPlayerState.call = player.call;
        
        // Broadcast the call update to all clients
        this.broadcast('callUpdated', {
          playerId: player.playerId,
          sessionId: player.sessionId,
          call: player.call
        });
      }
      
      // Only advance turn if this was the current player's turn
      if (sessionId === currentPlayerSessionId) {
        // Move to next player's turn
        this.state.currentCallIndex = (this.state.currentCallIndex + 1) % this.state.playerOrder.length;
      }
      
      // Check if all players have made their calls
      const allPlayersCalled = currentRound.players.every(p => p.call !== null);
      if (allPlayersCalled) {
        this.state.phase = "playing";
        this.state.currentCallIndex = 0; // Reset for potential future use
        this.broadcast("phaseChanged", { phase: "playing" });
      }
    }
  

  handlePlayerTricks(sessionId, tricks, playerId, bypassTurnOrder = false) {
    if (!this.state.gameStarted || this.state.gameFinished) return;
    
    // Check if it's a host player (who can enter tricks for any player)
    const requestingPlayer = this.state.players.get(sessionId);
    const isHost = requestingPlayer && requestingPlayer.isHost;
    
    // Only allow hosts to enter tricks for other players
    if (!isHost && playerId && playerId !== requestingPlayer.playerId) {
      console.debug(`Player ${sessionId} tried to enter tricks for another player without host permissions`);
      return;
    }
    
    const currentRound = this.state.rounds[this.state.currentRound - 1];
    if (!currentRound) return;
    
    // Find the player whose tricks are being recorded
    let player;
    if (playerId && isHost) {
      // Host is entering tricks for a specific player
      player = currentRound.players.find(p => p.playerId == playerId);    } else {
      // Player is entering their own tricks
      player = currentRound.players.find(p => p.sessionId === sessionId);
    }
    
    if (!player) {
      console.debug(`Could not find player with playerId ${playerId} or sessionId ${sessionId} in the current round for tricks`);
      return;
    }
      
    if (player.call !== null) {
      player.made = Math.max(0, Math.min(tricks, currentRound.round));
      
      // Update the player's state in the main players collection too
      // This ensures all clients see the made/tricks value
      const mainPlayerState = this.state.players.get(player.sessionId);
      if (mainPlayerState) {
        mainPlayerState.made = player.made;
        // For legacy frontend compatibility
        mainPlayerState.tricks = player.made;
        
        // Broadcast the tricks update to all clients
        this.broadcast('tricksUpdated', {
          playerId: player.playerId,
          sessionId: player.sessionId,
          made: player.made
        });
      }
      
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
      this.state.phase = "calling";
      
      // Rotate dealer for next round
      this.state.dealerIndex = (this.state.dealerIndex + 1) % this.state.playerOrder.length;
      
      // Set current call index to the player after the dealer
      this.state.currentCallIndex = (this.state.dealerIndex + 1) % this.state.playerOrder.length;
      
      this.broadcast("roundChanged", { newRound: this.state.currentRound });
    } else {
      this.finishGame();
    }
  }

  randomizePlayerOrder() {
    if (this.state.gameStarted) return;
    
    // Convert players to array and shuffle
    const playerSessionIds = Array.from(this.state.players.keys());
    for (let i = playerSessionIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playerSessionIds[i], playerSessionIds[j]] = [playerSessionIds[j], playerSessionIds[i]];
    }
    
    // Update player order
    this.state.playerOrder.clear();
    playerSessionIds.forEach(sessionId => {
      this.state.playerOrder.push(sessionId);
    });
    
    // Reset dealer index
    this.state.dealerIndex = 0;
    
    this.broadcast("playerOrderRandomized", { 
      playerOrder: Array.from(this.state.playerOrder),
      dealerIndex: this.state.dealerIndex
    });
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
    
    console.debug(`Game finished in room ${this.roomId}`, results);
  }

  onDispose() {
    console.debug(`WizardGameRoom ${this.roomId} disposed`);
    if (this.emptyRoomTimeout) {
      clearTimeout(this.emptyRoomTimeout);
    }
  }
}
