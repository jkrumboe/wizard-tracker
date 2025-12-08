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

    // Special handling for imported shared games - treat them as synced without backend checks
    const isImportedSharedGame = localGame.isImported || localGame.isShared || localGame.originalGameId;
    
    if (isImportedSharedGame) {
      // Imported shared games should always be treated as synced
      // They reference the original shared game and shouldn't be re-uploaded
      return {
        exists: true,
        local: true,
        cloud: true, // Consider as cloud-synced since it's a shared game
        synced: true,
        status: 'Synced',
        isUploaded: true, // Mark as uploaded to prevent sync attempts
        cloudGameId: localGame.cloudGameId || localGame.originalGameId || null,
        isImported: true
      };
    }

    // Backend-only: Only check by cloudGameId (MongoDB _id)
    let cloudExists = false;
    if (localGame.isUploaded && localGame.cloudGameId) {
      cloudExists = await checkCloudGameExistsByGameId(localGame.cloudGameId);
      
      // Handle null return (no authentication)
      if (cloudExists === null) {
        // Can't verify with backend but game has cloud metadata
        // Trust local isUploaded flag for read-only status
        return {
          exists: true,
          local: true,
          cloud: 'unknown', // Can't verify without authentication
          synced: true, // Show as synced based on local metadata
          status: 'Synced',
          isUploaded: localGame.isUploaded || false,
          cloudGameId: localGame.cloudGameId || null,
          requiresAuth: true
        };
      }
      
      // If the game was marked as uploaded but doesn't exist in backend, 
      // reset the isUploaded flag to prevent mismatches
      if (cloudExists === false && localGame.isUploaded) {
        console.warn(`Game ${gameId} was marked as uploaded but not found in backend. Resetting isUploaded flag.`);
        const { LocalGameStorage } = await import('../api/localGameStorage.js');
        // Reset upload status in local storage
        const games = LocalGameStorage.getAllSavedGames();
        if (games[gameId]) {
          games[gameId].isUploaded = false;
          games[gameId].cloudGameId = null;
          games[gameId].uploadedAt = null;
          games[gameId].cloudLookupKey = null;
          localStorage.setItem('wizardTracker_localGames', JSON.stringify(games));
        }
        // Update local reference for this check
        localGame.isUploaded = false;
        localGame.cloudGameId = null;
      }
    } else {
      // Content-based check is not supported, always return false
      cloudExists = false;
    }
    
    // Determine sync status
    const localExists = true;
    let isSynced;
    let status;
    
    if (localExists && cloudExists) {
      isSynced = true;
      status = 'Synced';
    } else if (localGame.isUploaded && cloudExists) {
      isSynced = true;
      status = 'Synced'; // Game is uploaded and exists in cloud
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
 * Check if multiple games exist in the backend by their MongoDB IDs (batch operation)
 * @param {string[]} cloudGameIds - Array of MongoDB game document IDs
 * @returns {Promise<Object>} - Object mapping gameId to boolean (exists or not)
 */
export async function batchCheckCloudGamesExist(cloudGameIds) {
  if (!Array.isArray(cloudGameIds) || cloudGameIds.length === 0) {
    return {};
  }
  
  // Filter out invalid IDs
  const validIds = cloudGameIds.filter(id => id && typeof id === 'string' && id.length > 0);
  
  if (validIds.length === 0) {
    return {};
  }
  
  // Check authentication
  const token = localStorage.getItem('auth_token');
  if (!token) {
    // Return null for all games to indicate unknown status
    const results = {};
    validIds.forEach(id => { results[id] = null; });
    return results;
  }
  
  try {
    const res = await fetch(API_ENDPOINTS.games.batchCheck, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ gameIds: validIds })
    });
    
    if (res.status === 401) {
      console.warn('Authentication expired while batch checking cloud games');
      const results = {};
      validIds.forEach(id => { results[id] = null; });
      return results;
    }
    
    if (!res.ok) {
      console.warn(`Batch check failed with status ${res.status}`);
      return {};
    }
    
    const data = await res.json();
    return data.results || {};
  } catch (err) {
    console.error('Error batch checking games in backend:', err);
    return {};
  }
}

/**
 * Check sync status for multiple local games (batch operation)
 * @param {string[]} gameIds - Array of local game IDs
 * @returns {Promise<Object>} - Object mapping gameId to sync status
 */
export async function batchCheckGamesSyncStatus(gameIds) {
  try {
    const games = LocalGameStorage.getAllSavedGames();
    const syncStatuses = {};
    
    // Collect all cloud game IDs that need checking
    const cloudGameIds = [];
    const gameIdToCloudId = {};
    
    gameIds.forEach(gameId => {
      const localGame = games[gameId];
      if (!localGame) {
        syncStatuses[gameId] = {
          exists: false,
          local: false,
          cloud: false,
          synced: false,
          status: 'Not Found'
        };
        return;
      }
      
      // Handle imported shared games
      const isImportedSharedGame = localGame.isImported || localGame.isShared || localGame.originalGameId;
      if (isImportedSharedGame) {
        syncStatuses[gameId] = {
          exists: true,
          local: true,
          cloud: true,
          synced: true,
          status: 'Synced',
          isUploaded: true,
          cloudGameId: localGame.cloudGameId || localGame.originalGameId || null,
          isImported: true
        };
        return;
      }
      
      // Collect cloud game IDs for batch checking
      if (localGame.isUploaded && localGame.cloudGameId) {
        cloudGameIds.push(localGame.cloudGameId);
        gameIdToCloudId[gameId] = localGame.cloudGameId;
      } else {
        // Game not uploaded
        syncStatuses[gameId] = {
          exists: true,
          local: true,
          cloud: false,
          synced: false,
          status: 'Local',
          isUploaded: false,
          cloudGameId: null
        };
      }
    });
    
    // Batch check all cloud games
    if (cloudGameIds.length > 0) {
      const cloudResults = await batchCheckCloudGamesExist(cloudGameIds);
      
      // Map results back to game IDs
      Object.entries(gameIdToCloudId).forEach(([gameId, cloudGameId]) => {
        const localGame = games[gameId];
        const cloudExists = cloudResults[cloudGameId];
        
        if (cloudExists === null) {
          // Can't verify without authentication
          syncStatuses[gameId] = {
            exists: true,
            local: true,
            cloud: 'unknown',
            synced: true,
            status: 'Synced',
            isUploaded: localGame.isUploaded || false,
            cloudGameId: cloudGameId,
            requiresAuth: true
          };
        } else if (cloudExists === false && localGame.isUploaded) {
          // Game was marked as uploaded but doesn't exist - reset flags
          console.warn(`Game ${gameId} was marked as uploaded but not found in backend`);
          localGame.isUploaded = false;
          localGame.cloudGameId = null;
          localGame.uploadedAt = null;
          localGame.cloudLookupKey = null;
          localStorage.setItem('wizardTracker_localGames', JSON.stringify(games));
          
          syncStatuses[gameId] = {
            exists: true,
            local: true,
            cloud: false,
            synced: false,
            status: 'Local',
            isUploaded: false,
            cloudGameId: null
          };
        } else {
          // Normal sync status
          syncStatuses[gameId] = {
            exists: true,
            local: true,
            cloud: cloudExists,
            synced: cloudExists,
            status: cloudExists ? 'Synced' : 'Local',
            isUploaded: localGame.isUploaded || false,
            cloudGameId: cloudGameId
          };
        }
      });
    }
    
    return syncStatuses;
  } catch (error) {
    console.error('Error batch checking games sync status:', error);
    return {};
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
    
    // Use batch checking for better performance
    return await batchCheckGamesSyncStatus(gameIds);
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
  
  // Check authentication
  const token = localStorage.getItem('auth_token');
  if (!token) {
    // If not authenticated, we can't verify with the backend
    // Return null to indicate "unknown" rather than false
    // This allows the sync checker to rely on local isUploaded flag
    return null;
  }
  
  try {
    const res = await fetch(API_ENDPOINTS.games.getById(cloudGameId), {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.status === 404) {
      // Not found means not uploaded
      return false;
    }
    if (res.status === 401) {
      // Unauthorized - user session expired
      console.warn('Authentication expired while checking cloud game');
      return null; // Return null to indicate unknown status
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
    return null; // Return null to indicate unknown status
  }
}


/**

// Content-based cloud check is not supported with backend-only sync. Always return false.
export async function checkCloudGameByContent(localGame) {
  return false;
}*/
