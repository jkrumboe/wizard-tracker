/**
 * Online Status Service
 * 
 * Handles checking if online features are available
 */
import { API_ENDPOINTS } from './config.js';

class OnlineStatusService {
  constructor() {
    this._onlineStatus = null;
    this._lastChecked = null;
    this._checkInterval = 300000; // Check every 5 minutes (300 seconds) to avoid rate limiting
    this._minCheckInterval = 60000; // Minimum 60 seconds between forced checks
    this._listeners = [];
    this._intervalId = null;
    this._hasNetworkConnectivity = navigator.onLine; // Browser's network status
    this._pendingCheck = null; // Track if a check is already in progress
    
    // Start periodic checking
    this._startPeriodicCheck();
    
    // Add window focus listener to check status when user returns
    this._addWindowFocusListener();
    
    // Monitor browser's network connectivity
    this._addNetworkListeners();
  }
  
  /**
   * Get the current online status
   * @param {boolean} forceCheck - Whether to force a fresh check
   * @returns {Promise<{online: boolean, lastUpdated: string, message: string, hasNetworkConnectivity: boolean}>}
   */
  async getStatus(forceCheck = false) {
    // If a check is already in progress, return that promise
    if (this._pendingCheck) {
      return this._pendingCheck;
    }
    
    // If we have a cached status and it's recent, use it
    const now = Date.now();
    if (!forceCheck && this._onlineStatus && this._lastChecked && (now - this._lastChecked < this._checkInterval)) {
      return {
        ...this._onlineStatus,
        hasNetworkConnectivity: this._hasNetworkConnectivity
      };
    }
    
    // If forcing a check, respect minimum interval to avoid rate limiting
    if (forceCheck && this._lastChecked && (now - this._lastChecked < this._minCheckInterval)) {
      console.debug('⏱️ Skipping forced check - too soon (rate limit protection)');
      return {
        ...this._onlineStatus,
        hasNetworkConnectivity: this._hasNetworkConnectivity
      };
    }
    
    // If there's no network connectivity at the browser level, 
    // don't mark backend as offline - just note the network issue
    if (!this._hasNetworkConnectivity) {
      const networkDownStatus = {
        online: this._onlineStatus?.online ?? true, // Preserve last known backend status
        lastUpdated: new Date().toISOString(),
        message: 'No internet connection. Working in offline mode with cached data.',
        hasNetworkConnectivity: false,
        networkIssue: true
      };
      
      // Don't update the main status, just return this state
      return networkDownStatus;
    }
    
    // Start the check and cache the promise
    this._pendingCheck = this._performStatusCheck();
    
    try {
      const status = await this._pendingCheck;
      return status;
    } finally {
      this._pendingCheck = null;
    }
  }
  
  /**
   * Perform the actual status check
   * @private
   */
  async _performStatusCheck() {
    try {
      // Check the MongoDB-based online status endpoint
      const response = await fetch(`${API_ENDPOINTS.base}/api/online/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add a timeout
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        const status = {
          online: data.online,
          lastUpdated: data.lastUpdated,
          message: data.message || (data.online ? 
            'All features are available' : 
            'Online features are currently disabled for maintenance'),
          hasNetworkConnectivity: true,
          networkIssue: false
        };

        this._updateStatus(status);
        return status;
      } else if (response.status === 429) {
        // Rate limited - return cached status
        console.debug('⏱️ Rate limited - using cached status');
        return {
          ...this._onlineStatus,
          hasNetworkConnectivity: true,
          networkIssue: false
        };
      } else {
        // If the endpoint fails, preserve last known status
        const fallbackStatus = {
          online: this._onlineStatus?.online ?? true,
          lastUpdated: new Date().toISOString(),
          message: 'Cannot reach server. Using cached data.',
          hasNetworkConnectivity: true,
          networkIssue: true
        };
        
        return fallbackStatus;
      }
    } catch (error) {
      console.debug('Error checking online status:', error.message);
      
      // Network error - preserve last known backend status
      const errorStatus = { 
        online: this._onlineStatus?.online ?? true, // Don't assume offline
        lastUpdated: new Date().toISOString(),
        message: 'Cannot connect to server. Working with cached data.',
        hasNetworkConnectivity: this._hasNetworkConnectivity,
        networkIssue: true
      };
      
      return errorStatus;
    }
  }
  
  /**
   * Check if we're in online mode
   * @returns {Promise<boolean>}
   */
  async isOnline() {
    const status = await this.getStatus();
    return status.online;
  }
  
  /**
   * Force an immediate check of online status (useful for critical operations)
   * @returns {Promise<boolean>}
   */
  async checkNow() {
    const status = await this.getStatus(true);
    return status.online;
  }
  
  /**
   * Toggle the online status (requires authentication)
   * @param {boolean} status - Optional specific status to set
   * @param {string} message - Optional custom message
   * @returns {Promise<Object>} - Result of the toggle operation
   */
  async toggleOnlineStatus(status = undefined, message = undefined) {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication required to change online status');
      }

      const response = await fetch(`${API_ENDPOINTS.base}/api/online/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, message })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to toggle online status');
      }

      const result = await response.json();
      
      // Force refresh the status
      await this.getStatus(true);
      
      return result;
    } catch (error) {
      console.error('Error toggling online status:', error);
      throw error;
    }
  }

  /**
   * Set specific online status (requires authentication)
   * @param {boolean} status - The status to set (true = online, false = offline)
   * @param {string} message - Optional custom message
   * @returns {Promise<Object>} - Result of the operation
   */
  async setOnlineStatus(status, message = undefined) {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication required to change online status');
      }

      const response = await fetch(`${API_ENDPOINTS.base}/api/online/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, message })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to set online status');
      }

      const result = await response.json();
      
      // Force refresh the status
      await this.getStatus(true);
      
      return result;
    } catch (error) {
      console.error('Error setting online status:', error);
      throw error;
    }
  }
  
  /**
   * Add a listener for status changes
   * @param {Function} callback - Called when online status changes
   * @returns {Function} Function to remove the listener
   */
  addStatusListener(callback) {
    this._listeners.push(callback);
    
    // Return function to remove listener
    return () => {
      this._listeners = this._listeners.filter(cb => cb !== callback);
    };
  }
  
  /**
   * Update status and notify listeners
   * @private
   */
  _updateStatus(status) {
    const oldStatus = this._onlineStatus;
    this._onlineStatus = status;
    this._lastChecked = Date.now();
    
    // Only notify if status changed
    if (oldStatus?.online !== status.online) {
      this._notifyListeners(status);
    }
  }
  
  /**
   * Notify all listeners of status change
   * @private
   */
  _notifyListeners(status) {
    for (const listener of this._listeners) {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in online status listener:', error);
      }
    }
  }
  
  /**
   * Start periodic checking of online status
   * @private
   */
  _startPeriodicCheck() {
    // Check immediately on startup
    this.getStatus(true);
    
    // Clear any existing interval
    if (this._intervalId) {
      clearInterval(this._intervalId);
    }
    
    // Then check periodically
    this._intervalId = setInterval(() => {
      this.getStatus(true);
    }, this._checkInterval);
  }
  
  /**
   * Add window focus listener to check status when user returns to app
   * @private
   */
  _addWindowFocusListener() {
    if (typeof window !== 'undefined') {
      let lastFocusCheck = 0;
      
      window.addEventListener('focus', () => {
        // Only check if it's been more than 60 seconds since last check (rate limit protection)
        const now = Date.now();
        if (now - lastFocusCheck > 60000) {
          lastFocusCheck = now;
          this.getStatus(true);
        }
      });
      
      // Also check when the page becomes visible (handles tab switching)
      let lastVisibilityCheck = 0;
      
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          // Only check if it's been more than 60 seconds since last check (rate limit protection)
          const now = Date.now();
          if (now - lastVisibilityCheck > 60000) {
            lastVisibilityCheck = now;
            this.getStatus(true);
          }
        }
      });
    }
  }
  
  /**
   * Add browser network connectivity listeners
   * @private
   */
  _addNetworkListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.debug('📡 Browser detected network connection restored');
        this._hasNetworkConnectivity = true;
        // Force a status check when network comes back
        this.getStatus(true);
      });
      
      window.addEventListener('offline', () => {
        console.debug('📡 Browser detected network connection lost');
        this._hasNetworkConnectivity = false;
        // Notify listeners about network loss (but don't change backend status)
        const networkDownStatus = {
          online: this._onlineStatus?.online ?? true,
          lastUpdated: new Date().toISOString(),
          message: 'No internet connection. Working in offline mode with cached data.',
          hasNetworkConnectivity: false,
          networkIssue: true
        };
        this._notifyListeners(networkDownStatus);
      });
    }
  }
  
  /**
   * Clean up any resources
   */
  destroy() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }
}

// Singleton instance
export const onlineStatusService = new OnlineStatusService();

export default onlineStatusService;
