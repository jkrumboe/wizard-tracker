/**
 * Sync Checker Utility
 * Checks if games exist both locally and in the cloud for sync status
 */

import { FrontendAppwriteGameUploader } from './appwriteGameUpload.js';
import { LocalGameStorage } from '../api/localGameStorage.js';

/**
 * Check if a game exists in the cloud by cloudLookupKey
 * @param {string} cloudLookupKey - The cloud lookup key to search for
 * @returns {Promise<boolean>} - True if game exists in cloud
 */
export async function checkCloudGameExists(cloudLookupKey) {
  if (!cloudLookupKey) {
    return false;
  }

  try {
    const uploader = new FrontendAppwriteGameUploader();
    await uploader.ensureAuthentication();
    
    const existingGames = await uploader.databases.listDocuments(
      uploader.config.databaseId,
      uploader.config.collections.games
    );

    return existingGames.documents.some(game => 
      game.cloudLookupKey === cloudLookupKey
    );
  } catch (error) {
    console.error('Error checking cloud game existence:', error);
    return false;
  }
}

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

    const cloudLookupKey = localGame.cloudLookupKey;
    let cloudExists = false;

    if (cloudLookupKey) {
      cloudExists = await checkCloudGameExists(cloudLookupKey);
      
      // If cloudLookupKey check failed, try content matching as fallback
      if (!cloudExists) {
        cloudExists = await checkCloudGameByContent(localGame);
      }
    } else {
      // No cloudLookupKey, check by cloudGameId or content matching
      if (localGame.isUploaded && localGame.cloudGameId) {
        cloudExists = await checkCloudGameExistsByGameId(localGame.cloudGameId);
      } else {
        cloudExists = await checkCloudGameByContent(localGame);
      }
    }

    // Determine sync status
    const localExists = true;
    const isSynced = localExists && cloudExists;
    
    let status;
    if (isSynced) {
      status = 'Synced';
    } else if (localGame.isUploaded && cloudExists) {
      status = 'Online';
    } else if (localGame.isUploaded && !cloudExists) {
      status = 'Online'; // Game marked as uploaded but cloud check failed
    } else {
      status = 'Local';
    }

    return {
      exists: true,
      local: localExists,
      cloud: cloudExists,
      synced: isSynced,
      status: status,
      isUploaded: localGame.isUploaded || false,
      cloudGameId: localGame.cloudGameId || null,
      cloudLookupKey: cloudLookupKey || null
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
 * Check if a game exists in the cloud by Appwrite game ID
 * @param {string} cloudGameId - The Appwrite game document ID
 * @returns {Promise<boolean>} - True if game exists in cloud
 */
export async function checkCloudGameExistsByGameId(cloudGameId) {
  if (!cloudGameId) {
    return false;
  }

  try {
    const uploader = new FrontendAppwriteGameUploader();
    await uploader.ensureAuthentication();
    
    await uploader.databases.getDocument(
      uploader.config.databaseId,
      uploader.config.collections.games,
      cloudGameId
    );

    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a game exists in the cloud by matching content
 * @param {Object} localGame - The local game object
 * @returns {Promise<boolean>} - True if game exists in cloud
 */
export async function checkCloudGameByContent(localGame) {
  try {
    const uploader = new FrontendAppwriteGameUploader();
    await uploader.ensureAuthentication();
    
    const existingGames = await uploader.databases.listDocuments(
      uploader.config.databaseId,
      uploader.config.collections.games
    );

    // Extract game data for comparison
    const gameData = localGame.gameState || localGame;
    const playerCount = gameData.players?.length || 0;
    const totalRounds = gameData.total_rounds || gameData.currentRound || gameData.maxRounds || 0;
    const finalScores = JSON.stringify(gameData.final_scores || {});

    const foundGame = existingGames.documents.find(cloudGame => {
      const samePlayerCount = cloudGame.playerIds?.length === playerCount;
      const sameTotalRounds = cloudGame.totalRounds === totalRounds;
      const sameFinalScores = cloudGame.finalScoresJson === finalScores;
      
      return samePlayerCount && sameTotalRounds && sameFinalScores;
    });

    if (foundGame) {
      // If we found a match and this local game doesn't have upload tracking,
      // update it to mark as uploaded with the found cloud game
      if (!localGame.isUploaded || !localGame.cloudGameId) {
        const { LocalGameStorage } = await import('../api/localGameStorage.js');
        const { generateCloudLookupKey } = await import('./gameIdentifier.js');
        
        const cloudLookupKey = generateCloudLookupKey(gameData);
        LocalGameStorage.markGameAsUploaded(localGame.id, foundGame.$id, cloudLookupKey);
      }
      
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking cloud game by content:', error);
    return false;
  }
}
