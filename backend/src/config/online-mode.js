/**
 * Online Mode Configuration
 * 
 * This file manages the online/offline mode for the application.
 * When in offline mode, multiplayer features will be disabled.
 * 
 * This can only be changed by running node commands inside the container.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name for ESM modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, 'online-status.json');

// Default configuration
const DEFAULT_CONFIG = {
  online: false, // Start in offline mode by default
  lastUpdated: new Date().toISOString(),
  reason: 'Server started in offline mode by default'
};

/**
 * Get the current online status
 * @returns {Object} The current configuration
 */
function getOnlineStatus() {
  try {
    // Check if the config file exists
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    } 
    // If no config file exists, create it with default config
    else {
      setOnlineStatus(DEFAULT_CONFIG.online, 'Initial configuration');
      return DEFAULT_CONFIG;
    }
  } catch (error) {
    return DEFAULT_CONFIG;
  }
}

/**
 * Set the online status
 * @param {boolean} online - Whether the system should be online
 * @param {string} reason - Reason for the change
 * @returns {Object} The updated configuration
 */
function setOnlineStatus(online, reason = 'Manual update') {
  const config = {
    online: Boolean(online),
    lastUpdated: new Date().toISOString(),
    reason
  };
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new Error('Failed to write config file');
  }
  return config;
}

/**
 * Check if the system is in online mode
 * @returns {boolean} True if online, false if offline
 */
function isOnline() {
  return getOnlineStatus().online;
}

// Export functions for ES modules
export {
  getOnlineStatus,
  setOnlineStatus,
  isOnline
};
