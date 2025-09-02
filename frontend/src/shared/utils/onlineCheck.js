import { onlineStatusService } from '@/shared/api/onlineStatusService';

/**
 * Higher-order function that creates a wrapper for API functions
 * to check online status before making multiplayer requests
 * @param {Function} apiFn - The API function to wrap
 * @returns {Function} - The wrapped function
 */
export function withOnlineCheck(apiFn) {
  return async (...args) => {
    // Use checkNow() for immediate status check before critical operations
    const isOnline = await onlineStatusService.checkNow();
    
    if (!isOnline) {
      throw new Error('Online features are currently disabled. Please use local mode features only.');
    }
    
    return apiFn(...args);
  };
}

// Utility to add online check to all functions in an object
export function addOnlineChecksToAPI(api, excludePaths = []) {
  const wrapped = {};
  
  // Create wrapped versions of all functions
  for (const [key, value] of Object.entries(api)) {
    // Skip functions that should work in offline mode
    if (excludePaths.includes(key)) {
      wrapped[key] = value;
      continue;
    }
    
    // Wrap function with online check
    if (typeof value === 'function') {
      wrapped[key] = withOnlineCheck(value);
    } else {
      wrapped[key] = value;
    }
  }
  
  return wrapped;
}
