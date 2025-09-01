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
    this._checkInterval = 60000; // Check every minute
    this._listeners = [];
    
    // Start periodic checking
    this._startPeriodicCheck();
  }
  
  /**
   * Get the current online status
   * @param {boolean} forceCheck - Whether to force a fresh check
   * @returns {Promise<{online: boolean, lastUpdated: string, message: string}>}
   */
  async getStatus(forceCheck = false) {
    // If we have a cached status and it's recent, use it
    const now = Date.now();
    if (!forceCheck && this._onlineStatus && this._lastChecked && (now - this._lastChecked < this._checkInterval)) {
      return this._onlineStatus;
    }
    
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
            'Online features are currently disabled for maintenance')
        };

        this._updateStatus(status);
        return status;
      } else {
        // If the endpoint fails, fall back to offline mode
        const offlineStatus = {
          online: false,
          lastUpdated: new Date().toISOString(),
          message: 'Unable to check online status - operating in offline mode'
        };
        
        this._updateStatus(offlineStatus);
        return offlineStatus;
      }
    } catch (error) {
      console.error('Error checking online status:', error);
      
      // If we can't reach the server, assume offline
      const offlineStatus = { 
        online: false, 
        lastUpdated: new Date().toISOString(),
        message: 'Unable to connect to server. Operating in offline mode.'
      };
      
      this._updateStatus(offlineStatus);
      return offlineStatus;
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
    
    // Then check periodically
    setInterval(() => {
      this.getStatus(true);
    }, this._checkInterval);
  }
  
  /**
   * Clean up any resources (placeholder for future use)
   */
  destroy() {
    // Nothing to clean up in this simple implementation
  }
}

// Singleton instance
export const onlineStatusService = new OnlineStatusService();

export default onlineStatusService;
