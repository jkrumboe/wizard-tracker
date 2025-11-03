/**
 * @fileoverview Session Cache Service
 * 
 * Provides a robust multi-layered caching system that persists data across:
 * - Page reloads
 * - Network disconnections
 * - Online/offline mode transitions
 * - Browser crashes
 * 
 * Uses a fallback hierarchy:
 * 1. In-memory cache (fastest, volatile)
 * 2. sessionStorage (survives page reload within session)
 * 3. localStorage (survives browser restart)
 * 4. IndexedDB (survives everything, largest capacity)
 */

import { db } from '../db/database';

class SessionCache {
  constructor() {
    this.memoryCache = new Map();
    this.namespace = 'wizardTracker_session_';
    this.listeners = new Map();
    this.initialized = false;
    this.maxMemoryCacheSize = 50; // Maximum items in memory cache
    this.lastPersistTime = new Map(); // Track last persist time per key
    this.minPersistInterval = 1000; // Minimum 1s between localStorage writes per key
    
    // Initialize on construction
    this.initialize();
  }

  /**
   * Initialize the cache system
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Restore session from persistent storage
      await this.restoreSession();
      this.initialized = true;
      console.debug('✅ SessionCache initialized');
    } catch (error) {
      console.error('❌ SessionCache initialization failed:', error);
      // Continue anyway - we'll use in-memory cache
      this.initialized = true;
    }
  }

  /**
   * Store data with automatic multi-layer persistence
   * @param {string} key - Cache key
   * @param {any} value - Value to cache (will be JSON serialized)
   * @param {Object} options - Storage options
   * @param {boolean} options.persist - Persist to localStorage (default: true)
   * @param {boolean} options.indexedDB - Store in IndexedDB (default: false, use for large data)
   * @param {number} options.ttl - Time to live in milliseconds (optional)
   * @param {boolean} options.immediate - Force immediate persist, bypass throttling (default: false)
   */
  async set(key, value, options = {}) {
    const {
      persist = true,
      indexedDB = false,
      ttl = null,
      immediate = false
    } = options;

    const cacheEntry = {
      value,
      timestamp: Date.now(),
      ttl,
      expiresAt: ttl ? Date.now() + ttl : null
    };

    // 1. Store in memory cache (always)
    this.memoryCache.set(key, cacheEntry);
    
    // Enforce memory cache size limit (LRU eviction)
    if (this.memoryCache.size > this.maxMemoryCacheSize) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }

    try {
      const serialized = JSON.stringify(cacheEntry);

      // 2. Store in sessionStorage (survives page reload)
      try {
        sessionStorage.setItem(this.namespace + key, serialized);
      } catch {
        console.warn('SessionStorage full, skipping:', key);
      }

      // 3. Store in localStorage if persist option is true
      if (persist) {
        // Throttle localStorage writes to prevent excessive I/O
        const now = Date.now();
        const lastPersist = this.lastPersistTime.get(key) || 0;
        const shouldPersist = immediate || (now - lastPersist >= this.minPersistInterval);
        
        if (shouldPersist) {
          try {
            localStorage.setItem(this.namespace + key, serialized);
            this.lastPersistTime.set(key, now);
          } catch {
            console.warn('LocalStorage full, skipping:', key);
          }
        }
        // If throttled, skip this write (data is still in memory + sessionStorage)
      }

      // 4. Store in IndexedDB for large data
      if (indexedDB) {
        try {
          await db.clientState.put({
            key: this.namespace + key,
            value: cacheEntry,
            timestamp: Date.now()
          });
        } catch (e) {
          console.warn('IndexedDB storage failed, skipping:', key, e);
        }
      }

      // Notify listeners
      this.notifyListeners(key, value);
    } catch (error) {
      console.error('Error caching data:', key, error);
    }
  }

  /**
   * Retrieve data from cache with automatic fallback
   * @param {string} key - Cache key
   * @param {any} defaultValue - Default value if not found
   * @returns {Promise<any>} Cached value or default
   */
  async get(key, defaultValue = null) {
    // 1. Check memory cache first (fastest)
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key);
      if (this.isValid(entry)) {
        return entry.value;
      } else {
        this.memoryCache.delete(key);
      }
    }

    // 2. Check sessionStorage
    try {
      const sessionData = sessionStorage.getItem(this.namespace + key);
      if (sessionData) {
        const entry = JSON.parse(sessionData);
        if (this.isValid(entry)) {
          this.memoryCache.set(key, entry);
          return entry.value;
        }
      }
    } catch {
      // Ignore parsing errors
    }

    // 3. Check localStorage
    try {
      const localData = localStorage.getItem(this.namespace + key);
      if (localData) {
        const entry = JSON.parse(localData);
        if (this.isValid(entry)) {
          this.memoryCache.set(key, entry);
          return entry.value;
        }
      }
    } catch {
      // Ignore parsing errors
    }

    // 4. Check IndexedDB as last resort
    try {
      const dbEntry = await db.clientState.get(this.namespace + key);
      if (dbEntry && dbEntry.value) {
        const entry = dbEntry.value;
        if (this.isValid(entry)) {
          this.memoryCache.set(key, entry);
          return entry.value;
        }
      }
    } catch {
      // IndexedDB might not be available
    }

    return defaultValue;
  }

  /**
   * Check if a cache entry is still valid (not expired)
   * @param {Object} entry - Cache entry
   * @returns {boolean}
   */
  isValid(entry) {
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      return false;
    }
    return true;
  }

  /**
   * Remove data from all cache layers
   * @param {string} key - Cache key
   */
  async remove(key) {
    this.memoryCache.delete(key);
    
    try {
      sessionStorage.removeItem(this.namespace + key);
      localStorage.removeItem(this.namespace + key);
      await db.clientState.delete(this.namespace + key);
    } catch {
      // Ignore errors
    }

    this.notifyListeners(key, null);
  }

  /**
   * Clear all cached data
   * @param {boolean} preserveAuth - Keep authentication data (default: true)
   */
  async clear(preserveAuth = true) {
    const authToken = preserveAuth ? await this.get('auth_token') : null;
    const authUser = preserveAuth ? await this.get('auth_user') : null;

    // Clear memory cache
    this.memoryCache.clear();

    // Clear sessionStorage
    try {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith(this.namespace)) {
          sessionStorage.removeItem(key);
        }
      });
    } catch {
      // Ignore
    }

    // Clear localStorage
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.namespace)) {
          localStorage.removeItem(key);
        }
      });
    } catch {
      // Ignore
    }

    // Clear IndexedDB
    try {
      const allKeys = await db.clientState.toArray();
      const sessionKeys = allKeys
        .filter(item => item.key.startsWith(this.namespace))
        .map(item => item.key);
      
      await Promise.all(sessionKeys.map(key => db.clientState.delete(key)));
    } catch {
      // Ignore
    }

    // Restore auth if needed
    if (preserveAuth && authToken) {
      await this.set('auth_token', authToken, { persist: true });
      await this.set('auth_user', authUser, { persist: true });
    }

    console.debug('🧹 SessionCache cleared');
  }

  /**
   * Restore entire session from persistent storage
   */
  async restoreSession() {
    try {
      // Get all keys from localStorage
      const keys = Object.keys(localStorage);
      const sessionKeys = keys.filter(key => key.startsWith(this.namespace));

      for (const fullKey of sessionKeys) {
        const key = fullKey.replace(this.namespace, '');
        const data = localStorage.getItem(fullKey);
        
        if (data) {
          try {
            const entry = JSON.parse(data);
            if (this.isValid(entry)) {
              this.memoryCache.set(key, entry);
            } else {
              // Remove expired entries
              localStorage.removeItem(fullKey);
            }
          } catch {
            // Invalid JSON, remove it
            localStorage.removeItem(fullKey);
          }
        }
      }

      console.debug('✅ Session restored from localStorage');
    } catch (error) {
      console.error('Error restoring session:', error);
    }
  }

  /**
   * Create a snapshot of the current session
   * @returns {Object} Session snapshot
   */
  async createSnapshot() {
    const snapshot = {
      timestamp: Date.now(),
      data: {}
    };

    // Get all data from memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isValid(entry)) {
        snapshot.data[key] = entry.value;
      }
    }

    return snapshot;
  }

  /**
   * Restore from a snapshot
   * @param {Object} snapshot - Session snapshot
   */
  async restoreFromSnapshot(snapshot) {
    if (!snapshot || !snapshot.data) {
      console.warn('Invalid snapshot');
      return;
    }

    for (const [key, value] of Object.entries(snapshot.data)) {
      await this.set(key, value, { persist: true });
    }

    console.debug('✅ Session restored from snapshot');
  }

  /**
   * Subscribe to cache changes
   * @param {string} key - Key to watch
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    
    this.listeners.get(key).add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(key);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  /**
   * Notify listeners of cache changes
   * @param {string} key - Changed key
   * @param {any} value - New value
   */
  notifyListeners(key, value) {
    const listeners = this.listeners.get(key);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(value);
        } catch (error) {
          console.error('Error in cache listener:', error);
        }
      });
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  async getStats() {
    const memorySize = this.memoryCache.size;
    
    let sessionSize = 0;
    let localSize = 0;
    let indexedDBSize = 0;

    try {
      const sessionKeys = Object.keys(sessionStorage).filter(k => k.startsWith(this.namespace));
      sessionSize = sessionKeys.length;
    } catch {
      // Ignore
    }

    try {
      const localKeys = Object.keys(localStorage).filter(k => k.startsWith(this.namespace));
      localSize = localKeys.length;
    } catch {
      // Ignore
    }

    try {
      const dbKeys = await db.clientState.toArray();
      indexedDBSize = dbKeys.filter(item => item.key.startsWith(this.namespace)).length;
    } catch {
      // Ignore
    }

    return {
      memory: memorySize,
      sessionStorage: sessionSize,
      localStorage: localSize,
      indexedDB: indexedDBSize,
      total: memorySize + sessionSize + localSize + indexedDBSize
    };
  }

  /**
   * Export session data for debugging
   * @returns {Object} All session data
   */
  async export() {
    const data = {};
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isValid(entry)) {
        data[key] = entry.value;
      }
    }

    return {
      timestamp: Date.now(),
      data
    };
  }
}

// Create singleton instance
export const sessionCache = new SessionCache();

// Export class for testing
export { SessionCache };
