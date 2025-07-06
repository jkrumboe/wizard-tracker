import { useContext } from 'react';
import OnlineStatusContext from '../contexts/OnlineStatusContext';

// Hook for components to use
export function useOnlineStatus() {
  return useContext(OnlineStatusContext);
}

export default useOnlineStatus;
