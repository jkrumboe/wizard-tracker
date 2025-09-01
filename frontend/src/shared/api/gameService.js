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