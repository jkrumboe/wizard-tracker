/**
 * @fileoverview State Recovery Service
 * 
 * Handles automatic state recovery during:
 * - Network disconnections
 * - Page reloads
 * - Online/offline transitions
 * - Browser crashes
 * - Session timeouts
 */

import { sessionCache } from './sessionCache';

class StateRecoveryService {
  constructor() {
    this.recoveryCallbacks = new Map();
    this.autoSaveInterval = null;
    this.autoSaveDelay = 3000; // 3 seconds debounce (increased for performance)
    this.pendingSaves = new Map();
    this.initialized = false;
    
    // Bind methods
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);
    
    // Initialize
    this.initialize();
  }

  /**
   * Initialize the recovery service
   */
  initialize() {
    if (this.initialized) return;
    
    // Listen to page unload events
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    
    // Listen to visibility changes (tab switching, minimizing)
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Listen to online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    
    // Auto-save periodically
    this.startAutoSave();
    
    this.initialized = true;
    console.debug('✅ StateRecovery initialized');
  }

  /**
   * Clean up event listeners
   */
  destroy() {
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    this.initialized = false;
  }

  /**
   * Handle page unload - save all critical state
   */
  handleBeforeUnload() {
    console.debug('💾 Saving state before unload...');
    this.saveAllState({ immediate: true });
  }

  /**
   * Handle visibility change - save state when tab becomes hidden
   */
  handleVisibilityChange() {
    if (document.hidden) {
      console.debug('👁️ Tab hidden, saving state...');
      this.saveAllState({ immediate: true });
    } else {
      console.debug('👁️ Tab visible, checking for recovery...');
      this.attemptRecovery();
    }
  }

  /**
   * Handle going offline
   */
  handleOffline() {
    console.debug('📡 Going offline, saving state...');
    this.saveAllState({ immediate: true });
    sessionCache.set('network_state', 'offline', { persist: true });
  }

  /**
   * Handle coming back online
   */
  async handleOnline() {
    console.debug('📡 Back online, attempting recovery...');
    const previousState = await sessionCache.get('network_state');
    
    if (previousState === 'offline') {
      await this.attemptRecovery();
    }
    
    sessionCache.set('network_state', 'online', { persist: true });
  }

  /**
   * Register a state provider for recovery
   * @param {string} key - Unique key for this state
   * @param {Function} getSta te - Function that returns current state
   * @param {Function} setState - Function that sets state from recovery
   */
  registerStateProvider(key, getState, setState) {
    this.recoveryCallbacks.set(key, { getState, setState });
    console.debug(`✅ Registered state provider: ${key}`);
  }

  /**
   * Unregister a state provider
   * @param {string} key - State provider key
   */
  unregisterStateProvider(key) {
    this.recoveryCallbacks.delete(key);
  }

  /**
   * Save state with debouncing
   * @param {string} key - State key
   * @param {any} state - State to save
   * @param {Object} options - Save options
   */
  async saveState(key, state, options = {}) {
    const { immediate = false, persist = true, indexedDB = false } = options;

    if (immediate) {
      // Save immediately, bypass throttling
      await sessionCache.set(`state_${key}`, state, { persist, indexedDB, immediate: true });
      await sessionCache.set(`state_${key}_timestamp`, Date.now(), { persist, immediate: true });
      console.debug(`💾 Saved state: ${key}`);
    } else {
      // Debounce the save
      if (this.pendingSaves.has(key)) {
        clearTimeout(this.pendingSaves.get(key));
      }

      const timeoutId = setTimeout(async () => {
        await sessionCache.set(`state_${key}`, state, { persist, indexedDB });
        await sessionCache.set(`state_${key}_timestamp`, Date.now(), { persist });
        this.pendingSaves.delete(key);
        console.debug(`💾 Saved state (debounced): ${key}`);
      }, this.autoSaveDelay);

      this.pendingSaves.set(key, timeoutId);
    }
  }

  /**
   * Recover state for a specific key
   * @param {string} key - State key
   * @param {any} defaultValue - Default value if no saved state
   * @returns {Promise<any>} Recovered state or default
   */
  async recoverState(key, defaultValue = null) {
    const state = await sessionCache.get(`state_${key}`, defaultValue);
    const timestamp = await sessionCache.get(`state_${key}_timestamp`);
    
    if (state && timestamp) {
      const age = Date.now() - timestamp;
      console.debug(`🔄 Recovered state: ${key} (age: ${Math.round(age / 1000)}s)`);
      return state;
    }
    
    return defaultValue;
  }

  /**
   * Save all registered state providers
   * @param {Object} options - Save options
   */
  async saveAllState(options = {}) {
    const promises = [];
    
    for (const [key, provider] of this.recoveryCallbacks.entries()) {
      try {
        const state = provider.getState();
        if (state) {
          promises.push(this.saveState(key, state, options));
        }
      } catch (error) {
        console.error(`Error saving state for ${key}:`, error);
      }
    }
    
    await Promise.all(promises);
  }

  /**
   * Attempt to recover all registered states
   */
  async attemptRecovery() {
    const recoveredStates = [];
    
    for (const [key, provider] of this.recoveryCallbacks.entries()) {
      try {
        const state = await this.recoverState(key);
        
        if (state) {
          // Call the setState function to restore the state
          provider.setState(state);
          recoveredStates.push(key);
          console.debug(`✅ Recovered state: ${key}`);
        }
      } catch (error) {
        console.error(`Error recovering state for ${key}:`, error);
      }
    }
    
    if (recoveredStates.length > 0) {
      console.debug(`🔄 Recovery complete: ${recoveredStates.join(', ')}`);
      
      // Notify about recovery
      await sessionCache.set('last_recovery', {
        timestamp: Date.now(),
        states: recoveredStates
      }, { persist: true });
    }
    
    return recoveredStates;
  }

  /**
   * Start auto-save timer
   */
  startAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    // Auto-save every 30 seconds
    this.autoSaveInterval = setInterval(() => {
      this.saveAllState({ immediate: true });
    }, 30000);
  }

  /**
   * Stop auto-save timer
   */
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Clear all recovery state
   * @param {string[]} keys - Specific keys to clear (optional)
   */
  async clearRecoveryState(keys = null) {
    if (keys) {
      // Clear specific keys
      for (const key of keys) {
        await sessionCache.remove(`state_${key}`);
        await sessionCache.remove(`state_${key}_timestamp`);
      }
    } else {
      // Clear all registered states
      for (const key of this.recoveryCallbacks.keys()) {
        await sessionCache.remove(`state_${key}`);
        await sessionCache.remove(`state_${key}_timestamp`);
      }
    }
    
    console.debug('🧹 Recovery state cleared');
  }

  /**
   * Check if there's recoverable state
   * @returns {Promise<Object>} Object with recovery info
   */
  async hasRecoverableState() {
    const recoverableStates = [];
    
    for (const key of this.recoveryCallbacks.keys()) {
      const state = await sessionCache.get(`state_${key}`);
      const timestamp = await sessionCache.get(`state_${key}_timestamp`);
      
      if (state && timestamp) {
        const age = Date.now() - timestamp;
        recoverableStates.push({
          key,
          age,
          timestamp
        });
      }
    }
    
    return {
      hasRecovery: recoverableStates.length > 0,
      states: recoverableStates
    };
  }

  /**
   * Create a full snapshot of application state
   * @returns {Promise<Object>} State snapshot
   */
  async createSnapshot() {
    const snapshot = {
      timestamp: Date.now(),
      states: {}
    };
    
    for (const [key, provider] of this.recoveryCallbacks.entries()) {
      try {
        snapshot.states[key] = provider.getState();
      } catch (error) {
        console.error(`Error creating snapshot for ${key}:`, error);
      }
    }
    
    return snapshot;
  }

  /**
   * Restore from a snapshot
   * @param {Object} snapshot - State snapshot
   */
  async restoreSnapshot(snapshot) {
    if (!snapshot || !snapshot.states) {
      console.warn('Invalid snapshot');
      return;
    }
    
    const restored = [];
    
    for (const [key, state] of Object.entries(snapshot.states)) {
      const provider = this.recoveryCallbacks.get(key);
      
      if (provider) {
        try {
          provider.setState(state);
          restored.push(key);
        } catch (error) {
          console.error(`Error restoring ${key}:`, error);
        }
      }
    }
    
    console.debug(`✅ Restored snapshot: ${restored.join(', ')}`);
    return restored;
  }

  /**
   * Export recovery data for debugging
   * @returns {Promise<Object>} Recovery data
   */
  async exportRecoveryData() {
    const data = {
      timestamp: Date.now(),
      recoveryCallbacks: Array.from(this.recoveryCallbacks.keys()),
      savedStates: {}
    };
    
    for (const key of this.recoveryCallbacks.keys()) {
      const state = await sessionCache.get(`state_${key}`);
      const timestamp = await sessionCache.get(`state_${key}_timestamp`);
      
      if (state) {
        data.savedStates[key] = {
          timestamp,
          age: timestamp ? Date.now() - timestamp : null,
          hasData: !!state
        };
      }
    }
    
    return data;
  }
}

// Create singleton instance
export const stateRecovery = new StateRecoveryService();

// Export class for testing
export { StateRecoveryService };
