// Utility to check and sync a game before sharing
import { checkGameSyncStatus } from '@/shared/utils/syncChecker';

/**
 * Ensures a game is synced to the cloud before sharing.
 * If not synced, uploads it and waits for completion.
 * @param {string} gameId - The local game ID
 * @param {Object} gameData - The game object
 * @param {Function} setMessage - Optional callback to show messages
 * @returns {Promise<boolean>} - True if synced, false if failed
 */
export async function ensureGameSynced(gameId, gameData, setMessage) {
  // Cloud sync/upload to Appwrite is no longer supported.
  if (setMessage) setMessage({ text: 'Cloud sync is not supported. Please migrate this feature to use the backend.', type: 'error' });
  return false;
}
