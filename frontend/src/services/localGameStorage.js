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
   * @returns {string} - The game ID
   */
  static saveGame(gameState, gameName = null) {
    const games = this.getAllSavedGames();
    const gameId = this.generateGameId();
    const timestamp = new Date().toISOString();
    
    const savedGame = {
      id: gameId,
      name: gameName || `Game ${gameState.currentRound}/${gameState.maxRounds}`,
      gameState: { ...gameState },
      savedAt: timestamp,
      lastPlayed: timestamp,
      playerCount: gameState.players.length,
      roundsCompleted: gameState.currentRound - 1,
      totalRounds: gameState.maxRounds,
      mode: gameState.mode || "Local"
    };

    games[gameId] = savedGame;
    localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(games));
    
    return gameId;
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
      return stored ? JSON.parse(stored) : {};
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
    const games = this.getAllSavedGames();
    return Object.values(games)
      .sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed))
      .map(game => ({
        id: game.id,
        name: game.name,
        savedAt: game.savedAt,
        lastPlayed: game.lastPlayed,
        playerCount: game.playerCount,
        roundsCompleted: game.roundsCompleted,
        totalRounds: game.totalRounds,
        mode: game.mode,
        players: game.gameState.players.map(p => p.name)
      }));
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
      games[gameId].gameState = { ...gameState };
      games[gameId].lastPlayed = new Date().toISOString();
      games[gameId].roundsCompleted = gameState.currentRound - 1;
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
   * Clean up old saved games (keep only the most recent 10)
   */
  static cleanupOldGames(maxGames = 10) {
    const games = this.getAllSavedGames();
    const gamesList = Object.values(games)
      .sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed));
    
    if (gamesList.length > maxGames) {
      const gamesToKeep = gamesList.slice(0, maxGames);
      const cleanedGames = {};
      
      gamesToKeep.forEach(game => {
        cleanedGames[game.id] = game;
      });
      
      localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(cleanedGames));
    }
  }

  /**
   * Export all saved games as JSON
   * @returns {string} - JSON string of all saved games
   */
  static exportGames() {
    return JSON.stringify(this.getAllSavedGames(), null, 2);
  }

  /**
   * Import saved games from JSON
   * @param {string} jsonData - JSON string of saved games
   * @returns {boolean} - Success status
   */
  static importGames(jsonData) {
    try {
      const importedGames = JSON.parse(jsonData);
      const existingGames = this.getAllSavedGames();
      const mergedGames = { ...existingGames, ...importedGames };
      
      localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(mergedGames));
      return true;
    } catch (error) {
      console.error("Error importing games:", error);
      return false;
    }
  }
}
