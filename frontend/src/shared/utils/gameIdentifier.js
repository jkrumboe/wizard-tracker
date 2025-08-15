/**
 * Game identification and duplicate detection utilities
 */

/**
 * Generate a content-based hash for a game to detect duplicates
 * This creates a unique identifier based on game data rather than just timestamp
 */
export function generateGameContentHash(gameData) {
  // Handle different data structures - sometimes players is in gameState
  let players = gameData.players;
  if (!players && gameData.gameState?.players) {
    players = gameData.gameState.players;
  }
  
  // Safely handle players array
  const playersData = Array.isArray(players) 
    ? players.map(p => ({ id: p.id, name: p.name })).sort((a, b) => a.id.localeCompare(b.id))
    : [];

  // Extract key game data that makes a game unique
  const gameContent = {
    players: playersData,
    totalRounds: gameData.total_rounds || gameData.maxRounds || gameData.gameState?.maxRounds,
    gameMode: gameData.game_mode || gameData.mode || gameData.gameState?.mode,
    finalScores: gameData.final_scores || gameData.gameState?.final_scores,
    winnerId: gameData.winner_id || gameData.gameState?.winner_id,
    createdAt: gameData.created_at || gameData.gameState?.created_at,
    durationSeconds: gameData.duration_seconds || gameData.gameState?.duration_seconds,
    roundData: (gameData.round_data || gameData.gameState?.roundData)?.map(round => ({
      round: round.round,
      cards: round.cards,
      players: Array.isArray(round.players) 
        ? round.players.map(p => ({
            id: p.id,
            call: p.call,
            made: p.made,
            score: p.score,
            totalScore: p.totalScore
          })).sort((a, b) => a.id.localeCompare(b.id))
        : []
    }))
  };

  // Create a stable string representation for hashing
  const contentString = JSON.stringify(gameContent);
  
  // Simple hash function (for more robust hashing, consider using crypto.subtle.digest)
  let hash = 0;
  for (let i = 0; i < contentString.length; i++) {
    const char = contentString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Return as hex string
  return Math.abs(hash).toString(16);
}

/**
 * Generate a unique game identifier combining timestamp and content hash
 */
export function generateUniqueGameId(gameData) {
  const timestamp = new Date(
    gameData.created_at || 
    gameData.gameState?.created_at || 
    Date.now()
  ).getTime();
  const contentHash = generateGameContentHash(gameData);
  return `game_${timestamp}_${contentHash}`;
}

/**
 * Create a cloud lookup key for duplicate detection
 * This is a more deterministic identifier for finding existing games in the cloud
 */
export function generateCloudLookupKey(gameData) {
  // Handle different data structures - sometimes players is in gameState
  let players = gameData.players;
  if (!players && gameData.gameState?.players) {
    players = gameData.gameState.players;
  }

  // Create a key based on game content that should be the same for identical games
  const keyData = {
    players: Array.isArray(players) 
      ? players.map(p => p.name).sort().join('|')
      : '',
    totalRounds: gameData.total_rounds || gameData.maxRounds || gameData.gameState?.maxRounds,
    gameMode: gameData.game_mode || gameData.mode || gameData.gameState?.mode,
    finalScores: gameData.final_scores || gameData.gameState?.final_scores,
    createdAt: gameData.created_at || gameData.gameState?.created_at,
    durationSeconds: gameData.duration_seconds || gameData.gameState?.duration_seconds
  };
  
  return `lookup_${generateGameContentHash(keyData)}`;
}

/**
 * Check if two games are duplicates based on content
 */
export function areGamesDuplicate(game1, game2) {
  const hash1 = generateGameContentHash(game1);
  const hash2 = generateGameContentHash(game2);
  return hash1 === hash2;
}

export default {
  generateGameContentHash,
  generateUniqueGameId,
  generateCloudLookupKey,
  areGamesDuplicate
};
