/**
 * @fileoverview Game Snapshot Schema
 * Defines the structure for persisting complete game state snapshots
 */

/**
 * @typedef {Object} GameSnapshot
 * @property {string} id - Unique identifier for the snapshot
 * @property {string} gameId - ID of the game this snapshot belongs to
 * @property {number} localVersion - Monotonically increasing local version number
 * @property {number} serverVersion - Last known server version
 * @property {Object} gameState - Complete game state object
 * @property {string} userId - ID of the user who owns this game
 * @property {number} timestamp - Unix timestamp when snapshot was created
 * @property {boolean} dirty - Whether local state differs from server
 * @property {string} [syncStatus] - Current sync status: 'synced' | 'pending' | 'conflict' | 'error'
 */

/**
 * Creates a new game snapshot
 * @param {Object} params - Snapshot parameters
 * @param {string} params.gameId - Game ID
 * @param {number} params.localVersion - Local version number
 * @param {number} params.serverVersion - Server version number
 * @param {Object} params.gameState - Complete game state
 * @param {string} params.userId - User ID
 * @param {boolean} [params.dirty=false] - Dirty flag
 * @param {string} [params.syncStatus='synced'] - Sync status
 * @returns {GameSnapshot}
 */
export const createGameSnapshot = ({
  gameId,
  localVersion,
  serverVersion,
  gameState,
  userId,
  dirty = false,
  syncStatus = 'synced'
}) => {
  return {
    id: `${gameId}-${localVersion}`,
    gameId,
    localVersion,
    serverVersion,
    gameState: JSON.parse(JSON.stringify(gameState)), // Deep clone
    userId,
    timestamp: Date.now(),
    dirty,
    syncStatus
  };
};

/**
 * Validates a game snapshot
 * @param {GameSnapshot} snapshot - Snapshot to validate
 * @returns {boolean}
 */
export const isValidGameSnapshot = (snapshot) => {
  return !!(
    snapshot &&
    typeof snapshot.id === 'string' &&
    typeof snapshot.gameId === 'string' &&
    typeof snapshot.localVersion === 'number' &&
    typeof snapshot.serverVersion === 'number' &&
    snapshot.gameState &&
    typeof snapshot.userId === 'string' &&
    typeof snapshot.timestamp === 'number' &&
    typeof snapshot.dirty === 'boolean'
  );
};

/**
 * Compares two snapshots by version
 * @param {GameSnapshot} a
 * @param {GameSnapshot} b
 * @returns {number} - Negative if a < b, positive if a > b, 0 if equal
 */
export const compareSnapshots = (a, b) => {
  return a.localVersion - b.localVersion;
};
