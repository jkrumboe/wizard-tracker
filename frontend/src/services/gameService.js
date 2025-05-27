// Enhanced game service for new database schema with multiplayer support
import { gameAPI, playerAPI, roomAPI } from "./api";

//=== Game Management ===//

// Get all games
export async function getGames() {
  return gameAPI.getAll();
}

// Get game by ID
export async function getGameById(id) {
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
  getActiveRooms,
  getRoomById,
  createRoom,
  joinRoom,
  leaveRoom,
  verifyRoomPassword
};
