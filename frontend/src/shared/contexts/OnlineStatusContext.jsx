import { createContext, useState, useEffect } from 'react';
import { onlineStatusService } from '../api/onlineStatusService';

// Create context
const OnlineStatusContext = createContext({
  isOnline: false, // Start as offline until we know for sure
  lastUpdated: null,
  message: 'Checking online status...',
  hasNetworkConnectivity: true,
  networkIssue: false
});

// Provider component
export function OnlineStatusProvider({ children }) {
  const [onlineStatus, setOnlineStatus] = useState({
    isOnline: false, // Start as offline until we know for sure
    lastUpdated: null,
    message: 'Checking online status...',
    hasNetworkConnectivity: true,
    networkIssue: false
  });

  useEffect(() => {
    // Initial check
    onlineStatusService.getStatus().then(status => {
      setOnlineStatus({
        isOnline: status.online,
        lastUpdated: status.lastUpdated,
        message: status.message,
        hasNetworkConnectivity: status.hasNetworkConnectivity ?? true,
        networkIssue: status.networkIssue ?? false
      });
    });

    // Add listener for changes
    const removeListener = onlineStatusService.addStatusListener(status => {
      setOnlineStatus({
        isOnline: status.online,
        lastUpdated: status.lastUpdated,
        message: status.message,
        hasNetworkConnectivity: status.hasNetworkConnectivity ?? true,
        networkIssue: status.networkIssue ?? false
      });
    });

    return () => {
      // Clean up listener
      removeListener();
    };
  }, []);

  return (
    <OnlineStatusContext.Provider value={onlineStatus}>
      {children}
    </OnlineStatusContext.Provider>
  );
}

export default OnlineStatusContext;
