/**
 * @fileoverview Sync Metadata Schema
 * Defines the structure for tracking synchronization state
 */

/**
 * @typedef {Object} SyncMetadata
 * @property {string} gameId - ID of the game this metadata belongs to
 * @property {number} lastSyncedVersion - Last version successfully synced to server
 * @property {number} lastServerAck - Last server acknowledgment timestamp
 * @property {string} syncStatus - Current sync status
 * @property {number} pendingEventsCount - Number of unacknowledged events
 * @property {number} lastAttemptTimestamp - Last sync attempt timestamp
 * @property {number} [nextRetryTimestamp] - When to retry sync (for exponential backoff)
 * @property {number} retryCount - Number of consecutive retry attempts
 * @property {string} [lastError] - Last sync error message
 * @property {boolean} hasConflict - Whether there's a conflict requiring resolution
 * @property {number} storageUsed - Bytes used in IndexedDB for this game
 */

/**
 * Sync status values
 */
export const SyncStatus = {
  SYNCED: 'synced',           // All changes synced
  PENDING: 'pending',         // Changes waiting to sync
  SYNCING: 'syncing',         // Actively syncing
  CONFLICT: 'conflict',       // Conflict detected
  ERROR: 'error',             // Sync error occurred
  OFFLINE: 'offline',         // No network connectivity
  PAUSED: 'paused'           // Sync paused by user
};

/**
 * Creates new sync metadata
 * @param {Object} params - Metadata parameters
 * @param {string} params.gameId - Game ID
 * @param {number} [params.lastSyncedVersion=0] - Last synced version
 * @param {string} [params.syncStatus='synced'] - Initial sync status
 * @returns {SyncMetadata}
 */
export const createSyncMetadata = ({
  gameId,
  lastSyncedVersion = 0,
  syncStatus = SyncStatus.SYNCED
}) => {
  return {
    gameId,
    lastSyncedVersion,
    lastServerAck: Date.now(),
    syncStatus,
    pendingEventsCount: 0,
    lastAttemptTimestamp: Date.now(),
    retryCount: 0,
    hasConflict: false,
    storageUsed: 0
  };
};

/**
 * Updates metadata after successful sync
 * @param {SyncMetadata} metadata - Current metadata
 * @param {number} syncedVersion - Version that was synced
 * @param {number} acknowledgedEvents - Number of events acknowledged
 * @returns {SyncMetadata}
 */
export const markSyncSuccess = (metadata, syncedVersion, acknowledgedEvents) => {
  return {
    ...metadata,
    lastSyncedVersion: syncedVersion,
    lastServerAck: Date.now(),
    syncStatus: SyncStatus.SYNCED,
    pendingEventsCount: Math.max(0, metadata.pendingEventsCount - acknowledgedEvents),
    lastAttemptTimestamp: Date.now(),
    retryCount: 0,
    lastError: undefined,
    nextRetryTimestamp: undefined,
    hasConflict: false
  };
};

/**
 * Updates metadata after sync failure
 * @param {SyncMetadata} metadata - Current metadata
 * @param {string} error - Error message
 * @param {boolean} [isConflict=false] - Whether this is a conflict error
 * @returns {SyncMetadata}
 */
export const markSyncFailure = (metadata, error, isConflict = false) => {
  const retryCount = metadata.retryCount + 1;
  const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 60000); // Max 1 minute
  
  return {
    ...metadata,
    syncStatus: isConflict ? SyncStatus.CONFLICT : SyncStatus.ERROR,
    lastAttemptTimestamp: Date.now(),
    nextRetryTimestamp: Date.now() + backoffMs,
    retryCount,
    lastError: error,
    hasConflict: isConflict
  };
};

/**
 * Updates metadata when new events are added
 * @param {SyncMetadata} metadata - Current metadata
 * @param {number} eventCount - Number of events added
 * @returns {SyncMetadata}
 */
export const markPendingEvents = (metadata, eventCount) => {
  return {
    ...metadata,
    pendingEventsCount: metadata.pendingEventsCount + eventCount,
    syncStatus: metadata.syncStatus === SyncStatus.SYNCED 
      ? SyncStatus.PENDING 
      : metadata.syncStatus
  };
};

/**
 * Checks if metadata indicates sync is needed
 * @param {SyncMetadata} metadata
 * @returns {boolean}
 */
export const needsSync = (metadata) => {
  return metadata.pendingEventsCount > 0 && 
    metadata.syncStatus !== SyncStatus.SYNCING &&
    metadata.syncStatus !== SyncStatus.PAUSED &&
    (!metadata.nextRetryTimestamp || Date.now() >= metadata.nextRetryTimestamp);
};

/**
 * Calculates human-readable sync status message
 * @param {SyncMetadata} metadata
 * @returns {string}
 */
export const getSyncStatusMessage = (metadata) => {
  switch (metadata.syncStatus) {
    case SyncStatus.SYNCED:
      return 'All changes saved';
    case SyncStatus.PENDING:
      return `${metadata.pendingEventsCount} change${metadata.pendingEventsCount !== 1 ? 's' : ''} pending`;
    case SyncStatus.SYNCING:
      return 'Syncing...';
    case SyncStatus.CONFLICT:
      return 'Conflict detected - manual resolution required';
    case SyncStatus.ERROR:
      return `Sync error: ${metadata.lastError || 'Unknown error'}`;
    case SyncStatus.OFFLINE:
      return 'Offline - changes will sync when online';
    case SyncStatus.PAUSED:
      return 'Sync paused';
    default:
      return 'Unknown status';
  }
};
