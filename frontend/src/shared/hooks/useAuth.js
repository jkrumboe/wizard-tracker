import { useContext } from 'react';
import { UserContext } from '@/shared/contexts/UserContext';

/**
 * Custom hook for authentication utilities
 * @returns {Object} Authentication utilities
 */
export function useAuth() {
  const { user, player, loading } = useContext(UserContext);

  /**
   * Check if user is authenticated
   * @returns {boolean} True if user is logged in
   */
  const isAuthenticated = () => {
    return !!user && !!user.id;
  };

  /**
   * Check if user is authenticated and throw error if not
   * @param {string} action - The action being attempted (for error message)
   * @throws {Error} If user is not authenticated
   */
  const requireAuthentication = (action = 'perform this action') => {
    if (!isAuthenticated()) {
      throw new Error(`You must be logged in to ${action}. Please sign in and try again.`);
    }
  };

  /**
   * Get the current user's authentication token
   * @returns {string|null} The auth token or null if not authenticated
   */
  const getAuthToken = () => {
    if (!isAuthenticated()) return null;
    return localStorage.getItem('auth_token');
  };

  return {
    user,
    player,
    loading,
    isAuthenticated,
    requireAuthentication,
    getAuthToken
  };
}
