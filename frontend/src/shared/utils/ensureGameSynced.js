// Utility to check and sync a game before sharing
import { checkGameSyncStatus } from '@/shared/utils/syncChecker';
import { createGame } from '@/shared/api/gameService';
import { LocalGameStorage } from '@/shared/api/localGameStorage';

/**
 * Ensures a game is synced to the backend before sharing.
 * If not synced, uploads it and waits for completion.
 * @param {string} gameId - The local game ID
 * @param {Object} gameData - The game object
 * @param {Function} setMessage - Optional callback to show messages
 * @returns {Promise<boolean>} - True if synced, false if failed
 */
export async function ensureGameSynced(gameId, gameData, setMessage) {
  try {
    // Check authentication first
    const token = localStorage.getItem('token');
    if (!token) {
      if (setMessage) setMessage({ text: 'You must be logged in to sync games to the cloud. Please sign in and try again.', type: 'error' });
      return false;
    }

    if (setMessage) setMessage({ text: 'Checking sync status...', type: 'info' });
    
    // Check if this is an imported shared game - don't upload it
    if (gameData.isImported || gameData.isShared || gameData.originalGameId) {
      if (setMessage) setMessage({ text: 'Imported games are already synced', type: 'success' });
      return true;
    }
    
    // Check current sync status
    const syncStatus = await checkGameSyncStatus(gameId);
    
    if (syncStatus.synced) {
      if (setMessage) setMessage({ text: 'Game is already synced', type: 'success' });
      return true;
    }
    
    // If not synced, upload to backend
    if (setMessage) setMessage({ text: 'Uploading game to backend...', type: 'info' });
    
    const result = await createGame(gameData, gameId);
    
    if (result.duplicate) {
      // Mark as uploaded with existing cloud ID
      LocalGameStorage.markGameAsUploaded(gameId, result.game.id);
      if (setMessage) setMessage({ text: 'Game already exists in backend - marked as synced', type: 'success' });
      return true;
    } else {
      // Mark as uploaded with new cloud ID
      LocalGameStorage.markGameAsUploaded(gameId, result.game.id);
      if (setMessage) setMessage({ text: 'Game uploaded successfully', type: 'success' });
      return true;
    }
  } catch (error) {
    console.error('Error ensuring game synced:', error);
    if (setMessage) setMessage({ text: `Sync failed: ${error.message}`, type: 'error' });
    return false;
  }
}
