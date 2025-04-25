import { playerAPI } from "./api";

// Getters 

//=== Get ALL ===//

// Get all players
export async function getPlayers() {
  return playerAPI.getAll();
}

// Get all tags
export async function getTags() {
  return playerAPI.getTags();
}

//=== Get by ID ===//

// Get player by ID
export async function getPlayerById(id) {
  return playerAPI.getById(id);
}

// Add a function to get player stats
export async function getPlayerStats(id) {
  return playerAPI.getStats(id);
}

// Get tags by player ID
export async function getTagsByPlayerId(id){
  return await playerAPI.getTagsById(id);
};

// Get Elo history for a player
export async function getEloHistory(id) {
  return await playerAPI.getElo(id);
}

//=== Get by Tag ===//

// Get players by tag
export async function searchPlayersByTag(tag) {
  return await playerAPI.getbyTag(tag);

}

//=== Creators ===//

// Create a new player
export async function createPlayer(playerData) {
  return playerAPI.create(playerData);
}

//=== Updateds ===//

// Update player
export async function updatePlayer(id, playerData) {
  return playerAPI.update(id, playerData);
}

// Update player profile
export async function updatePlayerProfile(playerData) {
  return playerAPI.update(playerData.id, playerData);
}

// Update player tags
export async function updatePlayerTags(playerId, tags) {
  return playerAPI.updateTags(playerId, { tags });
}
