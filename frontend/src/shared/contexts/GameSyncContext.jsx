/**
 * @fileoverview Game Sync Context
 * Provides game state persistence and synchronization
 */

import { createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { getSyncManager } from '../sync/syncManager';
import { persistenceMiddleware, resumeGame, forceSave } from '../sync/persistenceMiddleware';
import { db } from '../db/database';

export const GameSyncContext = createContext({
  saveGameState: () => {},
  resumeGameState: () => {},
  forceSyncGame: () => {},
  getSyncStatus: () => {},
  clearGameData: () => {}
});

/**
 * GameSyncProvider - Wraps game-related components to provide sync functionality
 */
export function GameSyncProvider({ children, gameId, userId }) {
  const syncManagerRef = useRef(null);

  // Initialize sync manager reference
  useEffect(() => {
    try {
      syncManagerRef.current = getSyncManager();
    } catch (error) {
      console.warn('Sync manager not available:', error);
    }
  }, []);

  /**
   * Save game state to IndexedDB
   * @param {Object} gameState - Complete game state
   * @param {string} actionType - Type of action that triggered the save
   * @param {Object} payload - Action payload
   */
  const saveGameState = useCallback(async (gameState, actionType = 'STATE_UPDATE', payload = {}) => {
    if (!gameId || !userId) {
      console.warn('Cannot save game state: missing gameId or userId');
      return;
    }

    try {
      await persistenceMiddleware.persist(gameId, userId, actionType, payload, gameState);
      console.debug('Game state saved:', gameId, actionType);
    } catch (error) {
      console.error('Failed to save game state:', error);
      throw error;
    }
  }, [gameId, userId]);

  /**
   * Resume game state from IndexedDB
   * @returns {Promise<Object|null>} Resumed game state or null
   */
  const resumeGameState = useCallback(async () => {
    if (!gameId) {
      console.warn('Cannot resume game: missing gameId');
      return null;
    }

    try {
      const resumed = await resumeGame(gameId);
      
      if (resumed) {
        console.debug('Game resumed from local storage:', gameId);
        
        // Trigger sync if needed
        if (resumed.needsSync && syncManagerRef.current) {
          syncManagerRef.current.syncGame(gameId).catch(err => {
            console.warn('Background sync failed:', err);
          });
        }
      }
      
      return resumed;
    } catch (error) {
      console.error('Failed to resume game:', error);
      return null;
    }
  }, [gameId]);

  /**
   * Force immediate sync of game
   */
  const forceSyncGame = useCallback(async () => {
    if (!gameId || !syncManagerRef.current) {
      console.warn('Cannot force sync: missing gameId or sync manager');
      return { status: 'unavailable' };
    }

    try {
      const result = await syncManagerRef.current.syncGame(gameId, { force: true });
      console.debug('Force sync result:', result);
      return result;
    } catch (error) {
      console.error('Force sync failed:', error);
      return { status: 'error', error };
    }
  }, [gameId]);

  /**
   * Get current sync status
   */
  const getSyncStatus = useCallback(async () => {
    if (!gameId || !syncManagerRef.current) {
      return null;
    }

    try {
      return await syncManagerRef.current.getSyncStatus(gameId);
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return null;
    }
  }, [gameId]);

  /**
   * Clear all local data for the game
   */
  const clearGameData = useCallback(async () => {
    if (!gameId) {
      console.warn('Cannot clear game data: missing gameId');
      return;
    }

    try {
      await db.deleteGameData(gameId);
      console.debug('Game data cleared:', gameId);
    } catch (error) {
      console.error('Failed to clear game data:', error);
      throw error;
    }
  }, [gameId]);

  const value = {
    saveGameState,
    resumeGameState,
    forceSyncGame,
    getSyncStatus,
    clearGameData
  };

  return (
    <GameSyncContext.Provider value={value}>
      {children}
    </GameSyncContext.Provider>
  );
}

/**
 * Hook to use game sync functionality
 */
export function useGameSync() {
  const context = useContext(GameSyncContext);
  
  if (!context) {
    throw new Error('useGameSync must be used within a GameSyncProvider');
  }
  
  return context;
}

export default GameSyncContext;
