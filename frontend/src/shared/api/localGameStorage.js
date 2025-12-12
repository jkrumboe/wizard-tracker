/**
 * Local Game Storage Service
 * Handles saving, loading, and managing paused local games
 * Now supports multiple users on the same device
 */

import { generateSecureId } from '../utils/secureRandom.js';

const LOCAL_GAMES_STORAGE_KEY = "wizardTracker_localGames";

export class LocalGameStorage {
  /**
   * Get the current user ID from localStorage
   * @returns {string|null} - The current user ID or null
   */
  static getCurrentUserId() {
    return localStorage.getItem('wizardTracker_currentUserId');
  }

  /**
   * Save a game to local storage in v3.0 format
   * @param {Object} gameState - The current game state
   * @param {string} gameName - Optional custom name for the game
   * @param {boolean} isPaused - Whether this is a paused game (true) or a finished game (false)
   * @param {string} userId - Optional user ID (defaults to current user)
   * @returns {string} - The game ID
   */
  static saveGame(gameState, gameName = null, isPaused = true, userId = null) {
    // Check if this is a finished game that was previously paused
    let gameId = gameState.gameId;
    const isFinishedPausedGame = !isPaused && gameId && this.gameExists(gameId);
    
    // If it's not an update to an existing paused game, generate a new ID
    if (!isFinishedPausedGame) {
      gameId = this.generateGameId();
    }
    
    const timestamp = new Date().toISOString();
    const currentUserId = userId || this.getCurrentUserId();
    
    try {
      // Generate an appropriate name based on game state
      let defaultName;
      if (isPaused) {
        defaultName = `Paused Game - Round ${gameState.currentRound}/${gameState.maxRounds}`;
      } else {
        defaultName = `Finished Game - ${new Date().toLocaleDateString()}`;
      }
      
      // Convert round data to v3.0 format
      // For paused games, only save rounds up to and including the current round
      const allRounds = gameState.roundData || gameState.round_data || gameState.rounds || [];
      const roundsToSave = isPaused && gameState.currentRound !== undefined
        ? allRounds.slice(0, gameState.currentRound + 1) // Only save up to current round (inclusive)
        : allRounds; // For finished games, save all rounds
      
      console.log('[LocalStorage] Saving game:', {
        isPaused,
        currentRound: gameState.currentRound,
        totalRounds: allRounds.length,
        roundsToSave: roundsToSave.length,
        gameId
      });
      
      const roundData = roundsToSave.map(round => ({
        players: (round.players || []).map(player => {
          const formatted = {
            id: player.id,
            name: player.name, // Include name for display
            made: player.made !== undefined ? player.made : null,
            score: player.score !== undefined ? player.score : null
          };
          
          // Only include call if it's defined
          if (player.call !== undefined) {
            formatted.call = player.call;
          }
          
          // Include totalScore if it exists
          if (player.totalScore !== undefined) {
            formatted.totalScore = player.totalScore;
          }
          
          return formatted;
        })
      }));
      
      // Convert players to v3.0 format
      const players = (gameState.players || []).map(player => ({
        id: player.id,
        name: player.name,
        ...(player.isVerified !== undefined && { isVerified: player.isVerified }),
        ...(player.isDealer !== undefined && { isDealer: player.isDealer }),
        ...(player.isCaller !== undefined && { isCaller: player.isCaller })
      }));
      
      // Build v3.0 format game object
      const savedGame = {
        // Unique identifiers
        id: gameId,
        
        // v3.0 schema fields (snake_case)
        version: '3.0',
        created_at: gameState.created_at || gameState.referenceDate || timestamp,
        duration_seconds: gameState.duration_seconds || 0,
        total_rounds: gameState.total_rounds || gameState.maxRounds || 0,
        players: players,
        round_data: roundData,
        
        // Game state fields
        gameFinished: !isPaused,
        
        // Metadata fields for UI
        name: gameName || defaultName,
        savedAt: timestamp,
        lastPlayed: timestamp,
        userId: currentUserId,
        isUploaded: false,
        cloudGameId: null,
        cloudLookupKey: null,
        
        // Store original state for internal use (currentRound, maxRounds, etc.)
        _internalState: {
          currentRound: gameState.currentRound,
          maxRounds: gameState.maxRounds,
          gameStarted: gameState.gameStarted,
          mode: gameState.mode || "Local",
          isLocal: gameState.isLocal !== undefined ? gameState.isLocal : true,
          isPaused: isPaused,
          referenceDate: gameState.referenceDate
        }
      };
      
      // Add optional finished game fields
      if (!isPaused) {
        if (gameState.winner_id || gameState.totals?.winner_id) {
          savedGame.winner_id = gameState.winner_id || gameState.totals?.winner_id || [];
        }
        if (gameState.final_scores || gameState.totals?.final_scores) {
          savedGame.final_scores = gameState.final_scores || gameState.totals?.final_scores || {};
        }
      }
    
      
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
   * Load a saved game and convert from v3.0 to internal format
   * @param {string} gameId - The game ID to load
   * @returns {Object|null} - The game state in internal format or null if not found
   */
  static loadGame(gameId) {
    const games = this.getAllSavedGames();
    const savedGame = games[gameId];
    
    if (savedGame) {
      // Update last played timestamp
      savedGame.lastPlayed = new Date().toISOString();
      games[gameId] = savedGame;
      localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(games));
      
      // Check if it's v3.0 format (has version field and no gameState wrapper)
      if (savedGame.version === '3.0' && !savedGame.gameState) {
        // Convert v3.0 format back to internal format
        const internalState = savedGame._internalState || {};
        
        // Merge player names from root players array into roundData if missing
        // Also add round numbers and fill missing future rounds for paused games
        const savedRounds = savedGame.round_data || [];
        const totalRounds = savedGame.total_rounds || internalState.maxRounds || 20;
        const currentRound = internalState.currentRound || 1;
        
        // Create all rounds (both saved and future ones)
        const roundData = [];
        for (let i = 1; i <= totalRounds; i++) {
          const savedRound = savedRounds[i - 1]; // Saved rounds are 0-indexed
          
          if (savedRound) {
            // Use saved round data and add round number
            roundData.push({
              round: i,
              cards: i <= 10 ? i : 20 - i,
              players: (savedRound.players || []).map(roundPlayer => {
                // If player name is missing, get it from root players array
                if (!roundPlayer.name) {
                  const fullPlayer = (savedGame.players || []).find(p => String(p.id) === String(roundPlayer.id));
                  return {
                    ...roundPlayer,
                    name: fullPlayer?.name || `Player ${roundPlayer.id}`
                  };
                }
                return roundPlayer;
              })
            });
          } else {
            // Create empty round for future rounds
            roundData.push({
              round: i,
              cards: i <= 10 ? i : 20 - i,
              players: (savedGame.players || []).map(player => ({
                id: player.id,
                name: player.name,
                call: null,
                made: null,
                score: null,
                totalScore: 0
              }))
            });
          }
        }
        
        return {
          gameId: savedGame.id,
          players: savedGame.players || [],
          currentRound: internalState.currentRound || 1,
          maxRounds: internalState.maxRounds || savedGame.total_rounds || 0,
          roundData: roundData,
          gameStarted: internalState.gameStarted !== undefined ? internalState.gameStarted : true,
          gameFinished: savedGame.gameFinished || false,
          mode: internalState.mode || "Local",
          isLocal: internalState.isLocal !== undefined ? internalState.isLocal : true,
          isPaused: internalState.isPaused !== undefined ? internalState.isPaused : !savedGame.gameFinished,
          referenceDate: internalState.referenceDate || savedGame.created_at,
          created_at: savedGame.created_at,
          duration_seconds: savedGame.duration_seconds,
          winner_id: savedGame.winner_id,
          final_scores: savedGame.final_scores,
          total_rounds: savedGame.total_rounds
        };
      }
      
      // Legacy format with gameState wrapper
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
   * Get all saved games (for current user only)
   * @param {string} userId - Optional user ID (defaults to current user)
   * @returns {Object} - Object containing all saved games for the user
   */
  static getAllSavedGames(userId = null) {
    try {
      const stored = localStorage.getItem(LOCAL_GAMES_STORAGE_KEY);
      const currentUserId = userId || this.getCurrentUserId();
      
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
                gameFinished: true,
                userId: game.userId // Preserve userId if it exists
              };
            }
          });
          
          // Filter by user if logged in
          if (!currentUserId) {
            return games;
          }
          
          const userGames = {};
          Object.keys(games).forEach(gameId => {
            const game = games[gameId];
            if (!game.userId || game.userId === currentUserId) {
              userGames[gameId] = game;
            }
          });
          return userGames;
        }
        
        // Object format - filter by user
        if (!currentUserId) {
          return parsedData; // Return all if no user logged in
        }
        
        const userGames = {};
        Object.keys(parsedData).forEach(gameId => {
          const game = parsedData[gameId];
          if (!game.userId || game.userId === currentUserId) {
            userGames[gameId] = game;
          }
        });
        return userGames;
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
            players: (() => {
              // Handle both object and string arrays for backward compatibility
              if (game.players && Array.isArray(game.players)) {
                if (game.players.length > 0 && typeof game.players[0] === 'object' && game.players[0].name) {
                  return game.players.map(p => p.name);
                } else if (game.players.length > 0 && typeof game.players[0] === 'string') {
                  return game.players;
                }
              }
              return [];
            })(),
            isPaused: false,
            gameFinished: true
          }));
      } else if (typeof parsedData === 'object' && parsedData !== null) {
        // Object format (new format from LocalGameStorage)
        gamesList = Object.values(parsedData)
          .filter(game => game && game.id)
          .map(game => {
            // Check if it's v3.0 format or legacy format
            const isV3Format = game.version === '3.0' && !game.gameState;
            
            const gameData = {
              id: game.id,
              name: game.name || `Game from ${new Date(game.savedAt || game.lastPlayed).toLocaleDateString()}`,
              savedAt: game.savedAt || new Date().toISOString(),
              lastPlayed: game.lastPlayed || new Date().toISOString(),
              playerCount: isV3Format 
                ? (game.players ? game.players.length : 0)
                : (game.playerCount || (game.gameState && game.gameState.players && game.gameState.players.length) || 0),
              roundsCompleted: isV3Format
                ? (game.gameFinished 
                    ? game.total_rounds 
                    : (game._internalState?.currentRound ? game._internalState.currentRound - 1 : 0))
                : (game.gameFinished 
                    ? (game.totalRounds || (game.gameState?.maxRounds)) 
                    : (game.roundsCompleted || (game.gameState && game.gameState.currentRound - 1) || 0)),
              totalRounds: isV3Format
                ? game.total_rounds
                : (game.totalRounds || (game.gameState && game.gameState.maxRounds) || 0),
              mode: isV3Format
                ? (game._internalState ? game._internalState.mode : "Local")
                : (game.mode || (game.gameState && game.gameState.mode) || "Local"),
              players: (() => {
                if (isV3Format) {
                  // v3.0 format - players are at root level
                  return game.players ? game.players.map(p => p.name) : [];
                }
                
                // Legacy format - try multiple sources for player names
                // Check root level players first (for imported games)
                if (game.players && Array.isArray(game.players)) {
                  if (game.players.length > 0 && typeof game.players[0] === 'object' && game.players[0].name) {
                    const playerNames = game.players.map(p => p.name);
                    console.debug('getSavedGamesList: Found players at root level:', playerNames);
                    return playerNames;
                  } else if (game.players.length > 0 && typeof game.players[0] === 'string') {
                    console.debug('getSavedGamesList: Found string players at root level:', game.players);
                    return game.players;
                  }
                }
                // Fall back to gameState.players
                else if (game.gameState && game.gameState.players) {
                  // Players are in gameState.players (objects with name property)
                  const playerNames = game.gameState.players.map(p => p.name);
                  console.debug('getSavedGamesList: Found players in gameState:', playerNames);
                  return playerNames;
                }
                console.debug('getSavedGamesList: No players found for game:', game.id || game.name);
                return [];
              })(),
              isPaused: isV3Format
                ? (game._internalState ? game._internalState.isPaused : !game.gameFinished)
                : (game.isPaused || (game.gameState && game.gameState.isPaused) || false),
              gameFinished: game.gameFinished || (game.gameState && game.gameState.gameFinished) || false,
              totalRounds: isV3Format
                ? game.total_rounds
                : (game.totalRounds || (game.gameState && game.gameState.maxRounds) || 0)
            };
            
            // For finished games, add more data for compatibility
            if (gameData.gameFinished) {
              gameData.created_at = game.created_at || game.savedAt || new Date().toISOString();
              gameData.winner_id = game.winner_id || (game.gameState && game.gameState.winner_id);
              gameData.player_ids = isV3Format
                ? (game.players ? game.players.map(p => p.id) : [])
                : (game.player_ids || (game.gameState && game.gameState.player_ids) || 
                   (game.gameState && game.gameState.players && game.gameState.players.map(p => p.id)) || []);
              gameData.round_data = isV3Format
                ? game.round_data
                : (game.round_data || (game.gameState && game.gameState.roundData));
              gameData.final_scores = game.final_scores || (game.gameState && game.gameState.final_scores);
              gameData.total_rounds = game.total_rounds || game.totalRounds || (game.gameState && game.gameState.maxRounds) || 0;
              gameData.duration_seconds = game.duration_seconds || (game.gameState && game.gameState.duration_seconds);
              gameData.is_local = true;
              gameData.game_mode = game.game_mode || game.mode || (game.gameState && game.gameState.mode) || "Local";
              // For v3.0 format, include all the game data, not gameState wrapper
              if (isV3Format) {
                gameData.version = '3.0';
                gameData.players = game.players;
              } else {
                gameData.gameState = game.gameState;
              }
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
    console.debug('LocalGameStorage.getAllGames() called, returning:', games);
    console.debug('Number of games found:', Object.keys(games).length);
    return games;
  }

  /**
   * Debug function to check localStorage directly
   * @returns {Object} - Raw localStorage content
   */
  static debugLocalStorage() {
    const rawData = localStorage.getItem(LOCAL_GAMES_STORAGE_KEY);
    console.debug('Raw localStorage data for key "' + LOCAL_GAMES_STORAGE_KEY + '":', rawData);
    
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        console.debug('Parsed localStorage data:', parsed);
        console.debug('Type of parsed data:', Array.isArray(parsed) ? 'Array' : typeof parsed);
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
   * Mark a game as uploaded to cloud
   * @param {string} gameId - The game ID
   * @param {string} cloudGameId - The cloud game ID
   * @param {string} cloudLookupKey - The cloud lookup key for duplicate detection
   */
  static markGameAsUploaded(gameId, cloudGameId, cloudLookupKey = null) {
    const games = this.getAllSavedGames();
    if (games[gameId]) {
      games[gameId].isUploaded = true;
      games[gameId].cloudGameId = cloudGameId;
      games[gameId].uploadedAt = new Date().toISOString();
      if (cloudLookupKey) {
        games[gameId].cloudLookupKey = cloudLookupKey;
      }
      localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(games));
    }
  }

  /**
   * Check if a game has been uploaded to cloud
   * @param {string} gameId - The game ID
   * @returns {boolean} - True if game has been uploaded
   */
  static isGameUploaded(gameId) {
    const games = this.getAllSavedGames();
    return games[gameId]?.isUploaded === true;
  }

  /**
   * Get the cloud game ID for an uploaded game
   * @param {string} gameId - The local game ID
   * @returns {string|null} - The cloud game ID or null if not uploaded
   */
  static getCloudGameId(gameId) {
    const games = this.getAllSavedGames();
    return games[gameId]?.cloudGameId || null;
  }

  /**
   * Find games by cloud lookup key (for duplicate detection)
   * @param {string} cloudLookupKey - The cloud lookup key
   * @returns {Array} - Array of local games with the same cloud lookup key
   */
  static findGamesByCloudLookupKey(cloudLookupKey) {
    const games = this.getAllSavedGames();
    return Object.values(games).filter(game => game.cloudLookupKey === cloudLookupKey);
  }

  /**
   * Auto-save a game with a specific ID (for continuous saving) in v3.0 format
   * @param {Object} gameState - The current game state
   * @param {string} gameId - Existing game ID for auto-save
   */
  static autoSaveGame(gameState, gameId) {
    const games = this.getAllSavedGames();
    if (games[gameId]) {
      const timestamp = new Date().toISOString();
      
      // Check if it's v3.0 format
      if (games[gameId].version === '3.0') {
        // Update v3.0 format fields
        
        // Convert round data to v3.0 format
        const roundData = (gameState.roundData || gameState.round_data || gameState.rounds || []).map(round => ({
          players: (round.players || []).map(player => {
            const formatted = {
              id: player.id,
              made: player.made !== undefined ? player.made : null,
              score: player.score !== undefined ? player.score : null
            };
            
            if (player.call !== undefined) {
              formatted.call = player.call;
            }
            
            return formatted;
          })
        }));
        
        // Update v3.0 fields
        games[gameId].round_data = roundData;
        games[gameId].lastPlayed = timestamp;
        games[gameId].total_rounds = gameState.total_rounds || gameState.maxRounds || 0;
        games[gameId].duration_seconds = gameState.duration_seconds || 0;
        
        // Update internal state
        if (!games[gameId]._internalState) {
          games[gameId]._internalState = {};
        }
        games[gameId]._internalState.currentRound = gameState.currentRound;
        games[gameId]._internalState.maxRounds = gameState.maxRounds;
        games[gameId]._internalState.gameStarted = gameState.gameStarted;
        
        // If the game has transitioned from paused to finished, update metadata
        if (gameState.gameFinished && !games[gameId].gameFinished) {
          games[gameId].gameFinished = true;
          games[gameId]._internalState.isPaused = false;
          games[gameId].name = `Finished Game - ${new Date().toLocaleDateString()}`;
          
          // Add finished game metadata
          if (gameState.winner_id || gameState.totals?.winner_id) {
            games[gameId].winner_id = gameState.winner_id || gameState.totals?.winner_id || [];
          }
          if (gameState.final_scores || gameState.totals?.final_scores) {
            games[gameId].final_scores = gameState.final_scores || gameState.totals?.final_scores || {};
          }
          if (!games[gameId].created_at) {
            games[gameId].created_at = gameState.created_at || timestamp;
          }
        }
      } else {
        // Legacy format with gameState wrapper - update as before
        games[gameId].gameState = { ...gameState };
        games[gameId].lastPlayed = timestamp;
        games[gameId].roundsCompleted = gameState.currentRound - 1;
        games[gameId].totalRounds = gameState.maxRounds || gameState.totalRounds || 0;
        
        // If the game has transitioned from paused to finished, update metadata
        if (gameState.gameFinished && games[gameId].isPaused) {
          games[gameId].isPaused = false;
          games[gameId].gameFinished = true;
          games[gameId].name = `Finished Game - ${new Date().toLocaleDateString()}`;
          
          const winnerIds = gameState.winner_id || gameState.totals?.winner_id || [];
          const finalScores = gameState.final_scores || gameState.totals?.final_scores || {};
          const totalRounds = gameState.total_rounds || gameState.totals?.total_rounds || gameState.maxRounds || gameState.totalRounds;
          
          games[gameId].winner_id = winnerIds;
          games[gameId].final_scores = finalScores;
          if (gameState.player_ids) games[gameId].player_ids = gameState.player_ids;
          if (gameState.roundData || gameState.rounds) {
            games[gameId].round_data = gameState.roundData || gameState.rounds;
          }
          games[gameId].total_rounds = totalRounds;
          games[gameId].duration_seconds = gameState.duration_seconds;
          games[gameId].is_local = true;
          games[gameId].created_at = gameState.created_at || timestamp;
        }
      }
      
      localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(games));
    }
  }

  /**
   * Generate a unique game ID
   * @returns {string} - Unique game ID
   */
  static generateGameId() {
    return generateSecureId('game');
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
      
      // Check for existing imports to prevent duplicates
      const existingOriginalIds = new Set();
      Object.values(existingGames).forEach(game => {
        if (game.originalGameId) {
          existingOriginalIds.add(game.originalGameId);
        }
        if (game.gameState?.originalGameId) {
          existingOriginalIds.add(game.gameState.originalGameId);
        }
      });
      
      // Add import metadata to each imported game
      const processedImportedGames = {};
      Object.keys(importedGames).forEach(gameId => {
        const game = importedGames[gameId];
        
        // Check if this game was already imported
        if (existingOriginalIds.has(gameId)) {
          console.debug(`Game ${gameId} already imported, skipping duplicate`);
          return;
        }
        
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

  /**
   * Migrate existing games to add upload tracking properties
   * This ensures older games have the necessary properties for sync tracking
   */
  static migrateGamesForUploadTracking() {
    const games = this.getAllSavedGamesAllUsers(); // Get all games for migration
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
      localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(games));
    }
    
    return games;
  }

  /**
   * Get all saved games (all users, for admin/migration purposes)
   * @returns {Object} - Object containing all saved games
   */
  static getAllSavedGamesAllUsers() {
    try {
      const stored = localStorage.getItem(LOCAL_GAMES_STORAGE_KEY);
      
      if (!stored) {
        return {};
      }
      
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
                gameFinished: true,
                mode: game.game_mode || "Local",
                isLocal: true
              },
              savedAt: game.created_at,
              lastPlayed: game.created_at,
              playerCount: game.players.length,
              roundsCompleted: game.total_rounds,
              totalRounds: game.total_rounds,
              mode: game.game_mode || "Local",
              gameFinished: true,
              userId: game.userId
            };
          }
        });
        return games;
      }
      
      return parsedData;
    } catch (error) {
      console.error("Error loading all saved games:", error);
      return {};
    }
  }

  /**
   * Migrate legacy games (without userId) to a specific user
   * @param {string} userId - The user ID to assign legacy games to
   * @returns {number} - Number of games migrated
   */
  static migrateLegacyGamesToUser(userId) {
    if (!userId) return 0;
    
    const allGames = this.getAllSavedGamesAllUsers();
    let migratedCount = 0;
    
    Object.keys(allGames).forEach(gameId => {
      const game = allGames[gameId];
      if (!game.userId) {
        game.userId = userId;
        migratedCount++;
      }
    });
    
    if (migratedCount > 0) {
      localStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(allGames));
      console.debug(`✅ Migrated ${migratedCount} legacy games to user ${userId}`);
    }
    
    return migratedCount;
  }

}
