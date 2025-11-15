/**
 * @fileoverview Network Recovery Handler
 * 
 * Component that monitors network status and handles automatic session recovery
 * when connection is restored or when transitioning between online/offline modes.
 */

import { useEffect, useState } from 'react';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { stateRecovery } from '@/shared/utils/stateRecovery';
import { sessionCache } from '@/shared/utils/sessionCache';

/**
 * NetworkRecoveryHandler - Handles automatic recovery during network changes
 */
export function NetworkRecoveryHandler() {
  const { isOnline, hasNetworkConnectivity, networkIssue } = useOnlineStatus();
  const [previousOnlineState, setPreviousOnlineState] = useState(isOnline);
  const [previousNetworkState, setPreviousNetworkState] = useState(hasNetworkConnectivity);

  useEffect(() => {
    // Detect network connectivity loss (browser offline)
    if (hasNetworkConnectivity && !previousNetworkState) {
      handleNetworkRestored();
    } else if (!hasNetworkConnectivity && previousNetworkState) {
      handleNetworkLost();
    }
    
    // Detect backend online status change (not network issue)
    if (isOnline && !previousOnlineState && !networkIssue) {
      handleBackendReconnection();
    } else if (!isOnline && previousOnlineState && !networkIssue) {
      handleBackendDisconnection();
    }
    
    setPreviousOnlineState(isOnline);
    setPreviousNetworkState(hasNetworkConnectivity);
  }, [isOnline, hasNetworkConnectivity, networkIssue, previousOnlineState, previousNetworkState]);

  /**
   * Handle network connectivity loss (browser offline)
   */
  const handleNetworkLost = async () => {
    console.debug('📡 Network connection lost - preserving all data...');
    
    // Save all state immediately
    await stateRecovery.saveAllState({ immediate: true });
    await sessionCache.set('last_online_time', Date.now(), { persist: true });
  };

  /**
   * Handle network connectivity restored (browser online)
   */
  const handleNetworkRestored = async () => {
    console.debug('📡 Network connection restored');
    
    // Update last online time
    await sessionCache.set('last_online_time', Date.now(), { persist: true });
  };

  /**
   * Handle backend disconnection (intentional offline mode)
   */
  const handleBackendDisconnection = async () => {
    console.debug('📡 Backend went offline - saving state...');
    
    // Save all state immediately
    await stateRecovery.saveAllState({ immediate: true });
    await sessionCache.set('last_online_time', Date.now(), { persist: true });
  };

  /**
   * Handle backend reconnection
   */
  const handleBackendReconnection = async () => {
    console.debug('📡 Backend reconnected - attempting recovery...');
    
    try {
      // Check if there's recoverable state
      const recoveryInfo = await stateRecovery.hasRecoverableState();
      
      if (recoveryInfo.hasRecovery) {
        // Attempt to recover all states
        const recovered = await stateRecovery.attemptRecovery();
        
        if (recovered.length > 0) {
          console.debug(`✅ Recovered ${recovered.length} states:`, recovered);
        }
      } else {
        // No recovery needed
        console.debug('✅ Back online - no recovery needed');
      }
      
      // Update last online time
      await sessionCache.set('last_online_time', Date.now(), { persist: true });
    } catch (error) {
      console.error('Error during reconnection recovery:', error);
    }
  };

  // Handle page visibility changes (tab switching)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        // Tab became visible - check for recovery
        const recoveryInfo = await stateRecovery.hasRecoverableState();
        
        if (recoveryInfo.hasRecovery) {
          // Check if any states are older than 10 seconds (indicates possible crash/disconnect)
          const hasStaleState = recoveryInfo.states.some(state => state.age > 10000);
          
          if (hasStaleState) {
            console.debug('🔄 Detected stale state, attempting recovery...');
            await stateRecovery.attemptRecovery();
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Check for recovery on mount (handles page reloads)
  useEffect(() => {
    const checkForRecoveryOnMount = async () => {
      try {
        const recoveryInfo = await stateRecovery.hasRecoverableState();
        
        if (recoveryInfo.hasRecovery) {
          // Check if we have recent unsaved state (within last 5 minutes)
          const hasRecentState = recoveryInfo.states.some(
            state => state.age < 5 * 60 * 1000
          );
          
          if (hasRecentState) {
            console.debug('🔄 Found recent state on mount, attempting recovery...');
            await stateRecovery.attemptRecovery();
          }
        }
      } catch (error) {
        console.error('Error checking for recovery on mount:', error);
      }
    };
    
    // Wait a bit before checking to let other components initialize
    const timer = setTimeout(checkForRecoveryOnMount, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  return null;
}

export default NetworkRecoveryHandler;
