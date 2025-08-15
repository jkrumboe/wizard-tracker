import { useEffect, useRef } from 'react';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { useAuth } from '@/shared/hooks/useAuth';

/**
 * Component that handles automatic logout when online mode is disabled
 * This component should be placed inside both UserProvider and OnlineStatusProvider
 */
const AutoLogoutHandler = () => {
  const { isOnline } = useOnlineStatus();
  const { user, logout } = useAuth();
  const previousOnlineStatusRef = useRef(null);

  useEffect(() => {
    // Initialize the previous status on first load
    if (previousOnlineStatusRef.current === null) {
      previousOnlineStatusRef.current = isOnline;
      return;
    }

    // Check if we went from online to offline and there's a logged-in user
    if (previousOnlineStatusRef.current && !isOnline && user) {
      console.log('🔐 Online mode disabled - automatically logging out user');
      
      // Perform automatic logout
      logout().then(() => {
        console.log('✅ User automatically logged out due to offline mode');
      }).catch((error) => {
        console.error('❌ Error during automatic logout:', error);
      });
    }

    // Update the previous status
    previousOnlineStatusRef.current = isOnline;
  }, [isOnline, user, logout]);

  // This component doesn't render anything
  return null;
};

export default AutoLogoutHandler;
