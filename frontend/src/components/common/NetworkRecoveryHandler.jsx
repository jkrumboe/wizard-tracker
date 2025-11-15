/**
 * @fileoverview Network Recovery Handler
 * 
 * Component that monitors network status and handles automatic session recovery
 * when connection is restored or when transitioning between online/offline modes.
 * Shows non-intrusive notification when network is lost without disrupting the UI.
 */

import { useEffect, useState } from 'react';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { stateRecovery } from '@/shared/utils/stateRecovery';
import { sessionCache } from '@/shared/utils/sessionCache';
import { Notification } from '@/components/ui';

/**
 * NetworkRecoveryHandler - Handles automatic recovery during network changes
 */
export function NetworkRecoveryHandler() {
  const { isOnline, hasNetworkConnectivity, networkIssue } = useOnlineStatus();
  const [showRecoveryNotification, setShowRecoveryNotification] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
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
    
    // Show non-intrusive notification
    // setRecoveryMessage('📡 No internet connection. Your data is safe and will sync when connection returns.');
    // setShowRecoveryNotification(true);
    
    // Keep notification visible until network returns
  };

  /**
   * Handle network connectivity restored (browser online)
   */
  const handleNetworkRestored = async () => {
    console.debug('📡 Network connection restored');
    
    // Show brief notification
    setRecoveryMessage('✅ Internet connection restored');
    setShowRecoveryNotification(true);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setShowRecoveryNotification(false);
    }, 3000);
    
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
    
    // Show notification
    setRecoveryMessage('Backend is offline for maintenance. Your data will be preserved.');
    setShowRecoveryNotification(true);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setShowRecoveryNotification(false);
    }, 5000);
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
          
          // Show success notification
          // setRecoveryMessage(`Welcome back! Your session has been restored.`);
          // setShowRecoveryNotification(true);
          
          // Auto-hide after 5 seconds
          setTimeout(() => {
            setShowRecoveryNotification(false);
          }, 5000);
        }
      } else {
        // No recovery needed
        console.debug('✅ Back online - no recovery needed');
        
        // Just show brief notification
        setRecoveryMessage('Back online');
        setShowRecoveryNotification(true);
        
        setTimeout(() => {
          setShowRecoveryNotification(false);
        }, 3000);
      }
      
      // Update last online time
      await sessionCache.set('last_online_time', Date.now(), { persist: true });
    } catch (error) {
      console.error('Error during reconnection recovery:', error);
      
      // Show error notification
      setRecoveryMessage('Reconnected, but some data may not have been restored.');
      setShowRecoveryNotification(true);
      
      setTimeout(() => {
        setShowRecoveryNotification(false);
      }, 5000);
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
            
            setRecoveryMessage('Your session has been restored.');
            setShowRecoveryNotification(true);
            
            setTimeout(() => {
              setShowRecoveryNotification(false);
            }, 4000);
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
            const recovered = await stateRecovery.attemptRecovery();
            
            if (recovered.length > 0) {
              setRecoveryMessage('Your previous session has been restored.');
              setShowRecoveryNotification(true);
              
              setTimeout(() => {
                setShowRecoveryNotification(false);
              }, 5000);
            }
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

  return (
    <>
      {showRecoveryNotification && (
        <Notification
          type="info"
          message={recoveryMessage}
          onClose={() => setShowRecoveryNotification(false)}
          duration={0} // Manual control via setTimeout
        />
      )}
      
      {/* Persistent network status indicator when offline */}
      {/* {!hasNetworkConnectivity && (
        <div style={{
          position: 'fixed',
          top: '60px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#ff9800',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          fontSize: '14px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>📡</span>
          <span>No internet connection - Working offline</span>
        </div>
      )} */}
    </>
  );
}

export default NetworkRecoveryHandler;
