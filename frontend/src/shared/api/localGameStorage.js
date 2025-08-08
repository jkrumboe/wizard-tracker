/**
 * Local Game Storage Service
 * Handles saving, loading, and managing paused local games
 */

const LOCAL_GAMES_STORAGE_KEY = "wizardTracker_localGames";

export class LocalGameStorage {
  /**
   * Save a game to local storage using standardized game format
   * @param {Object} gameState - The current game state
   * @param {string} gameName - Optional custom name for the game
   * @param {boolean} isPaused - Whether this is a paused game (true) or a finished game (false)
   * @returns {string} - The game ID
   */
  static saveGame(gameState, gameName = null, isPaused = true) {
    // Check if this is a finished game that was previously paused
    let gameId = gameState.gameId;
    const isFinishedPausedGame = !isPaused && gameId && this.gameExists(gameId);
    
    // If it's not an update to an existing paused game, generate a new ID
    if (!isFinishedPausedGame) {
      gameId = this.generateGameId();
    }
    
    const timestamp = new Date().toISOString();
    
    try {
      // Create standardized game object following your proposed structure
      const standardizedGame = {
        id: gameId,
        name: gameName || (isPaused ? 
          `Paused Game - Round ${gameState.currentRound}/${gameState.maxRounds}` : 
          `Finished Game - ${new Date().toLocaleDateString()}`),
        mode: gameState.mode || "Local",
        status: isPaused ? "paused" : (gameState.gameFinished ? "completed" : "in-progress"),
        created_at: gameState.created_at || gameState.referenceDate || timestamp,
        updated_at: timestamp,
        players: gameState.players ? gameState.players.map(player => ({
          id: player.id,
          name: player.name,
          score: player.totalScore || 0,
          isHost: player.isHost || false
        })) : [],
        rounds: gameState.roundData ? gameState.roundData.map((round, index) => ({
          round: index + 1,
          bids: round.players.reduce((acc, player) => {
            acc[player.id] = player.call;
            return acc;
          }, {}),
          tricks: round.players.reduce((acc, player) => {
            acc[player.id] = player.made;
            return acc;
          }, {}),
          points: round.players.reduce((acc, player) => {
            acc[player.id] = player.score;
            return acc;
          }, {})
        })) : [],
        winner_id: gameState.winner_id || null,
        final_scores: gameState.final_scores || null,
        total_rounds: gameState.maxRounds || gameState.totalRounds || 0,
        last_played: timestamp,
        
        // Additional metadata for compatibility
        isPaused: isPaused,
        gameFinished: !isPaused,
        playerCount: gameState.players ? gameState.players.length : 0,
        roundsCompleted: gameState.currentRound ? gameState.currentRound - 1 : 0,
        
        // Legacy support - keep gameState for backward compatibility
        gameState: gameState
      };
    
      
      // Get existing storage
      const existingStored = localStorage.getItem(LOCAL_GAMES_STORAGE_KEY);
      
      if (!existingStored) {
        // No existing data, create new
        const newStorage = {};
        newStorage[gameId] = standardizedGame;
        localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(newStorage));
      } else {
        // Parse existing data
        const existingData = JSON.parse(existingStored);
        
        if (Array.isArray(existingData)) {
          
          // Create new object format
          const newStorage = {};
          
          // Add existing games (convert old format to new)
          existingData.forEach(game => {
            if (game.id) {
              newStorage[game.id] = this.convertLegacyGame(game);
            }
          });
          
          // Add new game
          newStorage[gameId] = standardizedGame;
          
          // Save back to storage
          localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(newStorage));
          
        } else {
          // It's already in object format
          // If this is a previously paused game that's now finished, remove the old entry if it has a different ID
          if (!isPaused && gameState.gameId && gameState.gameId !== gameId && existingData[gameState.gameId]) {
            delete existingData[gameState.gameId];
          }
          
          existingData[gameId] = standardizedGame;
          localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(existingData));
        }
      }

      return gameId;
    } catch (error) {
      console.error("Error saving game:", error);
      throw error;
    }
  }

  /**
   * Convert legacy game format to new standardized format
   * @param {Object} legacyGame - Game in old format
   * @returns {Object} - Game in new standardized format
   */
  static convertLegacyGame(legacyGame) {
    return {
      id: legacyGame.id,
      name: legacyGame.name || `Game from ${new Date(legacyGame.created_at || legacyGame.savedAt).toLocaleDateString()}`,
      mode: legacyGame.game_mode || legacyGame.mode || "Local",
      status: legacyGame.gameFinished ? "completed" : (legacyGame.isPaused ? "paused" : "in-progress"),
      created_at: legacyGame.created_at || legacyGame.savedAt || new Date().toISOString(),
      updated_at: legacyGame.lastPlayed || legacyGame.savedAt || new Date().toISOString(),
      players: legacyGame.players ? legacyGame.players.map(player => ({
        id: player.id,
        name: player.name,
        score: player.totalScore || 0,
        isHost: player.isHost || false
      })) : [],
      rounds: legacyGame.round_data ? legacyGame.round_data.map((round, index) => ({
        round: index + 1,
        bids: round.players ? round.players.reduce((acc, player) => {
          acc[player.id] = player.call;
          return acc;
        }, {}) : {},
        tricks: round.players ? round.players.reduce((acc, player) => {
          acc[player.id] = player.made;
          return acc;
        }, {}) : {},
        points: round.players ? round.players.reduce((acc, player) => {
          acc[player.id] = player.score;
          return acc;
        }, {}) : {}
      })) : [],
      winner_id: legacyGame.winner_id || null,
      final_scores: legacyGame.final_scores || null,
      total_rounds: legacyGame.total_rounds || legacyGame.totalRounds || 0,
      last_played: legacyGame.lastPlayed || legacyGame.savedAt || new Date().toISOString(),
      
      // Maintain compatibility metadata
      isPaused: legacyGame.isPaused || false,
      gameFinished: legacyGame.gameFinished || true,
      playerCount: legacyGame.players ? legacyGame.players.length : 0,
      roundsCompleted: legacyGame.roundsCompleted || (legacyGame.total_rounds - 1) || 0,
      
      // Keep gameState for backward compatibility
      gameState: legacyGame.gameState || {
        players: legacyGame.players,
        currentRound: legacyGame.round_data ? legacyGame.round_data.length : 1,
        maxRounds: legacyGame.total_rounds,
        roundData: legacyGame.round_data || [],
        gameStarted: true,
        gameFinished: legacyGame.gameFinished || true,
        mode: legacyGame.game_mode || "Local",
        isLocal: true
      }
    };
  }

  /**
   * Load a saved game and return the gameState for compatibility
   * @param {string} gameId - The game ID to load
   * @returns {Object|null} - The game state or null if not found
   */
  static loadGame(gameId) {
    const games = this.getAllSavedGames();
    const game = games[gameId];
    
    if (game) {
      // Update last played timestamp
      game.last_played = new Date().toISOString();
      game.updated_at = new Date().toISOString();
      games[gameId] = game;
      localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(games));
      
      // Return the gameState for backward compatibility
      return game.gameState;
    }
    
    return null;
  }

  /**
   * Delete a saved game
   * @param {string} gameId - The game ID to delete
   */
  static deleteGame(gameId) {
    const games = this.getAllSavedGames();
    delete games[gameId];
    localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(games));
  }

  /**
   * Get all saved games in standardized format
   * @returns {Object} - Object containing all saved games
   */
  static getAllSavedGames() {
    try {
      const stored = localStorage.getItem(LOCAL_GAMES_STORAGE_KEY);
      
      if (!stored) {
        return {};
      }
      
      const parsedData = JSON.parse(stored);
      
      // Convert array format (old) to object format with standardized structure
      if (Array.isArray(parsedData)) {
        const games = {};
        parsedData.forEach(game => {
          if (game.id) {
            games[game.id] = this.convertLegacyGame(game);
          }
        });
        
        // Save the converted format back to storage
        localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(games));
        return games;
      }
      
      // Already in object format, but may need to standardize individual games
      const games = {};
      Object.keys(parsedData).forEach(gameId => {
        const game = parsedData[gameId];
        
        // Check if this game follows the new standardized format
        if (game.status && game.created_at && game.updated_at && game.players && game.rounds) {
          // Already standardized
          games[gameId] = game;
        } else {
          // Convert to standardized format
          games[gameId] = this.convertLegacyGame(game);
        }
      });
      
      // Save the standardized format back to storage if any conversions were made
      if (JSON.stringify(games) !== JSON.stringify(parsedData)) {
        localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(games));
      }
      
      return games;
    } catch (error) {
      console.error("Error loading saved games:", error);
      return {};
    }
  }

  /**
   * Get saved games list with metadata in standardized format
   * @returns {Array} - Array of saved game metadata
   */
  static getSavedGamesList() {
    try {
      const games = this.getAllSavedGames(); // This now returns standardized format
      
      if (!games || Object.keys(games).length === 0) {
        return [];
      }
      
      const gamesList = Object.values(games)
        .filter(game => game && game.id)
        .map(game => ({
          id: game.id,
          name: game.name,
          mode: game.mode,
          status: game.status,
          created_at: game.created_at,
          updated_at: game.updated_at,
          last_played: game.last_played,
          playerCount: game.playerCount || game.players.length,
          roundsCompleted: game.roundsCompleted,
          totalRounds: game.total_rounds,
          players: game.players.map(p => p.name),
          isPaused: game.status === "paused",
          gameFinished: game.status === "completed",
          
          // Additional fields for compatibility
          winner_id: game.winner_id,
          final_scores: game.final_scores,
          player_ids: game.players.map(p => p.id),
          round_data: game.rounds, // Map to old format
          duration_seconds: game.gameState?.duration_seconds,
          is_local: true,
          game_mode: game.mode,
          gameState: game.gameState // For backward compatibility
        }));
      
      // Sort by last played date (most recent first)
      gamesList.sort((a, b) => new Date(b.last_played) - new Date(a.last_played));
      
      return gamesList;
    } catch (error) {
      console.error("Error getting saved games list:", error);
      return [];
    }
  }

  /**
   * Check if a game exists
   * @param {string} gameId - The game ID to check
   * @returns {boolean} - True if game exists
   */
  static gameExists(gameId) {
    const games = this.getAllSavedGames();
    return !!games[gameId];
  }

  /**
   * Get all games (alias for getAllSavedGames for compatibility)
   * @returns {Object} - Object containing all saved games
   */
  static getAllGames() {
    const games = this.getAllSavedGames();
    console.log('LocalGameStorage.getAllGames() called, returning:', games);
    console.log('Number of games found:', Object.keys(games).length);
    return games;
  }

  /**
   * Debug function to check localStorage directly
   * @returns {Object} - Raw localStorage content
   */
  static debugLocalStorage() {
    const rawData = localStorage.getItem(LOCAL_GAMES_STORAGE_KEY);
    console.log('Raw localStorage data for key "' + LOCAL_GAMES_STORAGE_KEY + '":', rawData);
    
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        console.log('Parsed localStorage data:', parsed);
        console.log('Type of parsed data:', Array.isArray(parsed) ? 'Array' : typeof parsed);
        return parsed;
      } catch (error) {
        console.error('Error parsing localStorage data:', error);
        return null;
      }
    }
    
    return null;
  }

  /**
   * Update a saved game's metadata
   * @param {string} gameId - The game ID
   * @param {Object} updates - Updates to apply
   */
  static updateGameMetadata(gameId, updates) {
    const games = this.getAllSavedGames();
    if (games[gameId]) {
      games[gameId] = { ...games[gameId], ...updates };
      localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(games));
    }
  }

  /**
   * Auto-save a game with a specific ID (for continuous saving) using standardized format
   * @param {Object} gameState - The current game state
   * @param {string} gameId - Existing game ID for auto-save
   */
  static autoSaveGame(gameState, gameId) {
    const games = this.getAllSavedGames();
    if (games[gameId]) {
      const timestamp = new Date().toISOString();
      
      // Update the existing standardized game
      games[gameId] = {
        ...games[gameId],
        updated_at: timestamp,
        last_played: timestamp,
        status: gameState.gameFinished ? "completed" : (gameState.isPaused ? "paused" : "in-progress"),
        players: gameState.players ? gameState.players.map(player => ({
          id: player.id,
          name: player.name,
          score: player.totalScore || 0,
          isHost: player.isHost || false
        })) : games[gameId].players,
        rounds: gameState.roundData ? gameState.roundData.map((round, index) => ({
          round: index + 1,
          bids: round.players.reduce((acc, player) => {
            acc[player.id] = player.call;
            return acc;
          }, {}),
          tricks: round.players.reduce((acc, player) => {
            acc[player.id] = player.made;
            return acc;
          }, {}),
          points: round.players.reduce((acc, player) => {
            acc[player.id] = player.score;
            return acc;
          }, {})
        })) : games[gameId].rounds,
        roundsCompleted: gameState.currentRound ? gameState.currentRound - 1 : games[gameId].roundsCompleted,
        
        // Update metadata for finished games
        winner_id: gameState.winner_id || games[gameId].winner_id,
        final_scores: gameState.final_scores || games[gameId].final_scores,
        
        // Update gameState for backward compatibility
        gameState: gameState
      };
      
      // If the game has transitioned from paused to finished, update status and name
      if (gameState.gameFinished && games[gameId].status === "paused") {
        games[gameId].status = "completed";
        games[gameId].name = `Finished Game - ${new Date().toLocaleDateString()}`;
      }
      
      localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(games));
    }
  }

  /**
   * Generate a unique game ID
   * @returns {string} - Unique game ID
   */
  static generateGameId() {
    return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export all saved games as JSON
   * @returns {string} - JSON string of all saved games
   */
  static exportGames() {
    return JSON.stringify(this.getAllSavedGames(), null, 2);
  }

  /**
   * Import saved games from JSON with conversion to standardized format
   * @param {string} jsonData - JSON string of saved games
   * @returns {boolean} - Success status
   */
  static importGames(jsonData) {
    try {
      const importedGames = JSON.parse(jsonData);
      const existingGames = this.getAllSavedGames();
      const importTimestamp = new Date().toISOString();
      
      // Process imported games and convert to standardized format
      const processedImportedGames = {};
      Object.keys(importedGames).forEach(gameId => {
        const game = importedGames[gameId];
        // Generate new game ID to avoid conflicts
        const newGameId = this.generateGameId();
        
        // Convert to standardized format if needed
        let standardizedGame;
        if (game.status && game.created_at && game.updated_at && game.players && game.rounds) {
          // Already in standardized format
          standardizedGame = { ...game };
        } else {
          // Convert legacy format
          standardizedGame = this.convertLegacyGame(game);
        }
        
        // Add import metadata
        processedImportedGames[newGameId] = {
          ...standardizedGame,
          id: newGameId,
          name: standardizedGame.name ? `${standardizedGame.name} (Imported)` : 'Imported Game',
          updated_at: importTimestamp,
          originalGameId: gameId,
          isImported: true,
          gameState: {
            ...standardizedGame.gameState,
            id: newGameId,
            gameId: newGameId
          }
        };
      });
      
      const mergedGames = { ...existingGames, ...processedImportedGames };
      localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(mergedGames));
      return true;
    } catch (error) {
      console.error("Error importing games:", error);
      return false;
    }
  }

  /**
   * Get games by status
   * @param {string} status - Game status: "paused", "completed", "in-progress"
   * @returns {Array} - Array of games with specified status
   */
  static getGamesByStatus(status) {
    const games = this.getAllSavedGames();
    return Object.values(games).filter(game => game.status === status);
  }

  /**
   * Get recent games with limit
   * @param {number} limit - Maximum number of games to return
   * @returns {Array} - Array of recent games
   */
  static getRecentGames(limit = 10) {
    const gamesList = this.getSavedGamesList();
    return gamesList.slice(0, limit);
  }

  /**
   * Get paused games only
   * @returns {Array} - Array of paused games
   */
  static getPausedGames() {
    return this.getGamesByStatus("paused");
  }

  /**
   * Get completed games only
   * @returns {Array} - Array of completed games
   */
  static getCompletedGames() {
    return this.getGamesByStatus("completed");
  }

  /**
   * Get a specific game in standardized format
   * @param {string} gameId - The game ID
   * @returns {Object|null} - The standardized game object or null
   */
  static getGame(gameId) {
    const games = this.getAllSavedGames();
    return games[gameId] || null;
  }

}
