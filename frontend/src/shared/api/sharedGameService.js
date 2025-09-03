
// Shared game service for handling shared games using MongoDB backend

/**
 * Store a shared game reference in the backend
 * @param {Object} game - The game object to make shareable
 * @param {string} shareId - The unique share identifier
 * @returns {Promise<Object>} The shared game record
 */
export async function createSharedGameRecord(game, shareId) {
  try {
    const token = localStorage.getItem('auth_token');
    
    // Check authentication
    if (!token) {
      throw new Error('You must be logged in to share games. Please sign in and try again.');
    }
    
    // First, find the game by its cloud ID or local ID
    let gameId = game.cloudGameId || game.id;
    
    // Make the game shareable by updating it with shareId
    const res = await fetch(`/api/games/${gameId}/share`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ shareId })
    });
    
    if (res.status === 401) {
      throw new Error('Your session has expired. Please sign in again to share games.');
    }
    
    if (!res.ok) {
      throw new Error('Failed to create shared game record');
    }
    
    const data = await res.json();
    return {
      success: true,
      shareId,
      gameId: data.game.id
    };
  } catch (error) {
    console.error('Failed to create shared game record:', error);
    throw error;
  }
}

/**
 * Get the full game data for a shared game by shareId
 * @param {string} shareId - The share identifier
 * @returns {Promise<Object|null>} The complete game data
 */
export async function getSharedGameData(shareId) {
  try {
    const res = await fetch(`/api/games/shared/${encodeURIComponent(shareId)}`);
    if (!res.ok) {
      if (res.status === 404) {
        return null; // Game not found
      }
      throw new Error('Failed to fetch shared game');
    }
    
    const data = await res.json();
    return data.game?.gameData || null;
  } catch (error) {
    console.error('Failed to get shared game data:', error);
    return null;
  }
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
    const gameIdToCheck = shareInfo.shareId || shareInfo.gameId || shareInfo.originalGameId;
    const alreadyImported = Object.values(existingGames).some(game => {
      return game.originalGameId === gameIdToCheck || 
             game.gameState?.originalGameId === gameIdToCheck ||
             game.cloudGameId === gameIdToCheck;
    });
    if (alreadyImported) {
      throw new Error('You already have this game in your collection. Check your game list to find it.');
    }
    
    // Create a new game ID for the imported game
    const newGameId = `shared_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Extract players from the correct location
    const players = gameData.players || gameData.gameState?.players || [];
    
    // Prepare the game data for local storage
    const localGameData = {
      ...gameData,
      players: players, // Ensure players are at the root level for compatibility
      gameId: newGameId, // Add gameId field that LocalGameStorage expects
      // Mark as imported from share
      isShared: true,
      isImported: true,
      originalGameId: gameIdToCheck,
      importedAt: new Date().toISOString(),
      sharedFrom: `Shared game from ${players.find(p => p.id === gameData.winner_id)?.name || 'Unknown'}`,
      is_local: true,
      player_ids: players.map(p => p.id) || []
    };
    
    // Save to local storage - saveGame(gameState, gameName, isPaused)
    const savedGameId = LocalGameStorage.saveGame(
      localGameData, 
      `Shared: ${players.find(p => p.id === gameData.winner_id)?.name || 'Unknown'} won`, 
      false // isPaused = false since this is a finished game
    );
    
    // IMPORTANT: Mark the imported game as uploaded/synced to prevent duplicate uploads
    // Use the original shareId as the cloudGameId to establish the link
    LocalGameStorage.markGameAsUploaded(savedGameId, shareInfo.shareId || shareInfo.gameId || shareInfo.originalGameId, null);
    
    console.debug(`Imported shared game ${savedGameId} and marked as synced with cloud ID: ${shareInfo.shareId || shareInfo.gameId || shareInfo.originalGameId}`);
    
    return savedGameId;
  } catch (error) {
    console.error('Failed to import shared game:', error);
    throw new Error('Failed to import shared game');
  }
}


