#!/usr/bin/env node

/**
 * Online Mode CLI
 * 
 * This script provides a command-line interface to manage the online/offline mode.
 * Usage: node online-cli.js [status|on|off] [reason]
 */

import { getOnlineStatus, setOnlineStatus } from './config/online-mode.js';

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();
const reason = args.slice(1).join(' ') || 'Manual update';

switch (command) {
  case 'status':
    await showStatus();
    break;
    
  case 'true':
  case 'on':
  case 'online':
    await setOnline(true, reason);
    break;
    
  case 'false':
  case 'off':
  case 'offline':
    await setOnline(false, reason);
    break;
    
  default:
    await showHelp();
}

async function showStatus() {
  const status = await getOnlineStatus();
  console.log('Current status:', status.online ? 'ONLINE' : 'OFFLINE');
  console.log('Last updated:', new Date(status.lastUpdated).toLocaleString());
  console.log('Reason:', status.reason || 'N/A');
}

async function setOnline(online, reason) {
  try {
    const status = await setOnlineStatus(online, reason);
    console.log(`✅ Online mode set to: ${online ? 'ONLINE' : 'OFFLINE'}`);
    console.log(`Timestamp: ${new Date(status.lastUpdated).toLocaleString()}`);
    console.log(`Reason: ${status.reason}`);
  } catch (error) {
    console.error('❌ Error setting online status:', error.message);
    
    if (error.code === 'EACCES') {
      console.error('\nPermission denied. Try using root to change settings:');
      console.error('  docker exec -it -u root wizard-tracker-backend-1 node src/online-cli.js ' + (online ? 'on' : 'off') + ' "' + reason + '"');
      console.error('\nIf this persists, verify that the config directory is properly mounted');
    }
  }
}

async function showHelp() {
  console.log('Usage: node online-cli.js [status|on|off|online|offline] [reason]');
  console.log('Commands:');
  console.log('  status         Show current online/offline status');
  console.log('  on, online     Enable online features');
  console.log('  off, offline   Disable online features');
  console.log('');
  console.log('Examples:');
  console.log('  node online-cli.js status');
  console.log('  node online-cli.js off "Server maintenance"');
  console.log('  node online-cli.js on "Maintenance complete"');
  
  // Show current status
  console.log('');
  await showStatus();
}
