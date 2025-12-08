/**
 * Local Table Game Storage Service
 * Handles saving, loading, and managing table games separately from regular wizard games
 * Now supports multiple users on the same device
 */

import { generateSecureId } from '../utils/secureRandom.js';

const LOCAL_TABLE_GAMES_STORAGE_KEY = "wizardTracker_tableGames";

export class LocalTableGameStorage {
  /**
   * Get the current user ID from localStorage
   * @returns {string|null} - The current user ID or null
   */
  static getCurrentUserId() {
    return localStorage.getItem('wizardTracker_currentUserId');
  }

  /**
   * Save a table game to local storage
   * @param {Object} gameData - The table game data
   * @param {string} gameName - Optional custom name for the game
   * @param {string} userId - Optional user ID (defaults to current user)
   * @returns {string} - The game ID
   */
  static saveTableGame(gameData, gameName = null, userId = null) {
    const gameId = this.generateGameId();
    const timestamp = new Date().toISOString();
    const currentUserId = userId || this.getCurrentUserId();
    
    try {
      // Create a saved table game object
      const savedGame = {
        id: gameId,
        name: gameData.gameName || gameName || `Table Game - ${new Date().toLocaleDateString()}`,
        gameTypeName: gameData.gameName || null, // Store actual game type separately
        gameData: gameData,
        savedAt: timestamp,
        lastPlayed: timestamp,
        playerCount: gameData.players ? gameData.players.length : 0,
        totalRounds: gameData.rows || 0,
        gameType: 'table',
        gameFinished: gameData.gameFinished || false,
        userId: currentUserId, // Add userId to track ownership
        targetNumber: gameData.targetNumber || null, // Target score to finish game
        lowIsBetter: gameData.lowIsBetter || false, // Scoring preference
        isUploaded: false, // Track if uploaded to cloud
        cloudGameId: null, // Cloud game ID after upload
        cloudLookupKey: null // Lookup key for duplicate detection
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
   * Get all saved table games (for current user only)
   * @param {string} userId - Optional user ID (defaults to current user)
   * @returns {Object} - Object containing all saved table games for the user
   */
  static getAllSavedTableGames(userId = null) {
    try {
      const stored = localStorage.getItem(LOCAL_TABLE_GAMES_STORAGE_KEY);
      const allGames = stored ? JSON.parse(stored) : {};
      const currentUserId = userId || this.getCurrentUserId();
      
      // If no user is logged in, return all games (backward compatibility)
      if (!currentUserId) {
        return allGames;
      }
      
      // Filter games for the current user
      const userGames = {};
      for (const gameId of Object.keys(allGames)) {
        const game = allGames[gameId];
        // Include games without userId (legacy) or games matching current user
        if (!game.userId || game.userId === currentUserId) {
          userGames[gameId] = game;
        }
      }
      
      return userGames;
    } catch (error) {
      console.error("Error loading saved table games:", error);
      return {};
    }
  }
  
  /**
   * Get all saved table games (all users, for admin/migration purposes)
   * @returns {Object} - Object containing all saved table games
   */
  static getAllSavedTableGamesAllUsers() {
    try {
      const stored = localStorage.getItem(LOCAL_TABLE_GAMES_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error("Error loading saved table games:", error);
      return {};
    }
  }

  /**
   * Get saved table games list with metadata (for current user)
   * @param {string} userId - Optional user ID (defaults to current user)
   * @returns {Array} - Array of saved table game metadata
   */
  static getSavedTableGamesList(userId = null) {
    try {
      const games = this.getAllSavedTableGames(userId);
      
      const gamesList = Object.values(games)
        .filter(game => game && game.id)
        .map(game => {
          const gameData = {
            id: game.id,
            name: game.name || `Table Game from ${new Date(game.savedAt).toLocaleDateString()}`,
            gameTypeName: game.gameTypeName || game.name,
            savedAt: game.savedAt || new Date().toISOString(),
            lastPlayed: game.lastPlayed || new Date().toISOString(),
            playerCount: game.playerCount || 0,
            totalRounds: game.totalRounds || 0,
            gameType: 'table',
            gameFinished: game.gameFinished || false,
            userId: game.userId,
            lowIsBetter: game.lowIsBetter || game.gameData?.lowIsBetter || false,
            winner_id: game.winner_id || game.gameData?.winner_id,
            winner_name: game.winner_name || game.gameData?.winner_name,
            gameData: game.gameData, // Include full gameData for access to players and winner info
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
   * Get a specific table game by ID
   * @param {string} gameId - The game ID to retrieve
   * @returns {Object|null} - The saved game object or null if not found
   */
  static getTableGameById(gameId) {
    const games = this.getAllSavedTableGames();
    return games[gameId] || null;
  }

  /**
   * Generate a unique game ID
   * @returns {string} - Unique game ID
   */
  static generateGameId() {
    return generateSecureId('table_game');
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
    const games = this.getAllSavedTableGamesAllUsers(); // Get all games to update
    if (games[gameId]) {
      games[gameId] = { ...games[gameId], ...updates };
      localStorage.setItem(LOCAL_TABLE_GAMES_STORAGE_KEY, JSON.stringify(games));
    }
  }
  
  /**
   * Migrate legacy games (without userId) to a specific user
   * @param {string} userId - The user ID to assign legacy games to
   * @returns {number} - Number of games migrated
   */
  static migrateLegacyGamesToUser(userId) {
    if (!userId) return 0;
    
    const allGames = this.getAllSavedTableGamesAllUsers();
    let migratedCount = 0;
    
    Object.keys(allGames).forEach(gameId => {
      const game = allGames[gameId];
      if (!game.userId) {
        game.userId = userId;
        migratedCount++;
      }
    });
    
    if (migratedCount > 0) {
      localStorage.setItem(LOCAL_TABLE_GAMES_STORAGE_KEY, JSON.stringify(allGames));
      console.debug(`✅ Migrated ${migratedCount} legacy table games to user ${userId}`);
    }
    
    return migratedCount;
  }

  /**
   * Mark a table game as uploaded to cloud
   * @param {string} gameId - The game ID
   * @param {string} cloudGameId - The cloud game ID
   * @param {string} cloudLookupKey - The cloud lookup key for duplicate detection
   */
  static markGameAsUploaded(gameId, cloudGameId, cloudLookupKey = null) {
    const games = this.getAllSavedTableGamesAllUsers();
    if (games[gameId]) {
      games[gameId].isUploaded = true;
      games[gameId].cloudGameId = cloudGameId;
      games[gameId].cloudLookupKey = cloudLookupKey;
      games[gameId].uploadedAt = new Date().toISOString();
      localStorage.setItem(LOCAL_TABLE_GAMES_STORAGE_KEY, JSON.stringify(games));
    }
  }

  /**
   * Check if a table game has been uploaded to cloud
   * @param {string} gameId - The game ID
   * @returns {boolean} - True if game has been uploaded
   */
  static isGameUploaded(gameId) {
    const games = this.getAllSavedTableGames();
    return games[gameId] && games[gameId].isUploaded === true;
  }

  /**
   * Clear upload status for a table game (e.g., when deleted from cloud)
   * @param {string} gameId - The game ID
   */
  static clearUploadStatus(gameId) {
    const games = this.getAllSavedTableGamesAllUsers();
    if (games[gameId]) {
      games[gameId].isUploaded = false;
      games[gameId].cloudGameId = null;
      games[gameId].cloudLookupKey = null;
      games[gameId].uploadedAt = null;
      localStorage.setItem(LOCAL_TABLE_GAMES_STORAGE_KEY, JSON.stringify(games));
      console.debug(`[LocalTableGameStorage] Cleared upload status for game ${gameId}`);
    }
  }

  /**
   * Get the cloud game ID for an uploaded table game
   * @param {string} gameId - The local game ID
   * @returns {string|null} - The cloud game ID or null if not uploaded
   */
  static getCloudGameId(gameId) {
    const games = this.getAllSavedTableGames();
    return games[gameId] && games[gameId].cloudGameId ? games[gameId].cloudGameId : null;
  }

  /**
   * Migrate existing table games to add upload tracking properties
   */
  static migrateGamesForUploadTracking() {
    const games = this.getAllSavedTableGamesAllUsers();
    let migrationNeeded = false;
    
    for (const gameId in games) {
      const game = games[gameId];
      
      // Add missing upload tracking properties
      if (game.isUploaded === undefined) {
        game.isUploaded = false;
        migrationNeeded = true;
      }
      
      if (game.cloudGameId === undefined) {
        game.cloudGameId = null;
        migrationNeeded = true;
      }
      
      if (game.cloudLookupKey === undefined) {
        game.cloudLookupKey = null;
        migrationNeeded = true;
      }
    }
    
    if (migrationNeeded) {
      localStorage.setItem(LOCAL_TABLE_GAMES_STORAGE_KEY, JSON.stringify(games));
      console.debug('✅ Migrated table games for upload tracking');
    }
    
    return games;
  }
}

