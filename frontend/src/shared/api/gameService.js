// Game service - Appwrite migration in progress
// These are placeholder functions to prevent compilation errors

import { LocalGameStorage } from "@/shared/api/localGameStorage";
import { filterGamesByDate, DATE_FILTER_OPTIONS } from "@/shared/utils/dateFilters";

//=== Game Management ===//

// Get all games
export async function getGames() {
  console.warn('gameService: getGames() - Supabase dependency removed, feature not yet implemented with Appwrite');
  return [];
}

// Get recent games
export async function getRecentGames(limit = 5) {
  console.warn('gameService: getRecentGames() - Supabase dependency removed, feature not yet implemented with Appwrite');
  return [];
}

// Get recent local games (this still works as it uses localStorage)
export async function getRecentLocalGames(limit = 5, dateFilter = DATE_FILTER_OPTIONS.ALL, customRange = null) {
  try {
    const games = LocalGameStorage.getAllSavedGames();
    const gamesList = Object.values(games);
    
    // Filter out paused games - only show finished games in recent games section
    const finishedGames = gamesList.filter(game => 
      !game.isPaused && (game.gameFinished || game.gameState?.gameFinished)
    );

    // Apply date filtering
    const dateFilteredGames = filterGamesByDate(finishedGames, dateFilter, customRange);
    
    // Sort by lastPlayed or savedAt, whichever is available
    const sortedGames = dateFilteredGames
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

// Get paused local games with date filtering
export async function getPausedLocalGames(limit = 10, dateFilter = DATE_FILTER_OPTIONS.ALL, customRange = null) {
  try {
    const games = LocalGameStorage.getAllSavedGames();
    const gamesList = Object.values(games);
    
    // Filter to only show paused games
    const pausedGames = gamesList.filter(game => 
      game.isPaused || (game.gameState?.isPaused && !game.gameState?.gameFinished)
    );

    // Apply date filtering
    const dateFilteredGames = filterGamesByDate(pausedGames, dateFilter, customRange);
    
    // Sort by lastPlayed or savedAt, whichever is available
    const sortedGames = dateFilteredGames
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

// Get all local games with date filtering (for settings page)
export async function getAllLocalGames(dateFilter = DATE_FILTER_OPTIONS.ALL, customRange = null) {
  try {
    const games = LocalGameStorage.getAllSavedGames();
    const gamesList = Object.values(games);
    
    // Apply date filtering
    const dateFilteredGames = filterGamesByDate(gamesList, dateFilter, customRange);
    
    // Sort by lastPlayed or savedAt, whichever is available
    const sortedGames = dateFilteredGames.sort((a, b) => {
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
export async function createGame(data) {
  console.warn('gameService: createGame() - Supabase dependency removed, feature not yet implemented with Appwrite');
  return null;
}

// Get player game history
export async function getPlayerGameHistory(id, limit = 20) {
  console.warn('gameService: getPlayerGameHistory() - Supabase dependency removed, feature not yet implemented with Appwrite');
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
export async function updateGame(id, data) {
  console.warn('gameService: updateGame() - Supabase dependency removed, feature not yet implemented with Appwrite');
  return null;
}

// Delete game
export async function deleteGame(id) {
  console.warn('gameService: deleteGame() - Supabase dependency removed, feature not yet implemented with Appwrite');
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
  deleteGame
};

export default gameService;