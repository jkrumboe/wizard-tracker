// Utility to check and sync a game before sharing
import { checkGameSyncStatus } from '@/shared/utils/syncChecker';
import { uploadLocalGameToAppwrite } from '@/shared/api/gameService';

/**
 * Ensures a game is synced to the cloud before sharing.
 * If not synced, uploads it and waits for completion.
 * @param {string} gameId - The local game ID
 * @param {Object} gameData - The game object
 * @param {Function} setMessage - Optional callback to show messages
 * @returns {Promise<boolean>} - True if synced, false if failed
 */
export async function ensureGameSynced(gameId, gameData, setMessage) {
  try {
    const syncStatus = await checkGameSyncStatus(gameId);
    if (syncStatus?.status === 'Online' || syncStatus?.status === 'Synced') {
      return true;
    }
    if (setMessage) setMessage({ text: 'Syncing game to cloud before sharing...', type: 'info' });
    const uploadResult = await uploadLocalGameToAppwrite(gameId, { replaceExisting: false });
    if (!uploadResult.success) {
      if (setMessage) setMessage({ text: uploadResult.error || 'Failed to sync game before sharing.', type: 'error' });
      return false;
    }
    return true;
  } catch (error) {
    if (setMessage) setMessage({ text: `Failed to sync game before sharing: ${error.message}`, type: 'error' });
    return false;
  }
}
