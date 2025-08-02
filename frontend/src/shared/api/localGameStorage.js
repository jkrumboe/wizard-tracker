/**
 * Local Game Storage Service
 * Handles saving, loading, and managing paused local games
 */

const LOCAL_GAMES_STORAGE_KEY = "wizardTracker_localGames";

export class LocalGameStorage {
  /**
   * Save a game to local storage
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
      // Create a new saved game object
      const gameStateCopy = { 
        ...gameState,
        isPaused: isPaused,
        gameFinished: !isPaused  // If it's not paused, it's finished
      };
      
      // Generate an appropriate name based on game state
      let defaultName;
      if (isPaused) {
        defaultName = `Paused Game - Round ${gameState.currentRound}/${gameState.maxRounds}`;
      } else {
        defaultName = `Finished Game - ${new Date().toLocaleDateString()}`;
      }
      
      // Extract data for finished games to make it accessible at the top level
      const topLevelData = {};
      if (!isPaused) {
        // This is a finished game, extract important data to top level for compatibility
        topLevelData.winner_id = gameState.winner_id;
        topLevelData.final_scores = gameState.final_scores;
        topLevelData.created_at = gameState.created_at || timestamp;
        topLevelData.player_ids = gameState.player_ids || 
                                (gameState.players ? gameState.players.map(p => p.id) : []);
        topLevelData.round_data = gameState.roundData;
        topLevelData.total_rounds = gameState.maxRounds || gameState.totalRounds;
        topLevelData.duration_seconds = gameState.duration_seconds;
        topLevelData.is_local = true;
      }
      
      const savedGame = {
        id: gameId,
        name: gameName || defaultName,
        gameState: gameStateCopy,
        savedAt: timestamp,
        lastPlayed: timestamp,
        playerCount: gameState.players ? gameState.players.length : 0,
        roundsCompleted: gameState.currentRound ? gameState.currentRound - 1 : 0,
        totalRounds: gameState.maxRounds || 0,
        mode: gameState.mode || "Local",
        isPaused: isPaused,
        gameFinished: !isPaused, // If it's not paused, it's finished
        ...topLevelData // Add extracted data for finished games
      };
    
      
      // Get existing storage
      const existingStored = localStorage.getItem(LOCAL_GAMES_STORAGE_KEY);
      
      if (!existingStored) {
        // No existing data, create new
        const newStorage = {};
        newStorage[gameId] = savedGame;
        localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(newStorage));
      } else {
        // Parse existing data
        const existingData = JSON.parse(existingStored);
        
        if (Array.isArray(existingData)) {
          
          // Create new object format
          const newStorage = {};
          
          // Add existing games
          existingData.forEach(game => {
            if (game.id) {
              newStorage[game.id] = {
                id: game.id,
                name: game.name || `Game from ${new Date(game.created_at).toLocaleDateString()}`,
                gameState: {
                  players: game.players,
                  currentRound: game.round_data ? game.round_data.length : 1,
                  maxRounds: game.total_rounds,
                  roundData: game.round_data || [],
                  gameStarted: true,
                  gameFinished: true,
                  mode: game.game_mode || "Local",
                  isLocal: true
                },
                savedAt: game.created_at,
                lastPlayed: game.created_at,
                playerCount: game.players.length,
                roundsCompleted: game.total_rounds - 1,
                totalRounds: game.total_rounds,
                mode: game.game_mode || "Local",
                gameFinished: true,
                isPaused: false
              };
            }
          });
          
          // Add new game
          newStorage[gameId] = savedGame;
          
          // Save back to storage
          localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(newStorage));
          
        } else {
          // It's already in object format
          // If this is a previously paused game that's now finished, remove the old entry if it has a different ID
          if (!isPaused && gameState.gameId && gameState.gameId !== gameId && existingData[gameState.gameId]) {
            delete existingData[gameState.gameId];
          }
          
          existingData[gameId] = savedGame;
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
   * Load a saved game
   * @param {string} gameId - The game ID to load
   * @returns {Object|null} - The game state or null if not found
   */
  static loadGame(gameId) {
    const games = this.getAllSavedGames();
    const savedGame = games[gameId];
    
    if (savedGame) {
      // Update last played timestamp
      savedGame.lastPlayed = new Date().toISOString();
      games[gameId] = savedGame;
      localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(games));
      
      return savedGame.gameState;
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
   * Get all saved games
   * @returns {Object} - Object containing all saved games
   */
  static getAllSavedGames() {
    try {
      const stored = localStorage.getItem(LOCAL_GAMES_STORAGE_KEY);
      
      // Check if the stored data is an array (old format from finishGame)
      if (stored) {
        const parsedData = JSON.parse(stored);
        
        // Convert array to object format if needed
        if (Array.isArray(parsedData)) {
          const games = {};
          parsedData.forEach(game => {
            if (game.id) {
              games[game.id] = {
                id: game.id,
                name: `Game from ${new Date(game.created_at).toLocaleDateString()}`,
                gameState: {
                  players: game.players,
                  currentRound: 1,
                  maxRounds: game.maxRounds,
                  roundData: game.round_data,
                  gameStarted: true,
                  gameFinished: true, // This is a finished game
                  mode: game.game_mode || "Local",
                  isLocal: true
                },
                savedAt: game.created_at,
                lastPlayed: game.created_at,
                playerCount: game.players.length,
                roundsCompleted: game.total_rounds,
                totalRounds: game.total_rounds,
                mode: game.game_mode || "Local",
                gameFinished: true
              };
            }
          });
          return games;
        }
        
        return parsedData;
      }
      
      return {};
    } catch (error) {
      console.error("Error loading saved games:", error);
      return {};
    }
  }

  /**
   * Get saved games list with metadata
   * @returns {Array} - Array of saved game metadata
   */
  static getSavedGamesList() {
    try {
      const stored = localStorage.getItem(LOCAL_GAMES_STORAGE_KEY);
      
      if (!stored) {
        return [];
      }
      
      const parsedData = JSON.parse(stored);
      let gamesList = [];
      
      // Direct array format (old format from finishGame)
      if (Array.isArray(parsedData)) {
        gamesList = parsedData
          .filter(game => game && game.id)
          .map(game => ({
            id: game.id,
            name: game.name || `Game from ${new Date(game.created_at || game.lastPlayed).toLocaleDateString()}`,
            savedAt: game.created_at || game.savedAt || new Date().toISOString(),
            lastPlayed: game.created_at || game.lastPlayed || new Date().toISOString(),
            playerCount: (game.players && game.players.length) || 0,
            roundsCompleted: game.total_rounds - 1 || game.roundsCompleted || 0,
            totalRounds: game.total_rounds || game.totalRounds || 0,
            mode: game.game_mode || game.mode || "Local",
            players: game.players ? game.players.map(p => p.name) : [],
            isPaused: false,
            gameFinished: true
          }));
      } else if (typeof parsedData === 'object' && parsedData !== null) {
        // Object format (new format from LocalGameStorage)
        gamesList = Object.values(parsedData)
          .filter(game => game && game.id)
          .map(game => {
            const gameData = {
              id: game.id,
              name: game.name || `Game from ${new Date(game.savedAt || game.lastPlayed).toLocaleDateString()}`,
              savedAt: game.savedAt || new Date().toISOString(),
              lastPlayed: game.lastPlayed || new Date().toISOString(),
              playerCount: game.playerCount || (game.gameState && game.gameState.players && game.gameState.players.length) || 0,
              roundsCompleted: game.roundsCompleted || (game.gameState && game.gameState.currentRound - 1) || 0,
              totalRounds: game.totalRounds || (game.gameState && game.gameState.maxRounds) || 0,
              mode: game.mode || (game.gameState && game.gameState.mode) || "Local",
              players: (game.gameState && game.gameState.players) ? game.gameState.players.map(p => p.name) : [],
              isPaused: game.isPaused || (game.gameState && game.gameState.isPaused) || false,
              gameFinished: game.gameFinished || (game.gameState && game.gameState.gameFinished) || false
            };
            
            // For finished games, add more data for compatibility
            if (gameData.gameFinished) {
              gameData.created_at = game.created_at || game.savedAt || new Date().toISOString();
              gameData.winner_id = game.winner_id || (game.gameState && game.gameState.winner_id);
              gameData.player_ids = game.player_ids || (game.gameState && game.gameState.player_ids) || 
                                   (game.gameState && game.gameState.players && game.gameState.players.map(p => p.id)) || [];
              gameData.round_data = game.round_data || (game.gameState && game.gameState.roundData);
              gameData.final_scores = game.final_scores || (game.gameState && game.gameState.final_scores);
              gameData.total_rounds = game.total_rounds || game.totalRounds || (game.gameState && game.gameState.maxRounds) || 0;
              gameData.duration_seconds = game.duration_seconds || (game.gameState && game.gameState.duration_seconds);
              gameData.is_local = true;
              gameData.game_mode = game.game_mode || game.mode || (game.gameState && game.gameState.mode) || "Local";
              gameData.gameState = game.gameState;
            }
            
            return gameData;
          });
      }
      
      // Sort by last played date
      gamesList.sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed));
      
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
   * Auto-save a game with a specific ID (for continuous saving)
   * @param {Object} gameState - The current game state
   * @param {string} gameId - Existing game ID for auto-save
   */
  static autoSaveGame(gameState, gameId) {
    const games = this.getAllSavedGames();
    if (games[gameId]) {
      // Update the game state
      games[gameId].gameState = { ...gameState };
      games[gameId].lastPlayed = new Date().toISOString();
      games[gameId].roundsCompleted = gameState.currentRound - 1;
      
      // If the game has transitioned from paused to finished, update metadata
      if (gameState.gameFinished && games[gameId].isPaused) {
        games[gameId].isPaused = false;
        games[gameId].gameFinished = true;
        games[gameId].name = `Finished Game - ${new Date().toLocaleDateString()}`;
        
        // Add finished game metadata
        if (gameState.winner_id) games[gameId].winner_id = gameState.winner_id;
        if (gameState.final_scores) games[gameId].final_scores = gameState.final_scores;
        if (gameState.player_ids) games[gameId].player_ids = gameState.player_ids;
        if (gameState.roundData) games[gameId].round_data = gameState.roundData;
        games[gameId].total_rounds = gameState.maxRounds || gameState.totalRounds;
        games[gameId].duration_seconds = gameState.duration_seconds;
        games[gameId].is_local = true;
        games[gameId].created_at = gameState.created_at || new Date().toISOString();
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
   * Import saved games from JSON with metadata
   * @param {string} jsonData - JSON string of saved games
   * @returns {boolean} - Success status
   */
  static importGames(jsonData) {
    try {
      const importedGames = JSON.parse(jsonData);
      const existingGames = this.getAllSavedGames();
      const importTimestamp = new Date().toISOString();
      
      // Add import metadata to each imported game
      const processedImportedGames = {};
      Object.keys(importedGames).forEach(gameId => {
        const game = importedGames[gameId];
        // Generate new game ID to avoid conflicts
        const newGameId = this.generateGameId();
        processedImportedGames[newGameId] = {
          ...game,
          id: newGameId,
          importedAt: importTimestamp,
          originalGameId: gameId,
          isImported: true,
          name: game.name ? `${game.name} (Imported)` : (game.gameName ? `${game.gameName} (Imported)` : 'Imported Game'),
          gameState: {
            ...game.gameState,
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

}
