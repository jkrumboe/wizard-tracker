/**
 * @fileoverview Hook for tracking online/offline status
 * Provides reactive online status updates with proper cleanup
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to track the browser's online/offline status
 * @returns {Object} { isOnline: boolean, checkOnlineStatus: () => boolean }
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    // Initial status from navigator
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const checkOnlineStatus = useCallback(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      console.debug('🌐 Network status: Online');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.debug('📴 Network status: Offline');
      setIsOnline(false);
    };

    // Add event listeners for online/offline events
    globalThis.addEventListener('online', handleOnline);
    globalThis.addEventListener('offline', handleOffline);

    // Cleanup on unmount
    return () => {
      globalThis.removeEventListener('online', handleOnline);
      globalThis.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, checkOnlineStatus };
}

export default useOnlineStatus;
