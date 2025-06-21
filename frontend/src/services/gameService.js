// Enhanced game service for new database schema with multiplayer support
import { gameAPI, playerAPI, roomAPI } from "./api";

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
    const storedGames = localStorage.getItem("wizardTracker_localGames");
    return storedGames ? JSON.parse(storedGames) : [];
  } catch (error) {
    console.error("Error loading local games:", error);
    return [];
  }
}

// Get recent local games
export function getRecentLocalGames(limit = 10) {
  const games = getLocalGames();
  // Sort by creation date (newest first)
  const sortedGames = games.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  // Return only the requested number of games
  return sortedGames.slice(0, limit);
}

// Get local game by ID
export function getLocalGameById(id) {
  const games = getLocalGames();
  return games.find(game => game.id === id);
}

// Remove local game
export function removeLocalGame(id) {
  const games = getLocalGames();
  const filteredGames = games.filter(game => game.id !== id);
  try {
    localStorage.setItem("wizardTracker_localGames", JSON.stringify(filteredGames));
    return true;
  } catch (error) {
    console.error("Error removing local game:", error);
    return false;  }
}

// Save a local game
export function saveLocalGame(gameData) {
  const games = getLocalGames();
  const gameWithId = {
    ...gameData,
    id: gameData.id || Date.now().toString(), // Ensure there's always an ID
    is_local: true // Ensure this is marked as local
  };
  games.push(gameWithId);
  try {
    localStorage.setItem("wizardTracker_localGames", JSON.stringify(games));
    return gameWithId;
  } catch (error) {
    console.error("Error saving local game:", error);
    return null;
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
