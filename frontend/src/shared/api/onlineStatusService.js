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
      // Check if the backend is available by pinging the health endpoint
      const response = await fetch(`${API_ENDPOINTS.base}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add a timeout
        signal: AbortSignal.timeout(5000)
      });

      const isOnline = response.ok;
      
      const status = {
        online: isOnline,
        lastUpdated: new Date().toISOString(),
        message: isOnline
          ? 'All features are available'
          : 'Backend server is not available. Only local features are available.'
      };

      this._updateStatus(status);
      return status;
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
