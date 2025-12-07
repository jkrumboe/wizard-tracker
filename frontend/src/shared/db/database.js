/**
 * @fileoverview IndexedDB Database Setup using Dexie
 * Manages game snapshots, events, and sync metadata
 */

import Dexie from 'dexie';

/**
 * WizardTrackerDB - IndexedDB database for offline game state
 */
class WizardTrackerDB extends Dexie {
  constructor() {
    super('WizardTrackerDB');
    
    // Define database schema
    this.version(1).stores({
      gameSnapshots: 'id, gameId, localVersion, serverVersion, userId, timestamp, dirty, syncStatus',
      gameEvents: 'id, gameId, timestamp, localVersion, userId, acknowledged, actionType',
      syncMetadata: 'gameId, syncStatus, lastSyncedVersion, hasConflict',
      clientState: 'key' // For storing client-wide state (clientId, etc.)
    });
    
    // Add friends table in version 2
    this.version(2).stores({
      gameSnapshots: 'id, gameId, localVersion, serverVersion, userId, timestamp, dirty, syncStatus',
      gameEvents: 'id, gameId, timestamp, localVersion, userId, acknowledged, actionType',
      syncMetadata: 'gameId, syncStatus, lastSyncedVersion, hasConflict',
      clientState: 'key',
      friends: 'id, userId, username' // Friends stored locally
    });
    
    // Type definitions for TypeScript-like intellisense
    this.gameSnapshots = this.table('gameSnapshots');
    this.gameEvents = this.table('gameEvents');
    this.syncMetadata = this.table('syncMetadata');
    this.clientState = this.table('clientState');
    this.friends = this.table('friends');
  }
  
  /**
   * Get or create client ID
   * @returns {Promise<string>}
   */
  async getClientId() {
    let clientState = await this.clientState.get('clientId');
    
    if (!clientState) {
      // Secure random clientId
      const array = new Uint8Array(16);
      globalThis.crypto.getRandomValues(array);
      const secureRandom = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
      const clientId = `client_${Date.now()}_${secureRandom}`;
      await this.clientState.put({ key: 'clientId', value: clientId });
      return clientId;
    }
    
    return clientState.value;
  }
  
  /**
   * Get the latest snapshot for a game
   * @param {string} gameId
   * @returns {Promise<Object|null>}
   */
  async getLatestSnapshot(gameId) {
    const snapshots = await this.gameSnapshots
      .where('gameId')
      .equals(gameId)
      .reverse()
      .sortBy('localVersion');
    
    return snapshots[0] || null;
  }
  
  /**
   * Get pending (unacknowledged) events for a game
   * @param {string} gameId
   * @returns {Promise<Array>}
   */
  async getPendingEvents(gameId) {
    return await this.gameEvents
      .where('gameId')
      .equals(gameId)
      .and(event => !event.acknowledged)
      .sortBy('timestamp');
  }
  
  /**
   * Get all events for a game since a specific version
   * @param {string} gameId
   * @param {number} sinceVersion
   * @returns {Promise<Array>}
   */
  async getEventsSince(gameId, sinceVersion) {
    return await this.gameEvents
      .where('gameId')
      .equals(gameId)
      .and(event => event.localVersion > sinceVersion)
      .sortBy('timestamp');
  }
  
  /**
   * Save a game snapshot
   * @param {Object} snapshot
   * @returns {Promise<string>}
   */
  async saveSnapshot(snapshot) {
    return await this.gameSnapshots.put(snapshot);
  }
  
  /**
   * Save a game event
   * @param {Object} event
   * @returns {Promise<string>}
   */
  async saveEvent(event) {
    return await this.gameEvents.put(event);
  }
  
  /**
   * Acknowledge multiple events
   * @param {Array<string>} eventIds
   * @param {number} serverVersion
   * @returns {Promise<number>}
   */
  async acknowledgeEvents(eventIds, serverVersion) {
    return await this.gameEvents
      .where('id')
      .anyOf(eventIds)
      .modify({ acknowledged: true, serverVersion });
  }
  
  /**
   * Get or create sync metadata for a game
   * @param {string} gameId
   * @returns {Promise<Object>}
   */
  async getSyncMetadata(gameId) {
    let metadata = await this.syncMetadata.get(gameId);
    
    if (!metadata) {
      const { createSyncMetadata } = await import('../schemas/syncMetadata.js');
      metadata = createSyncMetadata({ gameId });
      await this.syncMetadata.put(metadata);
    }
    
    return metadata;
  }
  
  /**
   * Update sync metadata
   * @param {string} gameId
   * @param {Object} updates
   * @returns {Promise<number>}
   */
  async updateSyncMetadata(gameId, updates) {
    return await this.syncMetadata.update(gameId, updates);
  }
  
  /**
   * Clean up old snapshots for a game (keep only last N)
   * @param {string} gameId
   * @param {number} keepCount
   * @returns {Promise<number>}
   */
  async pruneOldSnapshots(gameId, keepCount = 10) {
    const snapshots = await this.gameSnapshots
      .where('gameId')
      .equals(gameId)
      .reverse()
      .sortBy('localVersion');
    
    if (snapshots.length <= keepCount) {
      return 0;
    }
    
    const toDelete = snapshots.slice(keepCount).map(s => s.id);
    return await this.gameSnapshots.bulkDelete(toDelete);
  }
  
  /**
   * Clean up acknowledged events older than a threshold
   * @param {string} gameId
   * @param {number} olderThanMs
   * @returns {Promise<number>}
   */
  async pruneOldEvents(gameId, olderThanMs = 7 * 24 * 60 * 60 * 1000) {
    const threshold = Date.now() - olderThanMs;
    
    const toDelete = await this.gameEvents
      .where('gameId')
      .equals(gameId)
      .and(event => event.acknowledged && event.timestamp < threshold)
      .primaryKeys();
    
    return await this.gameEvents.bulkDelete(toDelete);
  }
  
  /**
   * Get storage statistics
   * @returns {Promise<Object>}
   */
  async getStorageStats() {
    const [snapshots, events, metadata] = await Promise.all([
      this.gameSnapshots.count(),
      this.gameEvents.count(),
      this.syncMetadata.count()
    ]);
    
    return {
      snapshots,
      events,
      metadata,
      total: snapshots + events + metadata
    };
  }
  
  /**
   * Delete all data for a game
   * @param {string} gameId
   * @returns {Promise<void>}
   */
  async deleteGameData(gameId) {
    await Promise.all([
      this.gameSnapshots.where('gameId').equals(gameId).delete(),
      this.gameEvents.where('gameId').equals(gameId).delete(),
      this.syncMetadata.delete(gameId)
    ]);
  }
  
  /**
   * Export game data as JSON
   * @param {string} gameId
   * @returns {Promise<Object>}
   */
  async exportGameData(gameId) {
    const [snapshot, events, metadata] = await Promise.all([
      this.getLatestSnapshot(gameId),
      this.gameEvents.where('gameId').equals(gameId).toArray(),
      this.getSyncMetadata(gameId)
    ]);
    
    return {
      snapshot,
      events,
      metadata,
      exportedAt: Date.now()
    };
  }
  
  /**
   * Import game data from JSON
   * @param {Object} data
   * @returns {Promise<void>}
   */
  async importGameData(data) {
    await this.transaction('rw', [this.gameSnapshots, this.gameEvents, this.syncMetadata], async () => {
      if (data.snapshot) {
        await this.gameSnapshots.put(data.snapshot);
      }
      if (data.events && data.events.length > 0) {
        await this.gameEvents.bulkPut(data.events);
      }
      if (data.metadata) {
        await this.syncMetadata.put(data.metadata);
      }
    });
  }
}

// Create singleton instance
export const db = new WizardTrackerDB();

// Export for testing
export { WizardTrackerDB };
