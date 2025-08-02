// Game service - Appwrite migration in progress
// These are placeholder functions to prevent compilation errors

import { LocalGameStorage } from "@/shared/api/localGameStorage";

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
export async function getRecentLocalGames(limit = 5) {
  try {
    const games = LocalGameStorage.getAllGames();
    return Object.values(games)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting recent local games:', error);
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
  console.warn('gameService: getGameById() - Supabase dependency removed, feature not yet implemented with Appwrite');
  return null;
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
  createGame,
  getPlayerGameHistory,
  getGameById,
  updateGame,
  deleteGame
};

export default gameService;