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

// Get leaderboard data (public endpoint - no auth required)
export async function getLeaderboard(gameType = 'all') {
  const url = gameType && gameType !== 'all' 
    ? `${API_ENDPOINTS.games.leaderboard}?gameType=${encodeURIComponent(gameType)}`
    : API_ENDPOINTS.games.leaderboard;
  
  const res = await fetch(url);
  
  if (!res.ok) throw new Error('Failed to fetch leaderboard');
  const data = await res.json();
  return data;
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
      
      // Check if game exists locally by localId OR by cloudGameId
      const allLocalGames = LocalGameStorage.getAllSavedGames();
      const existsByLocalId = !!allLocalGames[localId];
      const existsByCloudId = Object.values(allLocalGames).some(game => 
        game.cloudGameId === cloudGame.id || 
        game.gameState?.cloudGameId === cloudGame.id
      );
      const existsLocally = existsByLocalId || existsByCloudId;
      
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
        existsLocally: existsLocally,
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
        
        // Check if game already exists locally - check by localId AND cloudGameId
        const allLocalGames = LocalGameStorage.getAllSavedGames();
        const existsByLocalId = !!allLocalGames[localId];
        const existsByCloudId = Object.values(allLocalGames).some(game => 
          game.cloudGameId === cloudGame.id || 
          game.gameState?.cloudGameId === cloudGame.id
        );
        
        if (existsByLocalId || existsByCloudId) {
          console.debug(`Game ${localId} (cloud ID: ${cloudGame.id}) already exists locally, skipping`);
          skipped++;
          continue;
        }

        // Extract the actual game data from cloud game
        const cloudGameData = cloudGame.gameData || cloudGame;
        
        // Determine the source of truth for game data
        const gameState = cloudGameData.gameState || {};
        const players = gameState.players || cloudGameData.players || [];
        const roundData = gameState.roundData || cloudGameData.round_data || cloudGameData.roundData || [];
        const currentRound = gameState.currentRound || roundData.length;
        const totalRounds = cloudGameData.total_rounds || cloudGameData.totalRounds || gameState.maxRounds || 0;
        
        // Determine if game is actually finished based on rounds completed
        const hasWinner = !!(cloudGameData.winner_id || gameState.winner_id);
        const allRoundsPlayed = currentRound >= totalRounds && totalRounds > 0;
        const isActuallyFinished = hasWinner || allRoundsPlayed || cloudGameData.gameFinished === true;
        
        console.debug(`Processing cloud game ${localId}:`, {
          currentRound,
          totalRounds,
          hasWinner,
          allRoundsPlayed,
          isActuallyFinished,
          cloudGameDataFinished: cloudGameData.gameFinished,
          cloudGameDataPaused: cloudGameData.isPaused
        });
        
        // Prepare the game data for local storage - use same structure as importSharedGame
        const localGameData = {
          ...cloudGameData,
          players: players, // Ensure players are at the root level
          gameId: localId, // Add gameId field that LocalGameStorage expects
          currentRound: currentRound,
          maxRounds: totalRounds,
          roundData: roundData,
          gameStarted: true,
          gameFinished: isActuallyFinished,
          isPaused: isActuallyFinished ? false : (cloudGameData.isPaused ?? false),
          mode: cloudGameData.mode || gameState.mode || 'Local',
          isLocal: true,
          referenceDate: cloudGameData.created_at || gameState.referenceDate || cloudGame.createdAt,
          winner_id: cloudGameData.winner_id || gameState.winner_id,
          final_scores: cloudGameData.final_scores || gameState.final_scores || {},
          player_ids: cloudGameData.player_ids || gameState.player_ids || players.map(p => p.id),
          round_data: roundData,
          total_rounds: totalRounds,
          duration_seconds: cloudGameData.duration_seconds || 0,
          is_local: true,
          downloadedFromCloud: true,
          cloudGameId: cloudGame.id,
          created_at: cloudGame.createdAt || cloudGameData.created_at
        };

        // Save using LocalGameStorage.saveGame like importSharedGame does
        const gameDate = cloudGame.createdAt || cloudGameData.created_at || cloudGameData.savedAt;
        const gameName = cloudGameData.name || `Game ${new Date(gameDate).toLocaleDateString()}`;
        const savedGameId = LocalGameStorage.saveGame(
          localGameData,
          gameName,
          !isActuallyFinished // isPaused = !isFinished
        );
        
        console.debug(`Saved game ${savedGameId} to localStorage using saveGame():`, {
          isPaused: !isActuallyFinished,
          gameFinished: isActuallyFinished,
          playerCount: players.length,
          rounds: `${currentRound}/${totalRounds}`
        });
        // Mark as uploaded to prevent re-uploading (same as importSharedGame)
        LocalGameStorage.markGameAsUploaded(savedGameId, cloudGame.id);
        
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