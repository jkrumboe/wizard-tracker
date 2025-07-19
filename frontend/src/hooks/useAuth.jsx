import { useContext } from 'react';
import { UserContext } from '@/contexts/UserContext';
import authService from '@/services/authService';

// Enhanced auth hook that works with the new user-player separation schema
export function useAuth() {
  const context = useContext(UserContext);
  
  if (!context) {
    throw new Error('useAuth must be used within a UserProvider');
  }
  
  const logout = async () => {
    try {
      await authService.logout();
      context.clearUserData();
    } catch (error) {
      console.error('Logout error:', error);
      // Clear local state even if server logout fails
      localStorage.removeItem('token');
      context.clearUserData();
    }
  };

  return {
    // User authentication data
    user: context.user,
    // Player game-related data (linked to user)
    player: context.player,
    loading: context.loading,
    isAuthenticated: !!context.user,
    
    // Authentication actions
    logout,
    refreshAuthStatus: context.refreshAuthStatus,
    
    // Player data management
    refreshPlayerData: context.refreshPlayerData,
    updatePlayerData: context.updatePlayerData,
  };
}

export default useAuth;
