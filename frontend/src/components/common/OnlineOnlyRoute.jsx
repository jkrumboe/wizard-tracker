import React from 'react';
import { Navigate } from 'react-router-dom';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';

/**
 * A wrapper component that redirects to the home page with a message
 * when the application is in offline mode and the user tries to access
 * online-only features.
 */
const OnlineOnlyRoute = ({ children }) => {
  const { isOnline } = useOnlineStatus();

  if (!isOnline) {
    // Redirect to home page if not online
    return <Navigate to="/" replace state={{ 
      offlineMessage: 'This feature is only available when online mode is enabled.' 
    }} />;
  }

  return children;
};

export default OnlineOnlyRoute;
