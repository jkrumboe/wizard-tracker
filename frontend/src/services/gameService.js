import { gameAPI } from "./api";

// Get recent games
export async function getRecentGames(limit = 3) {
  return gameAPI.getRecent(limit);
}

// Get game by ID
export async function getGameById(id) {
  return gameAPI.getById(id);
}

// Get player's game history
export async function getPlayerGameHistory(playerId) {
  return gameAPI.getByPlayer(playerId);
}

// Create a new game
export async function createGame(gameData) {
  return gameAPI.create(gameData);
}

// Update game
export async function updateGame(id, gameData) {
  return gameAPI.update(id, gameData);
}

// Get all games
export async function getGames() {
  return gameAPI.getAll();
}



