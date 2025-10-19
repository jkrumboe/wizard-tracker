import { API_ENDPOINTS, SKIP_BACKEND } from './config.js';

class UserService {
  constructor() {
    // Use the centralized API configuration
    this.baseURL = API_ENDPOINTS.base;
    // Skip backend calls in development if no backend URL is configured
    this.skipBackend = SKIP_BACKEND;
  }

  async updateUserName(userId, name) {
    // Skip backend call if in development mode without configured backend
    if (this.skipBackend) {
      console.debug('⚠️ SKIP_BACKEND is true - backend not configured for dev mode');
      throw new Error('Backend server not available - will use fallback method');
    }
    
    try {
      // Get the auth token from localStorage
      const token = localStorage.getItem('authToken');
      const endpoint = API_ENDPOINTS.users.updateName(userId);
      
      console.debug('🔄 Updating username via backend:', { endpoint, userId, name, hasToken: !!token });
      
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        console.error('❌ Backend update failed:', { status: response.status, error });
        throw new Error(error.message || error.error || 'Failed to update username');
      }

      const result = await response.json();
      console.debug('✅ Backend update successful:', result);
      
      // If backend returns a new token (because username changed), update it
      if (result.token) {
        console.debug('🔑 Updating auth token with new username');
        localStorage.setItem('authToken', result.token);
      }
      
      return result;
    } catch (error) {
      // Check if it's a network error (backend not available)
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        // Don't log error for expected connection refused (backend not running)
        throw new Error('Backend server not available - will use fallback method');
      }
      console.error('Error updating username:', error);
      throw new Error(error.message || 'Failed to update username');
    }
  }

  async getUserById(userId) {
    try {
      const response = await fetch(`${this.baseURL}/api/users/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Include authorization header if your backend requires authentication
          // 'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get user');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting user:', error);
      throw new Error(error.message || 'Failed to get user');
    }
  }
}

export const userService = new UserService();
export default userService;
