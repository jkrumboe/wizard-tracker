/**
 * @fileoverview Sync Manager
 * Handles synchronization between local IndexedDB and backend API
 */

import { db } from '../db/database.js';
import { markSyncSuccess, markSyncFailure, SyncStatus } from '../schemas/syncMetadata.js';

/**
 * Sync Manager for coordinating offline/online synchronization
 */
export class SyncManager {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.activeSyncs = new Map();
    this.listeners = new Set();
    this.isOnline = navigator.onLine;
    
    // Set up online/offline listeners
    globalThis.addEventListener('online', () => this.handleOnline());
    globalThis.addEventListener('offline', () => this.handleOffline());
  }
  
  /**
   * Handle online event
   */
  handleOnline() {
    this.isOnline = true;
    this.notifyListeners({ type: 'online' });
    this.syncAllPendingGames();
  }
  
  /**
   * Handle offline event
   */
  handleOffline() {
    this.isOnline = false;
    this.notifyListeners({ type: 'offline' });
  }
  
  /**
   * Add a sync event listener
   * @param {Function} listener
   */
  addListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  /**
   * Notify all listeners
   * @param {Object} event
   */
  notifyListeners(event) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Sync listener error:', error);
      }
    });
  }
  
  /**
   * Sync a specific game
   * @param {string} gameId
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async syncGame(gameId, options = {}) {
    const { force = false } = options;
    
    // Check if already syncing
    if (this.activeSyncs.has(gameId)) {
      return { status: 'already_syncing' };
    }
    
    // Check if online
    if (!this.isOnline && !force) {
      return { status: 'offline' };
    }
    
    try {
      this.activeSyncs.set(gameId, true);
      
      // Get sync metadata
      const metadata = await db.getSyncMetadata(gameId);
      
      // Update status to syncing
      await db.updateSyncMetadata(gameId, { syncStatus: SyncStatus.SYNCING });
      this.notifyListeners({ type: 'sync_start', gameId, metadata });
      
      // Get pending events
      const pendingEvents = await db.getPendingEvents(gameId);
      
      if (pendingEvents.length === 0) {
        // Nothing to sync
        await db.updateSyncMetadata(gameId, { syncStatus: SyncStatus.SYNCED });
        this.notifyListeners({ type: 'sync_complete', gameId, eventsSynced: 0 });
        return { status: 'success', eventsSynced: 0 };
      }
      
      // Send events to server
      const clientId = await db.getClientId();
      const result = await this.apiClient.post(`/api/games/${gameId}/events`, {
        clientId,
        baseVersion: metadata.lastSyncedVersion,
        events: pendingEvents
      });
      
      // Mark events as acknowledged
      const eventIds = result.data.appliedEvents.map(e => e.id);
      await db.acknowledgeEvents(eventIds, result.data.serverVersion);
      
      // Update metadata
      const updatedMetadata = markSyncSuccess(
        metadata,
        result.data.serverVersion,
        eventIds.length
      );
      await db.updateSyncMetadata(gameId, updatedMetadata);
      
      // Update snapshot with new server version
      const snapshot = await db.getLatestSnapshot(gameId);
      if (snapshot) {
        snapshot.serverVersion = result.data.serverVersion;
        snapshot.dirty = false;
        snapshot.syncStatus = SyncStatus.SYNCED;
        await db.saveSnapshot(snapshot);
      }
      
      this.notifyListeners({
        type: 'sync_complete',
        gameId,
        eventsSynced: eventIds.length,
        serverVersion: result.data.serverVersion
      });
      
      return {
        status: 'success',
        eventsSynced: eventIds.length,
        serverVersion: result.data.serverVersion
      };
      
    } catch (error) {
      console.error('Sync failed:', error);
      
      // Check if this is a conflict error
      const isConflict = error.response?.status === 409;
      
      if (isConflict) {
        // Handle conflict
        await this.handleConflict(gameId, error.response.data);
        this.notifyListeners({ type: 'sync_conflict', gameId, error });
        return { status: 'conflict', error };
      }
      
      // Update metadata with error
      const metadata = await db.getSyncMetadata(gameId);
      const updatedMetadata = markSyncFailure(metadata, error.message, isConflict);
      await db.updateSyncMetadata(gameId, updatedMetadata);
      
      this.notifyListeners({ type: 'sync_error', gameId, error });
      
      return { status: 'error', error };
      
    } finally {
      this.activeSyncs.delete(gameId);
    }
  }
  
  /**
   * Handle version conflict
   * @param {string} gameId
   * @param {Object} serverData
   */
  async handleConflict(gameId, serverData) {
    try {
      // Get local state
      const localSnapshot = await db.getLatestSnapshot(gameId);
      const pendingEvents = await db.getPendingEvents(gameId);
      
      // Import conflict resolver
      const { resolveConflict } = await import('./conflictResolver.js');
      
      // Resolve conflict
      const resolved = await resolveConflict({
        localSnapshot,
        localEvents: pendingEvents,
        serverSnapshot: serverData.snapshot,
        serverVersion: serverData.serverVersion
      });
      
      if (resolved.strategy === 'server_wins') {
        // Accept server state, discard local changes
        await this.acceptServerState(gameId, serverData);
      } else if (resolved.strategy === 'client_wins') {
        // Force push local state (requires special permission)
        await this.forcePushLocalState(gameId);
      } else if (resolved.strategy === 'merged') {
        // Apply merged state
        await this.applyMergedState(gameId, resolved.mergedState);
      } else {
        // Manual resolution required
        await db.updateSyncMetadata(gameId, {
          syncStatus: SyncStatus.CONFLICT,
          hasConflict: true,
          lastError: 'Manual conflict resolution required'
        });
      }
      
    } catch (error) {
      console.error('Conflict resolution failed:', error);
      throw error;
    }
  }
  
  /**
   * Accept server state and discard local changes
   * @param {string} gameId
   * @param {Object} serverData
   */
  async acceptServerState(gameId, serverData) {
    // Mark all pending events as acknowledged (discarded)
    const pendingEvents = await db.getPendingEvents(gameId);
    const eventIds = pendingEvents.map(e => e.id);
    await db.acknowledgeEvents(eventIds, serverData.serverVersion);
    
    // Update local snapshot with server state
    const { createGameSnapshot } = await import('../schemas/gameSnapshot.js');
    const snapshot = createGameSnapshot({
      gameId,
      localVersion: serverData.serverVersion,
      serverVersion: serverData.serverVersion,
      gameState: serverData.snapshot,
      userId: pendingEvents[0]?.userId || 'unknown',
      dirty: false,
      syncStatus: SyncStatus.SYNCED
    });
    
    await db.saveSnapshot(snapshot);
    
    // Update metadata
    await db.updateSyncMetadata(gameId, {
      lastSyncedVersion: serverData.serverVersion,
      syncStatus: SyncStatus.SYNCED,
      hasConflict: false,
      pendingEventsCount: 0
    });
  }
  
  /**
   * Force push local state to server
   * @param {string} gameId
   */
  async forcePushLocalState(gameId) {
    const snapshot = await db.getLatestSnapshot(gameId);
    
    await this.apiClient.post(`/api/games/${gameId}/snapshots`, {
      snapshot: snapshot.gameState,
      localVersion: snapshot.localVersion,
      force: true
    });
    
    // Mark as synced
    await db.updateSyncMetadata(gameId, {
      lastSyncedVersion: snapshot.localVersion,
      syncStatus: SyncStatus.SYNCED,
      hasConflict: false
    });
  }
  
  /**
   * Apply merged state after conflict resolution
   * @param {string} gameId
   * @param {Object} mergedState
   */
  async applyMergedState(gameId, mergedState) {
    const { createGameSnapshot } = await import('../schemas/gameSnapshot.js');
    await db.getSyncMetadata(gameId);
    
    const snapshot = createGameSnapshot({
      gameId,
      localVersion: mergedState.version,
      serverVersion: mergedState.version,
      gameState: mergedState.state,
      userId: mergedState.userId,
      dirty: false,
      syncStatus: SyncStatus.SYNCED
    });
    
    await db.saveSnapshot(snapshot);
    
    // Clear pending events
    const pendingEvents = await db.getPendingEvents(gameId);
    const eventIds = pendingEvents.map(e => e.id);
    await db.acknowledgeEvents(eventIds, mergedState.version);
    
    // Update metadata
    await db.updateSyncMetadata(gameId, {
      lastSyncedVersion: mergedState.version,
      syncStatus: SyncStatus.SYNCED,
      hasConflict: false,
      pendingEventsCount: 0
    });
  }
  
  /**
   * Sync all games with pending changes
   * @returns {Promise<Array>}
   */
  async syncAllPendingGames() {
    if (!this.isOnline) {
      return [];
    }
    
    const allMetadata = await db.syncMetadata.toArray();
    const pendingGames = allMetadata.filter(m => m.pendingEventsCount > 0);
    
    const results = await Promise.allSettled(
      pendingGames.map(m => this.syncGame(m.gameId))
    );
    
    return results;
  }
  
  /**
   * Get sync status for a game
   * @param {string} gameId
   * @returns {Promise<Object>}
   */
  async getSyncStatus(gameId) {
    const metadata = await db.getSyncMetadata(gameId);
    const pendingEvents = await db.getPendingEvents(gameId);
    
    return {
      ...metadata,
      pendingEventsCount: pendingEvents.length,
      isOnline: this.isOnline,
      isSyncing: this.activeSyncs.has(gameId)
    };
  }
}

/**
 * Create singleton sync manager instance
 */
let syncManagerInstance = null;

export const createSyncManager = (apiClient) => {
  if (!syncManagerInstance) {
    syncManagerInstance = new SyncManager(apiClient);
  }
  return syncManagerInstance;
};

export const getSyncManager = () => {
  if (!syncManagerInstance) {
    throw new Error('SyncManager not initialized. Call createSyncManager first.');
  }
  return syncManagerInstance;
};
