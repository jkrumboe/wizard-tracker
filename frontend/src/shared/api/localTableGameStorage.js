/**
 * Local Table Game Storage Service
 * Handles saving, loading, and managing table games separately from regular wizard games
 */

const LOCAL_TABLE_GAMES_STORAGE_KEY = "wizardTracker_tableGames";

export class LocalTableGameStorage {
  /**
   * Save a table game to local storage
   * @param {Object} gameData - The table game data
   * @param {string} gameName - Optional custom name for the game
   * @returns {string} - The game ID
   */
  static saveTableGame(gameData, gameName = null) {
    const gameId = this.generateGameId();
    const timestamp = new Date().toISOString();
    
    try {
      // Create a saved table game object
      const savedGame = {
        id: gameId,
        name: gameName || `Table Game - ${new Date().toLocaleDateString()}`,
        gameData: gameData,
        savedAt: timestamp,
        lastPlayed: timestamp,
        playerCount: gameData.players ? gameData.players.length : 0,
        totalRounds: gameData.rows || 0,
        gameType: 'table',
        gameFinished: true
      };

      // Get existing storage
      const existingStored = localStorage.getItem(LOCAL_TABLE_GAMES_STORAGE_KEY);
      let existingData = {};

      if (existingStored) {
        try {
          existingData = JSON.parse(existingStored);
        } catch (parseError) {
          console.error("Error parsing existing table games:", parseError);
          existingData = {};
        }
      }

      // Add new game
      existingData[gameId] = savedGame;

      // Save back to storage
      localStorage.setItem(LOCAL_TABLE_GAMES_STORAGE_KEY, JSON.stringify(existingData));

      return gameId;
    } catch (error) {
      console.error("Error saving table game:", error);
      throw error;
    }
  }

  /**
   * Load a saved table game
   * @param {string} gameId - The game ID to load
   * @returns {Object|null} - The game data or null if not found
   */
  static loadTableGame(gameId) {
    const games = this.getAllSavedTableGames();
    const savedGame = games[gameId];
    
    if (savedGame) {
      // Update last played timestamp
      savedGame.lastPlayed = new Date().toISOString();
      games[gameId] = savedGame;
      localStorage.setItem(LOCAL_TABLE_GAMES_STORAGE_KEY, JSON.stringify(games));
      
      return savedGame.gameData;
    }
    
    return null;
  }

  /**
   * Delete a saved table game
   * @param {string} gameId - The game ID to delete
   */
  static deleteTableGame(gameId) {
    const games = this.getAllSavedTableGames();
    delete games[gameId];
    localStorage.setItem(LOCAL_TABLE_GAMES_STORAGE_KEY, JSON.stringify(games));
  }

  /**
   * Get all saved table games
   * @returns {Object} - Object containing all saved table games
   */
  static getAllSavedTableGames() {
    try {
      const stored = localStorage.getItem(LOCAL_TABLE_GAMES_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error("Error loading saved table games:", error);
      return {};
    }
  }

  /**
   * Get saved table games list with metadata
   * @returns {Array} - Array of saved table game metadata
   */
  static getSavedTableGamesList() {
    try {
      const games = this.getAllSavedTableGames();
      
      const gamesList = Object.values(games)
        .filter(game => game && game.id)
        .map(game => {
          const gameData = {
            id: game.id,
            name: game.name || `Table Game from ${new Date(game.savedAt).toLocaleDateString()}`,
            savedAt: game.savedAt || new Date().toISOString(),
            lastPlayed: game.lastPlayed || new Date().toISOString(),
            playerCount: game.playerCount || 0,
            totalRounds: game.totalRounds || 0,
            gameType: 'table',
            gameFinished: true,
            players: game.gameData && game.gameData.players ? 
              game.gameData.players.map(p => p.name) : []
          };
          
          return gameData;
        });

      // Sort by last played date
      gamesList.sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed));
      
      return gamesList;
    } catch (error) {
      console.error("Error getting saved table games list:", error);
      return [];
    }
  }

  /**
   * Check if a table game exists
   * @param {string} gameId - The game ID to check
   * @returns {boolean} - True if game exists
   */
  static tableGameExists(gameId) {
    const games = this.getAllSavedTableGames();
    return Object.prototype.hasOwnProperty.call(games, gameId);
  }

  /**
   * Generate a unique game ID
   * @returns {string} - Unique game ID
   */
  static generateGameId() {
    return `table_game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export all saved table games as JSON
   * @returns {string} - JSON string of all saved table games
   */
  static exportTableGames() {
    return JSON.stringify(this.getAllSavedTableGames(), null, 2);
  }

  /**
   * Import table games from JSON
   * @param {string} jsonData - JSON string of saved table games
   * @returns {boolean} - Success status
   */
  static importTableGames(jsonData) {
    try {
      const importedGames = JSON.parse(jsonData);
      const existingGames = this.getAllSavedTableGames();
      
      // Merge imported games with existing ones
      Object.keys(importedGames).forEach(gameId => {
        const game = importedGames[gameId];
        // Generate new ID if there's a conflict
        let newGameId = gameId;
        while (existingGames[newGameId]) {
          newGameId = this.generateGameId();
        }
        existingGames[newGameId] = {
          ...game,
          id: newGameId
        };
      });
      
      localStorage.setItem(LOCAL_TABLE_GAMES_STORAGE_KEY, JSON.stringify(existingGames));
      return true;
    } catch (error) {
      console.error("Error importing table games:", error);
      return false;
    }
  }

  /**
   * Clear all saved table games
   */
  static clearAllTableGames() {
    localStorage.removeItem(LOCAL_TABLE_GAMES_STORAGE_KEY);
  }

  /**
   * Get table game count
   * @returns {number} - Number of saved table games
   */
  static getTableGameCount() {
    const games = this.getAllSavedTableGames();
    return Object.keys(games).length;
  }

  /**
   * Update a saved table game's metadata
   * @param {string} gameId - The game ID
   * @param {Object} updates - Object containing fields to update
   */
  static updateTableGame(gameId, updates) {
    const games = this.getAllSavedTableGames();
    if (games[gameId]) {
      games[gameId] = { ...games[gameId], ...updates };
      localStorage.setItem(LOCAL_TABLE_GAMES_STORAGE_KEY, JSON.stringify(games));
    }
  }
}
