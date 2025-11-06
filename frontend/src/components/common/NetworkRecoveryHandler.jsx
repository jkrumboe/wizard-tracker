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
import { Notification } from '@/components/ui';

/**
 * NetworkRecoveryHandler - Handles automatic recovery during network changes
 */
export function NetworkRecoveryHandler() {
  const { isOnline } = useOnlineStatus();
  const [showRecoveryNotification, setShowRecoveryNotification] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [previousOnlineState, setPreviousOnlineState] = useState(isOnline);

  useEffect(() => {
    // Detect transition from offline to online
    if (isOnline && !previousOnlineState) {
      handleReconnection();
    } else if (!isOnline && previousOnlineState) {
      handleDisconnection();
    }
    
    setPreviousOnlineState(isOnline);
  }, [isOnline, previousOnlineState]);

  /**
   * Handle disconnection event
   */
  const handleDisconnection = async () => {
    console.debug('📡 Network disconnected - saving state...');
    
    // Save all state immediately
    await stateRecovery.saveAllState({ immediate: true });
    await sessionCache.set('last_online_time', Date.now(), { persist: true });
    
    // Show notification
    setRecoveryMessage('You are now offline. Your data will be preserved.');
    setShowRecoveryNotification(true);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setShowRecoveryNotification(false);
    }, 5000);
  };

  /**
   * Handle reconnection event
   */
  const handleReconnection = async () => {
    console.debug('📡 Network reconnected - attempting recovery...');
    
    try {
      // Check if there's recoverable state
      const recoveryInfo = await stateRecovery.hasRecoverableState();
      
      if (recoveryInfo.hasRecovery) {
        // Attempt to recover all states
        const recovered = await stateRecovery.attemptRecovery();
        
        if (recovered.length > 0) {
          console.debug(`✅ Recovered ${recovered.length} states:`, recovered);
          
          // Show success notification
          setRecoveryMessage(`Welcome back! Your session has been restored.`);
          setShowRecoveryNotification(true);
          
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
      {/* {showRecoveryNotification && (
        <Notification
          type="info"
          message={recoveryMessage}
          onClose={() => setShowRecoveryNotification(false)}
          duration={0} // Manual control via setTimeout
        />
      )} */}
    </>
  );
}

export default NetworkRecoveryHandler;
