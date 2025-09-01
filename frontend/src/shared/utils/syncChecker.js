/**
 * Sync Checker Utility
 * Checks if games exist both locally and in the cloud for sync status
 */
import { LocalGameStorage } from '../api/localGameStorage.js';
import { API_ENDPOINTS } from '../api/config.js';

/**
 * Check sync status for a local game
 * @param {string} gameId - The local game ID
 * @returns {Promise<Object>} - Sync status object
 */
export async function checkGameSyncStatus(gameId) {
  try {
    const games = LocalGameStorage.getAllSavedGames();
    const localGame = games[gameId];
    
    if (!localGame) {
      return {
        exists: false,
        local: false,
        cloud: false,
        synced: false,
        status: 'Not Found'
      };
    }

    // Backend-only: Only check by cloudGameId (MongoDB _id)
    let cloudExists = false;
    if (localGame.isUploaded && localGame.cloudGameId) {
      cloudExists = await checkCloudGameExistsByGameId(localGame.cloudGameId);
    } else {
      // Content-based check is not supported, always return false
      cloudExists = false;
    }

    // Special handling for imported shared games
    const isImportedSharedGame = localGame.isImported || localGame.isShared || localGame.originalGameId;
    
    // Determine sync status
    const localExists = true;
    let isSynced;
    let status;
    
    if (isImportedSharedGame && localGame.isUploaded && localGame.cloudGameId) {
      // Imported shared games that are marked as uploaded should be considered synced
      isSynced = true;
      status = 'Synced';
    } else if (localExists && cloudExists) {
      isSynced = true;
      status = 'Synced';
    } else if (localGame.isUploaded && cloudExists) {
      isSynced = true;
      status = 'Synced'; // Game is uploaded and exists in cloud
    } else if (isImportedSharedGame) {
      // Imported games without proper sync should be treated as synced to prevent re-upload
      isSynced = true;
      status = 'Synced';
    } else {
      isSynced = false;
      status = 'Local'; // Treat upload-failed as local for badge/UI
    }

    return {
      exists: true,
      local: localExists,
      cloud: cloudExists,
      synced: isSynced,
      status: status,
  isUploaded: localGame.isUploaded || false,
  cloudGameId: localGame.cloudGameId || null
    };
  } catch (error) {
    console.error('Error checking game sync status:', error);
    return {
      exists: false,
      local: false,
      cloud: false,
      synced: false,
      status: 'Error'
    };
  }
}

/**
 * Check sync status for all local games
 * @returns {Promise<Object>} - Object with gameId as key and sync status as value
 */
export async function checkAllGamesSyncStatus() {
  try {
    const games = LocalGameStorage.getAllSavedGames();
    const gameIds = Object.keys(games);
    const syncStatuses = {};

    // Check each game's sync status
    for (const gameId of gameIds) {
      syncStatuses[gameId] = await checkGameSyncStatus(gameId);
    }

    return syncStatuses;
  } catch (error) {
    console.error('Error checking all games sync status:', error);
    return {};
  }
}

/**

/**
 * Check if a game exists in the backend by its MongoDB ID
 * @param {string} cloudGameId - The MongoDB game document ID
 * @returns {Promise<boolean>} - True if game exists in backend
 */
export async function checkCloudGameExistsByGameId(cloudGameId) {
  if (!cloudGameId) return false;
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(API_ENDPOINTS.games.getById(cloudGameId), {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.status === 404) {
      // Not found means not uploaded
      return false;
    }
    if (!res.ok) {
      let errorMsg = `Backend returned status ${res.status}`;
      try {
        const errJson = await res.json();
        errorMsg += `: ${JSON.stringify(errJson)}`;
      } catch { /* ignore JSON parse error for non-JSON responses */ }
      console.warn(`Game not found in backend for ID ${cloudGameId}. ${errorMsg}`);
      return false;
    }
    const data = await res.json();
    return !!data.game;
  } catch (err) {
    console.error(`Error checking game in backend for ID ${cloudGameId}:`, err);
    return false;
  }
}


/**

// Content-based cloud check is not supported with backend-only sync. Always return false.
export async function checkCloudGameByContent(localGame) {
  return false;
}*/
