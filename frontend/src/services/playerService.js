import { playerAPI } from "./api";

// Get all players
export async function getPlayers() {
  return playerAPI.getAll();
}

// Get player by ID
export async function getPlayerById(id) {
  return playerAPI.getById(id);
}

// Create a new player
export async function createPlayer(playerData) {
  return playerAPI.create(playerData);
}

// Update player
export async function updatePlayer(id, playerData) {
  return playerAPI.update(id, playerData);
}

// Add a function to get player stats
export async function getPlayerStats(id) {
  return playerAPI.getStats(id);
}

