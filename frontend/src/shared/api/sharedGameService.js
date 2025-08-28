
// Shared game service for handling shared games using backend API and local storage

/**
 * Store a shared game reference in the backend
 * @param {Object} game - The game object to make shareable
 * @param {string} shareId - The unique share identifier
 * @returns {Promise<Object>} The shared game record
 */
export async function createSharedGameRecord(game, shareId) {
  // Save the game to the backend with the shareId as a property
  const token = localStorage.getItem('token');
  const res = await fetch('/api/games', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ gameData: { ...game, shareId } })
  });
  if (!res.ok) throw new Error('Failed to create shared game');
  const data = await res.json();
  return {
    success: true,
    shareId,
    gameId: data.game.id
  };
}

/**
 * Get the full game data for a shared game by shareId
 * @param {string} shareId - The share identifier
 * @returns {Promise<Object|null>} The complete game data
 */
export async function getSharedGameData(shareId) {
  // Find the game by shareId in the backend
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/games?shareId=${encodeURIComponent(shareId)}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!res.ok) return null;
  const data = await res.json();
  // Assume the first match is the shared game
  return data.games && data.games.length > 0 ? data.games[0].gameData : null;
}

/**
 * Import a shared game into local storage
 * @param {Object} gameData - The reconstructed game data
 * @param {Object} shareInfo - Information about the share (contains gameId, timestamp)
 * @returns {Promise<string>} The new local game ID
 */
export async function importSharedGame(gameData, shareInfo) {
  const { LocalGameStorage } = await import('../api/localGameStorage');
  try {
    // Check if this game was already imported
    const existingGames = LocalGameStorage.getAllSavedGames();
    const alreadyImported = Object.values(existingGames).some(game => {
      return game.originalGameId === shareInfo.gameId || 
             game.gameState?.originalGameId === shareInfo.gameId;
    });
    if (alreadyImported) {
      throw new Error('This game has already been imported');
    }
    // Create a new game ID for the imported game
    const newGameId = `shared_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // Prepare the game data for local storage
    const localGameData = {
      ...gameData,
      gameId: newGameId, // Add gameId field that LocalGameStorage expects
      // Mark as imported from share
      isShared: true,
      isImported: true,
      originalGameId: shareInfo.gameId,
      importedAt: new Date().toISOString(),
      sharedFrom: `Shared game from ${gameData.players?.find(p => p.id === gameData.winner_id)?.name || 'Unknown'}`,
      is_local: true,
      player_ids: gameData.players?.map(p => p.id) || []
    };
    // Save to local storage - saveGame(gameState, gameName, isPaused)
    const savedGameId = LocalGameStorage.saveGame(
      localGameData, 
      `Shared: ${gameData.players?.find(p => p.id === gameData.winner_id)?.name || 'Unknown'} won`, 
      false // isPaused = false since this is a finished game
    );
    return savedGameId;
  } catch (error) {
    console.error('Failed to import shared game:', error);
    throw new Error('Failed to import shared game');
  }
}


