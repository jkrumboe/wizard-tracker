import { useContext } from 'react';
import { OnlineStatusContext } from '@/shared/contexts';

// Hook for components to use
export function useOnlineStatus() {
  return useContext(OnlineStatusContext);
}

export default useOnlineStatus;
