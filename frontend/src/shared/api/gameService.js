// Game service - Backend and local storage only

import { LocalGameStorage } from "@/shared/api/localGameStorage";
import { API_ENDPOINTS } from "@/shared/api/config";
import { 
  migrateToNewSchema, 
  toLegacyFormat, 
  validateGameSchema,
  GameStatus,
  GameMode 
} from "@/shared/schemas/gameSchema";
import { validateWithJsonSchema } from "@/shared/schemas/gameJsonSchema";

//=== Game Management ===//

// Get all games
export async function getGames() {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(API_ENDPOINTS.games.list, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error('Failed to fetch games');
  const data = await res.json();
  return data.games || [];
}

// Get recent games
export async function getRecentGames(_limit = 5) {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_ENDPOINTS.games.list}?limit=${_limit}&sortOrder=desc`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error('Failed to fetch recent games');
  const data = await res.json();
  return data.games || [];
}

/**
 * Get list of cloud games for the logged-in user (metadata only)
 * @returns {Promise<Array>} List of cloud games with metadata
 */
export async function getUserCloudGamesList() {
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    throw new Error('You must be logged in to access cloud games');
  }

  try {
    // Fetch all user's games from cloud (paginated)
    let allGames = [];
    let currentPage = 1;
    let hasMore = true;
    
    while (hasMore) {
      const res = await fetch(`${API_ENDPOINTS.games.list}?page=${currentPage}&limit=100&sortOrder=desc`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch cloud games');
      }
      
      const data = await res.json();
      allGames = allGames.concat(data.games || []);
      hasMore = data.pagination?.hasNextPage || false;
      currentPage++;
    }

    // Return games with useful metadata for selection
    return allGames.map(cloudGame => {
      const gameData = cloudGame.gameData || {};
      const localId = cloudGame.localId || cloudGame.id;
      const existingGame = LocalGameStorage.loadGame(localId);
      
      return {
        cloudId: cloudGame.id,
        localId: localId,
        players: gameData.gameState?.players || gameData.players || [],
        winner_id: gameData.winner_id || gameData.gameState?.winner_id,
        final_scores: gameData.final_scores || gameData.gameState?.final_scores || {},
        created_at: cloudGame.createdAt || gameData.created_at,
        total_rounds: gameData.total_rounds || gameData.gameState?.total_rounds || 0,
        isPaused: gameData.isPaused || gameData.gameState?.isPaused || false,
        gameFinished: gameData.gameFinished || gameData.gameState?.gameFinished || false,
        existsLocally: !!existingGame,
        rawData: cloudGame // Keep raw data for download
      };
    });
  } catch (error) {
    console.error('Error fetching cloud games list:', error);
    throw error;
  }
}

/**
 * Download selected cloud games and save them locally
 * @param {Array<string>} cloudGameIds - Array of cloud game IDs to download
 * @returns {Promise<{success: boolean, downloaded: number, skipped: number, errors: number}>}
 */
export async function downloadSelectedCloudGames(cloudGameIds) {
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    throw new Error('You must be logged in to download cloud games');
  }

  if (!Array.isArray(cloudGameIds) || cloudGameIds.length === 0) {
    return { success: true, downloaded: 0, skipped: 0, errors: 0 };
  }

  try {
    // Get all cloud games first
    const cloudGamesList = await getUserCloudGamesList();
    
    let downloaded = 0;
    let skipped = 0;
    let errors = 0;

    for (const cloudGameId of cloudGameIds) {
      try {
        // Find the game in the list
        const cloudGameMeta = cloudGamesList.find(g => g.cloudId === cloudGameId);
        
        if (!cloudGameMeta) {
          console.warn(`Cloud game ${cloudGameId} not found`);
          errors++;
          continue;
        }

        const cloudGame = cloudGameMeta.rawData;
        const localId = cloudGame.localId || cloudGame.id;
        
        // Check if game already exists locally
        const existingGame = LocalGameStorage.loadGame(localId);
        
        if (existingGame) {
          skipped++;
          continue;
        }

        // Extract the actual game data - handle nested structure
        let gameDataToSave = cloudGame.gameData || cloudGame;
        
        // If gameData is nested, unwrap it
        if (gameDataToSave.gameData) {
          gameDataToSave = gameDataToSave.gameData;
        }

        // Prepare game data for local storage with proper structure
        const gameToSave = {
          id: localId,
          name: gameDataToSave.name || `Game ${new Date(cloudGame.createdAt).toLocaleDateString()}`,
          gameState: gameDataToSave.gameState || {
            players: gameDataToSave.players || [],
            currentRound: gameDataToSave.currentRound || gameDataToSave.total_rounds || 0,
            maxRounds: gameDataToSave.maxRounds || gameDataToSave.total_rounds || 0,
            roundData: gameDataToSave.roundData || gameDataToSave.round_data || [],
            gameStarted: gameDataToSave.gameStarted !== false,
            gameFinished: gameDataToSave.gameFinished || false,
            mode: gameDataToSave.mode || 'Local',
            isLocal: true,
            isPaused: gameDataToSave.isPaused || false,
            referenceDate: gameDataToSave.referenceDate || gameDataToSave.created_at || cloudGame.createdAt,
            gameId: localId,
            winner_id: gameDataToSave.winner_id,
            final_scores: gameDataToSave.final_scores || {},
            player_ids: gameDataToSave.player_ids || []
          },
          savedAt: cloudGame.createdAt,
          lastPlayed: cloudGame.createdAt,
          playerCount: gameDataToSave.playerCount || (gameDataToSave.players || gameDataToSave.gameState?.players || []).length,
          roundsCompleted: gameDataToSave.roundsCompleted || gameDataToSave.total_rounds || 0,
          totalRounds: gameDataToSave.totalRounds || gameDataToSave.total_rounds || 0,
          mode: gameDataToSave.mode || 'Local',
          gameFinished: gameDataToSave.gameFinished || false,
          isPaused: gameDataToSave.isPaused || false,
          cloudGameId: cloudGame.id,
          uploadedToCloud: true,
          downloadedFromCloud: true,
          created_at: cloudGame.createdAt || gameDataToSave.created_at,
          // Top-level fields for compatibility
          winner_id: gameDataToSave.winner_id || gameDataToSave.gameState?.winner_id,
          final_scores: gameDataToSave.final_scores || gameDataToSave.gameState?.final_scores || {},
          player_ids: gameDataToSave.player_ids || gameDataToSave.gameState?.player_ids || [],
          round_data: gameDataToSave.round_data || gameDataToSave.roundData || gameDataToSave.gameState?.roundData || [],
          total_rounds: gameDataToSave.total_rounds || gameDataToSave.totalRounds || 0,
          duration_seconds: gameDataToSave.duration_seconds || 0,
          is_local: true
        };

        // Save to local storage
        LocalGameStorage.saveGame(localId, gameToSave);
        
        // Mark as uploaded to prevent re-uploading
        LocalGameStorage.markGameAsUploaded(localId, cloudGame.id);
        
        downloaded++;
      } catch (error) {
        console.error('Error downloading game:', error);
        errors++;
      }
    }

    return {
      success: true,
      total: cloudGameIds.length,
      downloaded,
      skipped,
      errors
    };
  } catch (error) {
    console.error('Error downloading selected cloud games:', error);
    throw error;
  }
}

/**
 * Download all cloud games for the logged-in user and save them locally
 * @returns {Promise<{success: boolean, downloaded: number, skipped: number, errors: number}>}
 */
export async function downloadUserCloudGames() {
  // Get all cloud games
  const cloudGamesList = await getUserCloudGamesList();
  
  // Download all of them
  const cloudGameIds = cloudGamesList.map(g => g.cloudId);
  return downloadSelectedCloudGames(cloudGameIds);
}

//=== Schema Migration and Validation ===//

/**
 * Migrates a game from old format to new schema
 * @param {Object} oldGame - Game in old format
 * @returns {Object} - Game in new schema format
 */
export function migrateGameToNewSchema(oldGame) {
  try {
    const newGame = migrateToNewSchema(oldGame);
    
    // Validate the migrated game
    const validation = validateGameSchema(newGame);
    if (!validation.isValid) {
      console.warn('Game migration validation failed:', validation.errors);
      // Return original if migration fails
      return oldGame;
    }
    
    return newGame;
  } catch (error) {
    console.error('Error migrating game schema:', error);
    return oldGame;
  }
}

/**
 * Converts new schema game to legacy format for backward compatibility
 * @param {Object} newGame - Game in new schema format
 * @returns {Object} - Game in legacy format
 */
export function convertToLegacyFormat(newGame) {
  try {
    return toLegacyFormat(newGame);
  } catch (error) {
    console.error('Error converting to legacy format:', error);
    return newGame;
  }
}

/**
 * Validates game data using both custom validation and JSON schema
 * @param {Object} gameData - Game data to validate
 * @returns {Object} - Validation result with combined errors
 */
export function validateGameData(gameData) {
  const customValidation = validateGameSchema(gameData);
  const jsonValidation = validateWithJsonSchema(gameData);
  
  return {
    isValid: customValidation.isValid && jsonValidation.isValid,
    errors: [...customValidation.errors, ...jsonValidation.errors],
    customValidation,
    jsonValidation
  };
}



// Get recent local games (this still works as it uses localStorage)
export async function getRecentLocalGames(limit = 5) {
  try {
    const games = LocalGameStorage.getAllSavedGames();
    const gamesList = Object.values(games);
    
    // Filter out paused games - only show finished games in recent games section
    const finishedGames = gamesList.filter(game => 
      !game.isPaused && (game.gameFinished || game.gameState?.gameFinished)
    );
    
    // Sort by lastPlayed or savedAt, whichever is available
    const sortedGames = finishedGames
      .sort((a, b) => {
        const dateA = new Date(a.lastPlayed || a.savedAt || a.created_at || '1970-01-01');
        const dateB = new Date(b.lastPlayed || b.savedAt || b.created_at || '1970-01-01');
        return dateB - dateA;
      })
      .slice(0, limit);
    
    const finalGames = sortedGames.map(game => ({
        ...game,
        // Ensure we have a created_at field for compatibility
        created_at: game.created_at || game.lastPlayed || game.savedAt || new Date().toISOString()
      }));
    
    return finalGames;
  } catch (error) {
    console.error('Error getting recent local games:', error);
    return [];
  }
}

// Get paused local games
export async function getPausedLocalGames(limit = 10) {
  try {
    const games = LocalGameStorage.getAllSavedGames();
    const gamesList = Object.values(games);
    
    // Filter to only show paused games
    const pausedGames = gamesList.filter(game => 
      game.isPaused || (game.gameState?.isPaused && !game.gameState?.gameFinished)
    );
    
    // Sort by lastPlayed or savedAt, whichever is available
    const sortedGames = pausedGames
      .sort((a, b) => {
        const dateA = new Date(a.lastPlayed || a.savedAt || a.created_at || '1970-01-01');
        const dateB = new Date(b.lastPlayed || b.savedAt || b.created_at || '1970-01-01');
        return dateB - dateA;
      })
      .slice(0, limit);
    
    const finalGames = sortedGames.map(game => ({
        ...game,
        // Ensure we have a created_at field for compatibility
        created_at: game.created_at || game.lastPlayed || game.savedAt || new Date().toISOString()
      }));
    
    return finalGames;
  } catch (error) {
    console.error('Error getting paused local games:', error);
    return [];
  }
}

// Get all local games (for settings page)
export async function getAllLocalGames() {
  try {
    const games = LocalGameStorage.getAllSavedGames();
    const gamesList = Object.values(games);
    
    // Sort by lastPlayed or savedAt, whichever is available
    const sortedGames = gamesList.sort((a, b) => {
      const dateA = new Date(a.lastPlayed || a.savedAt || a.created_at || '1970-01-01');
      const dateB = new Date(b.lastPlayed || b.savedAt || b.created_at || '1970-01-01');
      return dateB - dateA;
    });
    
    const finalGames = sortedGames.map(game => ({
        ...game,
        // Ensure we have a created_at field for compatibility
        created_at: game.created_at || game.lastPlayed || game.savedAt || new Date().toISOString()
      }));
    
    return finalGames;
  } catch (error) {
    console.error('Error getting all local games:', error);
    return [];
  }
}

// Create game
export async function createGame(gameData, localId) {
  const token = localStorage.getItem('auth_token');
  
  // Check if user is authenticated
  if (!token) {
    throw new Error('You must be logged in to sync games to the cloud. Please sign in and try again.');
  }

  const res = await fetch(API_ENDPOINTS.games.create, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ gameData, localId })
  });
  
  if (res.status === 401) {
    throw new Error('Your session has expired. Please sign in again to sync games to the cloud.');
  }
  
  if (!res.ok) throw new Error('Failed to create game');
  const data = await res.json();
  return data;
}

// Get player game history
// eslint-disable-next-line no-unused-vars
export async function getPlayerGameHistory(_id, _limit = 20) {
  console.warn('gameService: getPlayerGameHistory() - Server games feature not yet implemented with MongoDB backend');
  return [];
}

// Get game by ID
export async function getGameById(id) {
  // Try local first for compatibility
  const localGames = LocalGameStorage.getAllSavedGames();
  const localGame = localGames[id];
  if (localGame) return localGame;
  // Try backend
  const token = localStorage.getItem('auth_token');
  const res = await fetch(API_ENDPOINTS.games.getById(id), {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.game || null;
}

// Update game
// eslint-disable-next-line no-unused-vars
export async function updateGame(_id, _data) {
  console.warn('gameService: updateGame() - Server games feature not yet implemented with MongoDB backend');
  return null;
}

// Delete game
// eslint-disable-next-line no-unused-vars
export async function deleteGame(_id) {
  console.warn('gameService: deleteGame() - Server games feature not yet implemented with MongoDB backend');
  return false;
}

// Default export for compatibility with index.js
const gameService = {
  getGames,
  getRecentGames,
  getRecentLocalGames,
  getPausedLocalGames,
  getAllLocalGames,
  createGame,
  getPlayerGameHistory,
  getGameById,
  updateGame,
  deleteGame,
  getUserCloudGamesList,
  downloadSelectedCloudGames,
  downloadUserCloudGames,
  // New schema functions
  migrateGameToNewSchema,
  convertToLegacyFormat,
  validateGameData,
  // Removed MongoDB upload functions
  // Schema constants
  GameStatus,
  GameMode
};

export default gameService;