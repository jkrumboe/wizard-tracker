import { createContext, useState, useEffect } from 'react';
import { onlineStatusService } from '../services/onlineStatusService';

// Create context
const OnlineStatusContext = createContext({
  isOnline: true,
  lastUpdated: null,
  message: ''
});

// Provider component
export function OnlineStatusProvider({ children }) {
  const [onlineStatus, setOnlineStatus] = useState({
    isOnline: true,
    lastUpdated: null,
    message: ''
  });

  useEffect(() => {
    // Initial check
    onlineStatusService.getStatus().then(status => {
      setOnlineStatus({
        isOnline: status.online,
        lastUpdated: status.lastUpdated,
        message: status.message
      });
    });

    // Add listener for changes
    const removeListener = onlineStatusService.addStatusListener(status => {
      setOnlineStatus({
        isOnline: status.online,
        lastUpdated: status.lastUpdated,
        message: status.message
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
