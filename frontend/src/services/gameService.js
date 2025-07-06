// Enhanced game service for new database schema with multiplayer support
import { gameAPI, playerAPI, roomAPI } from "./api";
import { LocalGameStorage } from "./localGameStorage";

//=== Game Management ===//

// Get all games
export async function getGames() {
  return gameAPI.getAll();
}

// Get game by ID (works for both local and server games)
export async function getGameById(id) {
  // First check if it's a local game ID (string format)
  const localGames = getLocalGames();
  const localGame = localGames.find(game => game.id.toString() === id.toString());
  if (localGame) {
    return localGame;
  }
  // If not found locally, try getting from server
  return gameAPI.getById(id);
}

// Get recent games
export async function getRecentGames(limit = 10) {
  return gameAPI.getRecent(limit);
}

// Get multiplayer game history
export async function getMultiplayerGames(limit = 10, offset = 0) {
  return gameAPI.getMultiplayer(limit, offset);
}

// Get player's game history
export async function getPlayerGameHistory(playerId, limit = 20) {
  return playerAPI.getGames(playerId, limit);
}

// Create a new game
export async function createGame(gameData) {
  return gameAPI.create(gameData);
}

// Update game
export async function updateGame(id, gameData) {
  return gameAPI.update(id, gameData);
}

// Local game management functions
export function getLocalGames() {
  try {
    // Use LocalGameStorage service to get consistent format
    // LocalGameStorage is already imported at the top of the file
    
    // Get games list and filter to only finished games
    const allGames = LocalGameStorage.getSavedGamesList();
    const finishedGames = allGames.filter(game => game.gameFinished === true);
    
    // Ensure games have all required properties for display
    const formattedGames = finishedGames.map(game => ({
      id: game.id,
      created_at: game.created_at || game.savedAt || new Date().toISOString(),
      player_ids: game.player_ids || 
                 (game.gameState && game.gameState.player_ids) || 
                 (game.gameState && game.gameState.players && game.gameState.players.map(p => p.id)) || [],
      players: game.gameState ? game.gameState.players : game.players || [],
      winner_id: game.winner_id || (game.gameState && game.gameState.winner_id),
      final_scores: game.final_scores || (game.gameState && game.gameState.final_scores),
      round_data: game.round_data || (game.gameState && game.gameState.roundData) || [],
      total_rounds: game.total_rounds || game.totalRounds || (game.gameState && game.gameState.maxRounds) || 0,
      game_mode: game.game_mode || game.mode || (game.gameState && game.gameState.mode) || "Local",
      is_local: true,
      // Include gameState for access to player data
      gameState: game.gameState
    }));
    
    return formattedGames;
  } catch (error) {
    console.error("Error loading local games:", error);
    
    // Fallback to the old method
    try {
      const storedGames = localStorage.getItem("wizardTracker_localGames");
      if (!storedGames) return [];
      
      const parsedData = JSON.parse(storedGames);
      
      // Handle object-based storage (new format from LocalGameStorage)
      if (!Array.isArray(parsedData) && typeof parsedData === 'object' && parsedData !== null) {
        // Convert object to array format for compatibility
        const gamesArray = Object.values(parsedData)
          .filter(game => game && game.id && (game.gameFinished || (game.gameState && game.gameState.gameFinished)))
          .map(game => ({
            id: game.id,
            created_at: game.savedAt || game.lastPlayed || new Date().toISOString(),
            players: game.gameState ? game.gameState.players : game.players || [],
            round_data: game.gameState ? game.gameState.roundData : game.roundData || [],
            total_rounds: game.gameState ? game.gameState.maxRounds : game.totalRounds || 0,
            game_mode: game.gameState ? game.gameState.mode : game.mode || "Local",
            is_local: true
          }));
        
        return gamesArray;
      }
      
      // Handle array-based storage (old format)
      return Array.isArray(parsedData) ? parsedData : [];
    } catch (innerError) {
      console.error("Error in fallback loading:", innerError);
      return [];
    }
  }
}

// Get recent local games
export function getRecentLocalGames(limit = 10) {
  const games = getLocalGames();
  // Ensure games is an array
  if (!Array.isArray(games)) {
    console.warn('getLocalGames did not return an array:', games);
    return [];
  }
  
  // Ensure each game has a created_at property (for sorting)
  const gamesWithDates = games.map(game => {
    if (!game.created_at) {
      // Use any available date property or current date as fallback
      game.created_at = game.lastPlayed || game.savedAt || new Date().toISOString();
    }
    return game;
  });
  
  // Sort by creation date (newest first)
  const sortedGames = gamesWithDates.sort((a, b) => {
    const dateA = new Date(a.created_at || 0);
    const dateB = new Date(b.created_at || 0);
    return dateB - dateA;
  });
  
  // Return only the requested number of games
  return sortedGames.slice(0, limit);
}

// Get local game by ID
export function getLocalGameById(id) {
  try {
    // Try to get the game from LocalGameStorage first
    const game = LocalGameStorage.loadGame(id);
    if (game) {
      // Convert to the expected format
      return {
        id: id,
        created_at: game.savedAt || game.lastPlayed || new Date().toISOString(),
        players: game.players || [],
        round_data: game.roundData || [],
        total_rounds: game.maxRounds || 0,
        game_mode: game.mode || "Local",
        is_local: true
      };
    }
    
    // Fallback to old method
    const games = getLocalGames();
    return games.find(game => game.id === id);
  } catch (error) {
    console.error("Error getting local game by ID:", error);
    
    // Fallback to old method
    const games = getLocalGames();
    return games.find(game => game.id === id);
  }
}

// Remove local game
export function removeLocalGame(id) {
  try {
    // Use LocalGameStorage to delete the game
    LocalGameStorage.deleteGame(id);
    return true;
  } catch (error) {
    console.error("Error removing local game:", error);
    
    // Fallback to the old method if there's an error
    try {
      const games = getLocalGames();
      const filteredGames = games.filter(game => game.id !== id);
      localStorage.setItem("wizardTracker_localGames", JSON.stringify(filteredGames));
      return true;
    } catch (fallbackError) {
      console.error("Error in fallback remove:", fallbackError);
      return false;
    }
  }
}

// LocalGameStorage is already imported at the top of the file

// Save a local game
export function saveLocalGame(gameData) {
  // Use our LocalGameStorage service for saving games
  try {
    // Format the game data to be compatible with LocalGameStorage
    const gameWithId = {
      ...gameData,
      id: gameData.id || Date.now().toString(), // Ensure there's always an ID
      is_local: true, // Ensure this is marked as local
      gameFinished: true // Mark this as a finished game
    };
    
    // Save using LocalGameStorage service
    const gameId = LocalGameStorage.saveGame(
      { 
        ...gameWithId,
        players: gameWithId.players || [],
        currentRound: 1,
        maxRounds: gameWithId.total_rounds || 20,
        roundData: gameWithId.round_data || [],
        gameStarted: true,
        gameFinished: true,
        mode: gameWithId.game_mode || "Local",
        isLocal: true
      }, 
      `Game from ${new Date().toLocaleDateString()}`,
      false  // This is a finished game, not a paused game
    );
    
    // Return the saved game data with the assigned ID
    return { ...gameWithId, id: gameId };
  } catch (error) {
    console.error("Error saving local game:", error);
    
    // Fallback to the old method if there's an error
    const games = getLocalGames();
    const gameWithId = {
      ...gameData,
      id: gameData.id || Date.now().toString(),
      is_local: true
    };
    games.push(gameWithId);
    try {
      localStorage.setItem("wizardTracker_localGames", JSON.stringify(games));
      return gameWithId;
    } catch (innerError) {
      console.error("Error in fallback save:", innerError);
      return null;
    }
  }
}

//=== Room/Multiplayer Management ===//

// Get active rooms
export async function getActiveRooms() {
  return roomAPI.getActive();
}

// Get room by ID
export async function getRoomById(id) {
  return roomAPI.getById(id);
}

// Create a new room
export async function createRoom(roomData) {
  return roomAPI.create(roomData);
}

// Join a room
export async function joinRoom(roomId) {
  return roomAPI.join(roomId);
}

// Leave a room
export async function leaveRoom(roomId) {
  return roomAPI.leave(roomId);
}

// Verify room password for private rooms
export async function verifyRoomPassword(roomId, password) {
  return roomAPI.verifyPassword(roomId, password);
}

// Export default for backward compatibility
export default {
  getGames,
  getGameById,
  getRecentGames,
  getMultiplayerGames,
  getPlayerGameHistory,
  createGame,
  updateGame,
  getLocalGames,
  getLocalGameById,
  saveLocalGame,
  removeLocalGame,
  getActiveRooms,
  getRoomById,
  createRoom,
  joinRoom,
  leaveRoom,
  verifyRoomPassword
};
