// Enhanced player service for new database schema with user-player separation
import { playerAPI, tagsAPI } from "@/shared/api/api";

//=== Get ALL ===//

// Get all players
export async function getPlayers() {
  return playerAPI.getAll();
}

// Get all tags
export async function getTags() {
  return tagsAPI.getAll();
}

//=== Get by ID ===//

// Get player by ID
export async function getPlayerById(id) {
  return playerAPI.getById(id);
}

// Get player stats (enhanced for new schema)
export async function getPlayerStats(id) {
  return playerAPI.getStats(id);
}

// Get player game history (enhanced for new schema)
export async function getPlayerGames(id, limit = 20) {
  return playerAPI.getGames(id, limit);
}

// Get tags by player ID
export async function getTagsByPlayerId(id) {
  return playerAPI.getTags(id);
}

// Get Elo history for a player
// export async function getEloHistory(id) {
//   return playerAPI.getEloHistory(id);
// }

//=== Get by Tag ===//

// Get players by tag
export async function searchPlayersByTag(tag) {
  return playerAPI.getByTag(tag);
}

//=== Creators ===//

// Create a new player (admin only)
export async function createPlayer(playerData) {
  return playerAPI.create(playerData);
}

//=== Updates ===//

// Update player
export async function updatePlayer(id, playerData) {
  return playerAPI.update(id, playerData);
}

// Update player profile (enhanced for new schema)
export async function updatePlayerProfile(playerData) {
  try {
    const response = await playerAPI.update(playerData.id, {
      name: playerData.name,
      display_name: playerData.display_name || playerData.name,
      avatar: playerData.avatar
    });
    return response;
  } catch (error) {
    console.error('Failed to update player profile:', error);
    throw error;
  }
}

// Update player tags
export async function updatePlayerTags(playerId, tags) {
  try {
    const response = await playerAPI.updateTags(playerId, { tags });
    return response;
  } catch (error) {
    console.error('Failed to update player tags:', error);
    throw error;
  }
}

//=== Deletes ===//

// Delete player (admin only)
export async function deletePlayer(id) {
  return playerAPI.delete(id);
}

// Export default for backward compatibility
export default {
  getPlayers,
  getTags,
  getPlayerById,
  getPlayerStats,
  getPlayerGames,
  getTagsByPlayerId,
  // getEloHistory,
  searchPlayersByTag,
  createPlayer,
  updatePlayer,
  updatePlayerProfile,
  updatePlayerTags,
  deletePlayer
};


