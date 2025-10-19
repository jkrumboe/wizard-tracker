/**
 * @fileoverview Persistence Middleware for State Management
 * Automatically persists game state changes to IndexedDB
 */

import { db } from '../db/database.js';
import { createGameSnapshot } from '../schemas/gameSnapshot.js';
import { createGameEvent, GameActionTypes } from '../schemas/gameEvent.js';
import { markPendingEvents, SyncStatus } from '../schemas/syncMetadata.js';

/**
 * Configuration for persistence middleware
 */
const DEFAULT_CONFIG = {
  enabled: true,
  debounceMs: 500,
  maxSnapshotsPerGame: 10,
  syncOnMutation: true,
  criticalActionsOnly: false
};

/**
 * Creates persistence middleware for a state store
 * Works with Zustand, Redux, or any store that supports middleware
 * 
 * @param {Object} config - Configuration options
 * @returns {Function} Middleware function
 */
export const createPersistenceMiddleware = (config = {}) => {
  const options = { ...DEFAULT_CONFIG, ...config };
  let localVersion = 0;
  let debounceTimer = null;
  let clientId = null;
  
  // Initialize client ID
  db.getClientId().then(id => {
    clientId = id;
  });
  
  /**
   * Persists a snapshot and event to IndexedDB
   */
  const persistState = async (gameId, userId, actionType, payload, gameState) => {
    if (!options.enabled || !gameId || !userId) {
      return;
    }
    
    try {
      // Increment local version
      localVersion++;
      
      // Get current sync metadata
      const metadata = await db.getSyncMetadata(gameId);
      
      // Create and save snapshot
      const snapshot = createGameSnapshot({
        gameId,
        localVersion,
        serverVersion: metadata.lastSyncedVersion,
        gameState,
        userId,
        dirty: true,
        syncStatus: SyncStatus.PENDING
      });
      
      await db.saveSnapshot(snapshot);
      
      // Create and save event
      const event = createGameEvent({
        gameId,
        actionType,
        payload,
        localVersion,
        userId,
        clientId
      });
      
      await db.saveEvent(event);
      
      // Update sync metadata
      const updatedMetadata = markPendingEvents(metadata, 1);
      await db.updateSyncMetadata(gameId, updatedMetadata);
      
      // Prune old snapshots
      await db.pruneOldSnapshots(gameId, options.maxSnapshotsPerGame);
      
      // Notify other tabs via BroadcastChannel
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('wizard-tracker-sync');
        channel.postMessage({
          type: 'STATE_UPDATED',
          gameId,
          localVersion,
          actionType
        });
        channel.close();
      }
      
      // Trigger background sync if available
      if (options.syncOnMutation && 'serviceWorker' in navigator && 'sync' in navigator.serviceWorker) {
        try {
          const registration = await navigator.serviceWorker.ready;
          await registration.sync.register(`sync-game-${gameId}`);
        } catch (error) {
          console.warn('Background sync registration failed:', error);
        }
      }
      
    } catch (error) {
      console.error('Failed to persist state:', error);
      throw error;
    }
  };
  
  /**
   * Debounced persist function
   */
  const debouncedPersist = (gameId, userId, actionType, payload, gameState) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(() => {
      persistState(gameId, userId, actionType, payload, gameState);
      debounceTimer = null;
    }, options.debounceMs);
  };
  
  /**
   * Middleware function for Zustand
   */
  const zustandMiddleware = (config) => (set, get, api) => {
    const wrappedSet = (partial, replace, actionType = 'UNKNOWN', payload = {}) => {
      // Call original set
      set(partial, replace);
      
      // Get updated state
      const state = get();
      
      // Extract game info from state
      const gameId = state.currentGameId || state.gameId;
      const userId = state.userId || state.user?.id;
      
      if (gameId && userId) {
        // Check if this is a critical action or if we're not filtering
        const isCritical = Object.values(GameActionTypes).includes(actionType);
        
        if (!options.criticalActionsOnly || isCritical) {
          // Use debounced persist for non-critical actions
          if (isCritical || options.debounceMs === 0) {
            persistState(gameId, userId, actionType, payload, state);
          } else {
            debouncedPersist(gameId, userId, actionType, payload, state);
          }
        }
      }
    };
    
    return config(wrappedSet, get, api);
  };
  
  /**
   * Middleware function for Redux
   */
  const reduxMiddleware = (store) => (next) => (action) => {
    // Call original action
    const result = next(action);
    
    // Get updated state
    const state = store.getState();
    
    // Extract game info
    const gameId = state.game?.id || state.currentGameId;
    const userId = state.user?.id || state.auth?.userId;
    
    if (gameId && userId) {
      const actionType = action.type || 'UNKNOWN';
      const payload = action.payload || {};
      
      // Check if this is a critical action
      const isCritical = Object.values(GameActionTypes).includes(actionType);
      
      if (!options.criticalActionsOnly || isCritical) {
        if (isCritical || options.debounceMs === 0) {
          persistState(gameId, userId, actionType, payload, state);
        } else {
          debouncedPersist(gameId, userId, actionType, payload, state);
        }
      }
    }
    
    return result;
  };
  
  // Return appropriate middleware based on usage
  return {
    zustand: zustandMiddleware,
    redux: reduxMiddleware,
    persist: persistState,
    debouncedPersist
  };
};

/**
 * Resume game from IndexedDB
 * @param {string} gameId - Game ID to resume
 * @returns {Promise<Object|null>} Game state or null if not found
 */
export const resumeGame = async (gameId) => {
  try {
    // Get latest snapshot
    const snapshot = await db.getLatestSnapshot(gameId);
    
    if (!snapshot) {
      return null;
    }
    
    // Get pending events since snapshot
    const pendingEvents = await db.getEventsSince(gameId, snapshot.localVersion);
    
    // Return snapshot state and pending events for replay
    return {
      gameState: snapshot.gameState,
      localVersion: snapshot.localVersion,
      serverVersion: snapshot.serverVersion,
      pendingEvents,
      needsSync: snapshot.dirty || pendingEvents.length > 0
    };
    
  } catch (error) {
    console.error('Failed to resume game:', error);
    return null;
  }
};

/**
 * Force immediate persistence of current state
 * @param {string} gameId
 * @param {string} userId
 * @param {Object} gameState
 * @param {string} [actionType='MANUAL_SAVE']
 */
export const forceSave = async (gameId, userId, gameState, actionType = 'MANUAL_SAVE') => {
  const middleware = createPersistenceMiddleware({ debounceMs: 0 });
  await middleware.persist(gameId, userId, actionType, {}, gameState);
};

/**
 * Clear all local game data
 * @param {string} gameId
 */
export const clearLocalGame = async (gameId) => {
  await db.deleteGameData(gameId);
};

// Export singleton instance with default config
export const persistenceMiddleware = createPersistenceMiddleware();
