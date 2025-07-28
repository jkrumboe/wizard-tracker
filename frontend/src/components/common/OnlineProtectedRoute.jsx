import { Navigate, useLocation } from 'react-router-dom';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';

/**
 * Component to protect routes that require online mode
 * If system is offline, redirects to home page with a message
 */
const OnlineProtectedRoute = ({ children }) => {
  const { isOnline } = useOnlineStatus();
  const location = useLocation();

  if (!isOnline) {
    // If offline, redirect to home with state to show notification
    return (
      <Navigate 
        to="/" 
        state={{ 
          offlineRedirect: true, 
          message: "This feature is only available when the server is online",
          from: location.pathname
        }} 
        replace 
      />
    );
  }

  return children;
};

export default OnlineProtectedRoute;
