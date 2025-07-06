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

// Various possible paths to the config file
const CONFIG_FILE = path.join(__dirname, 'online-status.json');
const ALT_CONFIG_FILE = '/app/src/config/online-status.json';
const MOUNTED_CONFIG_FILE = '/app/config/online-status.json';

console.log(`Checking config paths: 
1. ${CONFIG_FILE}
2. ${ALT_CONFIG_FILE}
3. ${MOUNTED_CONFIG_FILE}`);

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
    // Check all possible config file locations
    if (fs.existsSync(CONFIG_FILE)) {
      console.log(`Using config file at: ${CONFIG_FILE}`);
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    } 
    else if (fs.existsSync(ALT_CONFIG_FILE)) {
      console.log(`Using config file at: ${ALT_CONFIG_FILE}`);
      const data = fs.readFileSync(ALT_CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
    else if (fs.existsSync(MOUNTED_CONFIG_FILE)) {
      console.log(`Using config file at: ${MOUNTED_CONFIG_FILE}`);
      const data = fs.readFileSync(MOUNTED_CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
    // If no config file exists, create it with default config
    else {
      console.log('No config file found at any location, creating default configuration...');
      setOnlineStatus(DEFAULT_CONFIG.online, 'Initial configuration');
      return DEFAULT_CONFIG;
    }
  } catch (error) {
    console.error('Error reading online status:', error);
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
  try {
    const config = {
      online: Boolean(online),
      lastUpdated: new Date().toISOString(),
      reason: reason
    };
    
    // Try to write to all config file locations
    let success = false;
    
    // Try the primary location
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
      console.log(`✅ Successfully wrote config to ${CONFIG_FILE}`);
      success = true;
    } catch (error) {
      console.log(`❌ Unable to write to primary config location: ${error.message}`);
    }
    
    // Try the alternative location
    try {
      fs.writeFileSync(ALT_CONFIG_FILE, JSON.stringify(config, null, 2));
      console.log(`✅ Successfully wrote config to ${ALT_CONFIG_FILE}`);
      success = true;
    } catch (error) {
      console.log(`❌ Unable to write to alternative config location: ${error.message}`);
    }
    
    // Try the mounted location
    try {
      fs.writeFileSync(MOUNTED_CONFIG_FILE, JSON.stringify(config, null, 2));
      console.log(`✅ Successfully wrote config to ${MOUNTED_CONFIG_FILE}`);
      success = true;
    } catch (error) {
      console.log(`❌ Unable to write to mounted config location: ${error.message}`);
    }
    
    if (!success) {
      throw new Error('Failed to write to ANY config location. Check permissions and paths.');
    }
    
    // Create a more visible log message for status changes
    if (online) {
      console.log('🟢ONLINE MODE ENABLED - SERVERS ONLINE FEATURES ARE ONLINE🟢');
      } else {
      console.log('🔴OFFLINE MODE ENABLED - SERVERS ONLINE FEATURES ARE OFFLINE🔴');
      }
    console.log(`\nReason: ${reason}`);
    console.log('\n');
    
    return config;
  } catch (error) {
    console.error('Error setting online status:', error);
    throw error;
  }
}

/**
 * Check if the system is in online mode
 * @returns {boolean} True if online, false if offline
 */
function isOnline() {
  return getOnlineStatus().online;
}

// CLI functionality moved to online-cli.js

// Export functions for ES modules
export {
  getOnlineStatus,
  setOnlineStatus,
  isOnline
};
