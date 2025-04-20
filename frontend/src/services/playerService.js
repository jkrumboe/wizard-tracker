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

//=== Get by Tag ===//

// Update the searchPlayersByTag function to handle non-JSON responses gracefully
export async function searchPlayersByTag(tag) {
  const response = await fetch(`/api/players/search?tag=${encodeURIComponent(tag)}`);
  if (!response.ok) {
    const text = await response.text();
    console.error(`API error: ${response.statusText}`, text);
    throw new Error(`API error: ${response.statusText}`);
  }
  const contentType = response.headers.get("Content-Type");
  if (contentType && contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch (error) {
      console.error('Failed to parse JSON response:', error);
      throw new Error('Invalid JSON response from API');
    }
  } else {
    const text = await response.text();
    console.error('Unexpected response format:', text);
    throw new Error('API did not return JSON');
  }
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
  return playerAPI.update(playerId, { tags });
}
