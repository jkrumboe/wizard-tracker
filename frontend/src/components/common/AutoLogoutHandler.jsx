import { useEffect, useRef } from 'react';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { useAuth } from '@/shared/hooks/useAuth';

/**
 * Component that handles automatic logout when online mode is disabled
 * This component should be placed inside both UserProvider and OnlineStatusProvider
 * NOTE: Does NOT logout on network connectivity issues - only when backend is explicitly offline
 */
const AutoLogoutHandler = () => {
  const { isOnline, networkIssue } = useOnlineStatus();
  const { user, logout } = useAuth();
  const previousOnlineStatusRef = useRef(null);
  const hasInitializedRef = useRef(false);
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    // Initialize the previous status on first load
    if (!hasInitializedRef.current) {
      previousOnlineStatusRef.current = isOnline;
      hasInitializedRef.current = true;
      
      // If we're starting in offline mode (backend offline, not network issue) and there's a user, log them out
      if (!isOnline && !networkIssue && user && !isLoggingOutRef.current) {
        console.debug('🔐 App started with backend offline and logged-in user - logging out');
        isLoggingOutRef.current = true;
        logout().then(() => {
          console.debug('✅ User automatically logged out due to backend offline mode on startup');
          isLoggingOutRef.current = false;
        }).catch((error) => {
          console.error('❌ Error during startup logout:', error);
          isLoggingOutRef.current = false;
        });
      }
      return;
    }

    // Check if we went from online to offline AND it's not just a network issue
    if (previousOnlineStatusRef.current && !isOnline && !networkIssue && user && !isLoggingOutRef.current) {
      console.debug('🔐 Backend went offline (not network issue) - automatically logging out user');
      
      // Perform automatic logout
      isLoggingOutRef.current = true;
      logout().then(() => {
        console.debug('✅ User automatically logged out due to backend offline mode');
        isLoggingOutRef.current = false;
      }).catch((error) => {
        console.error('❌ Error during automatic logout:', error);
        isLoggingOutRef.current = false;
      });
    } else if (!isOnline && networkIssue && user) {
      // Network issue detected - keep user logged in
      console.debug('📡 Network issue detected - keeping user session active with cached data');
    }

    // Update the previous status
    previousOnlineStatusRef.current = isOnline;
  }, [isOnline, networkIssue, user, logout]);

  // This component doesn't render anything
  return null;
};

export default AutoLogoutHandler;
