// Table Game Service - Backend API calls for table games

import { API_ENDPOINTS } from "@/shared/api/config";
import { LocalTableGameStorage } from "@/shared/api/localTableGameStorage";

/**
 * Create/upload a table game to the backend
 * @param {Object} gameData - The table game data
 * @param {string} localId - The local game ID
 * @returns {Promise<Object>} - The created game data
 */
export async function createTableGame(gameData, localId) {
  const token = localStorage.getItem('auth_token');
  
  // Check if user is authenticated
  if (!token) {
    throw new Error('You must be logged in to sync table games to the cloud. Please sign in and try again.');
  }

  const res = await fetch(API_ENDPOINTS.tableGames.create, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ gameData, localId })
  });
  
  if (res.status === 401) {
    throw new Error('Your session has expired. Please sign in again to sync table games to the cloud.');
  }
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create table game');
  }
  
  const data = await res.json();
  return data;
}

/**
 * Get user's cloud table games list (metadata only) with local existence check
 * @returns {Promise<Array>} List of cloud table games with metadata
 */
export async function getUserCloudTableGamesList() {
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    throw new Error('You must be logged in to access cloud table games');
  }

  try {
    const res = await fetch(`${API_ENDPOINTS.tableGames.list}?allGames=true`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.status === 401) {
      throw new Error('Your session has expired. Please sign in again.');
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch cloud table games (${res.status})`);
    }

    const data = await res.json();
    const cloudGames = data.games || [];
    
    // Return games with metadata for selection, checking local existence
    return cloudGames.map(cloudGame => {
      const localId = cloudGame.localId || cloudGame._id;
      
      // Check if game exists locally by localId OR by cloudGameId
      const allLocalGames = LocalTableGameStorage.getAllSavedTableGames();
      const existsByLocalId = !!allLocalGames[localId];
      const existsByCloudId = Object.values(allLocalGames).some(game => 
        game.cloudGameId === cloudGame._id
      );
      const existsLocally = existsByLocalId || existsByCloudId;
      
      return {
        cloudId: cloudGame._id,
        localId: localId,
        name: cloudGame.name || cloudGame.gameData?.gameName || 'Table Game',
        gameTypeName: cloudGame.gameTypeName || cloudGame.gameData?.gameName,
        players: cloudGame.gameData?.players || [],
        playerCount: cloudGame.playerCount || 0,
        totalRounds: cloudGame.totalRounds || 0,
        gameFinished: cloudGame.gameFinished || false,
        created_at: cloudGame.createdAt,
        existsLocally: existsLocally,
        rawData: cloudGame // Keep raw data for download
      };
    });
  } catch (error) {
    console.error('Error fetching cloud table games list:', error);
    throw error;
  }
}

/**
 * Get a specific table game - checks local storage first, then cloud
 * @param {string} gameId - The game ID (can be local ID or cloud ID)
 * @param {Object} options - Options for fetching
 * @param {boolean} options.preferCloud - If true, check cloud first when online
 * @returns {Promise<Object>} - The game data
 */
export async function getTableGameById(gameId, options = {}) {
  const { preferCloud = false } = options;
  
  // Try local first (unless preferCloud is true)
  if (!preferCloud) {
    const localGame = LocalTableGameStorage.getTableGameById(gameId);
    if (localGame) {
      return { ...localGame, is_local: true };
    }
  }
  
  // Try cloud if online
  if (navigator.onLine) {
    const token = localStorage.getItem('auth_token');
    
    // Use authenticated endpoint if logged in, otherwise use public endpoint
    const endpoint = token 
      ? API_ENDPOINTS.tableGames.getById(gameId)
      : API_ENDPOINTS.tableGames.getPublicById(gameId);
    
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(endpoint, {
        method: 'GET',
        headers
      });

      if (res.ok) {
        const data = await res.json();
        if (data.game) {
          // Transform cloud game to match local format
          const cloudGame = data.game;
          return {
            id: cloudGame._id || cloudGame.id || gameId,
            cloudId: cloudGame._id || cloudGame.id,
            localId: cloudGame.localId,
            name: cloudGame.name || cloudGame.gameTypeName || 'Table Game',
            gameData: cloudGame.gameData || {},
            gameFinished: cloudGame.gameFinished || false,
            createdAt: cloudGame.createdAt,
            is_local: false,
            is_cloud: true
          };
        }
      } else {
        // Log non-ok responses for debugging
        console.debug(`Table game fetch returned ${res.status} for ID: ${gameId}`);
      }
    } catch (error) {
      console.debug('Error fetching cloud table game:', error.message);
    }
  }
  
  // If preferCloud was true but cloud failed, try local as fallback
  if (preferCloud) {
    const localGame = LocalTableGameStorage.getTableGameById(gameId);
    if (localGame) {
      return { ...localGame, is_local: true };
    }
  }
  
  return null;
}

/**
 * Get a specific table game from the backend only (for cloud-only operations)
 * @param {string} gameId - The cloud game ID
 * @returns {Promise<Object>} - The game data
 */
export async function getCloudTableGameById(gameId) {
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    throw new Error('You must be logged in to access cloud table games.');
  }

  const res = await fetch(API_ENDPOINTS.tableGames.getById(gameId), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (res.status === 401) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  if (res.status === 404) {
    throw new Error('Table game not found (404)');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch table game');
  }

  const data = await res.json();
  return data.game;
}

/**
 * Download selected cloud table games and save them locally
 * @param {Array<string>} cloudGameIds - Array of cloud game IDs to download
 * @returns {Promise<{success: boolean, downloaded: number, skipped: number, errors: number}>}
 */
export async function downloadSelectedCloudTableGames(cloudGameIds) {
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    throw new Error('You must be logged in to download cloud table games');
  }

  if (!Array.isArray(cloudGameIds) || cloudGameIds.length === 0) {
    return { success: true, downloaded: 0, skipped: 0, errors: 0 };
  }

  try {
    // Get all cloud table games first
    const cloudGamesList = await getUserCloudTableGamesList();
    
    let downloaded = 0;
    let skipped = 0;
    let errors = 0;

    for (const cloudGameId of cloudGameIds) {
      try {
        // Find the game in the list
        const cloudGameMeta = cloudGamesList.find(g => g.cloudId === cloudGameId);
        
        if (!cloudGameMeta) {
          console.warn(`Cloud table game ${cloudGameId} not found`);
          errors++;
          continue;
        }

        const cloudGame = cloudGameMeta.rawData;
        const localId = cloudGame.localId || cloudGame._id;
        
        // Check if game already exists locally
        const allLocalGames = LocalTableGameStorage.getAllSavedTableGames();
        const existsByLocalId = !!allLocalGames[localId];
        const existsByCloudId = Object.values(allLocalGames).some(game => 
          game.cloudGameId === cloudGame._id
        );
        
        if (existsByLocalId || existsByCloudId) {
          console.debug(`Table game ${localId} (cloud ID: ${cloudGame._id}) already exists locally, skipping`);
          skipped++;
          continue;
        }

        // Extract game data
        const gameData = cloudGame.gameData || {};
        const players = gameData.players || [];
        
        // Prepare the game data for local storage
        const localGameData = {
          ...gameData,
          downloadedFromCloud: true,
          cloudGameId: cloudGame._id,
          created_at: cloudGame.createdAt
        };

        // Save using LocalTableGameStorage.saveTableGame
        const gameName = cloudGame.name || gameData.gameName || `Table Game - ${new Date(cloudGame.createdAt).toLocaleDateString()}`;
        const savedGameId = LocalTableGameStorage.saveTableGame(localGameData, gameName);
        
        console.debug(`Saved table game ${savedGameId} to localStorage:`, {
          playerCount: players.length,
          gameFinished: gameData.gameFinished
        });
        
        // Mark as uploaded to prevent re-uploading
        LocalTableGameStorage.markGameAsUploaded(savedGameId, cloudGame._id);
        
        downloaded++;
      } catch (error) {
        console.error('Error downloading table game:', error);
        errors++;
      }
    }

    return {
      success: true,
      total: cloudGameIds.length,
      downloaded,
      skipped,
      errors
    };
  } catch (error) {
    console.error('Error downloading selected cloud table games:', error);
    throw error;
  }
}
