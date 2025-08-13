// Game service - Appwrite migration in progress
// These are placeholder functions to prevent compilation errors

import { LocalGameStorage } from "@/shared/api/localGameStorage";
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
  console.warn('gameService: getGames() - Server games feature not yet implemented with Appwrite');
  return [];
}

// Get recent games
// eslint-disable-next-line no-unused-vars
export async function getRecentGames(_limit = 5) {
  console.warn('gameService: getRecentGames() - Server games feature not yet implemented with Appwrite');
  return [];
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
// eslint-disable-next-line no-unused-vars
export async function createGame(_data) {
  console.warn('gameService: createGame() - Server games feature not yet implemented with Appwrite');
  return null;
}

// Get player game history
// eslint-disable-next-line no-unused-vars
export async function getPlayerGameHistory(_id, _limit = 20) {
  console.warn('gameService: getPlayerGameHistory() - Server games feature not yet implemented with Appwrite');
  return [];
}

// Get game by ID
export async function getGameById(id) {
  try {
    // First, try to find the game in local storage
    const localGames = LocalGameStorage.getAllSavedGames();
    const localGame = localGames[id];
    
    if (localGame) {
      // Convert local game format to match expected game format
      const gameData = {
        id: localGame.id,
        name: localGame.name,
        created_at: localGame.created_at || localGame.savedAt,
        is_local: true,
        mode: localGame.mode || "Local",
        players: localGame.gameState?.players || [],
        winner_id: localGame.winner_id,
        final_scores: localGame.final_scores,
        round_data: localGame.round_data || localGame.gameState?.roundData,
        total_rounds: localGame.total_rounds || localGame.totalRounds,
        duration_seconds: localGame.duration_seconds,
        player_ids: localGame.player_ids || (localGame.gameState?.players?.map(p => p.id)) || [],
        game_mode: localGame.game_mode || localGame.mode || "Local",
        gameState: localGame.gameState,
        // Include metadata
        savedAt: localGame.savedAt,
        lastPlayed: localGame.lastPlayed,
        playerCount: localGame.playerCount,
        roundsCompleted: localGame.roundsCompleted,
        isPaused: localGame.isPaused,
        gameFinished: localGame.gameFinished
      };
      
      return gameData;
    }
    
    // TODO: If not found locally and online, try to fetch from Appwrite
    console.warn('gameService: getGameById() - Game not found in local storage, server lookup not yet implemented with Appwrite');
    return null;
  } catch (error) {
    console.error('Error getting game by ID:', error);
    return null;
  }
}

// Update game
// eslint-disable-next-line no-unused-vars
export async function updateGame(_id, _data) {
  console.warn('gameService: updateGame() - Server games feature not yet implemented with Appwrite');
  return null;
}

// Delete game
// eslint-disable-next-line no-unused-vars
export async function deleteGame(_id) {
  console.warn('gameService: deleteGame() - Server games feature not yet implemented with Appwrite');
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
  // Schema constants
  GameStatus,
  GameMode
};

export default gameService;