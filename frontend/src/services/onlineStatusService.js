/**
 * Online Status Service
 * 
 * Handles checking if online features are available
 */

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
   * @param {boolean} forceCheck - Force a fresh check from the server
   * @returns {Promise<{online: boolean, lastUpdated: string, message: string}>}
   */
  async getStatus(forceCheck = false) {
    // If we have a cached status and it's recent, use it
    const now = Date.now();
    if (!forceCheck && this._onlineStatus && this._lastChecked && (now - this._lastChecked < this._checkInterval)) {
      return this._onlineStatus;
    }
    
    try {
      const response = await fetch('/api/online/status');
      if (!response.ok) {
        throw new Error(`Failed to check online status: ${response.status}`);
      }
      
      const status = await response.json();
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
}

// Singleton instance
export const onlineStatusService = new OnlineStatusService();

export default onlineStatusService;
