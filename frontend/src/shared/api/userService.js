import { API_ENDPOINTS, SKIP_BACKEND } from './config.js';

class UserService {
  constructor() {
    // Use the centralized API configuration
    this.baseURL = API_ENDPOINTS.base;
    // Skip backend calls in development if no backend URL is configured
    this.skipBackend = SKIP_BACKEND;
  }

  async getAllUsers() {
    if (this.skipBackend) {
      throw new Error('Backend server not available');
    }
    
    try {
      const token = localStorage.getItem('auth_token');
      const endpoint = `${this.baseURL}/api/users/admin/all`;
      
      console.log('UserService.getAllUsers() - Fetching from:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch users' }));
        throw new Error(error.error || 'Failed to fetch users');
      }

      const result = await response.json();
      console.log('UserService.getAllUsers() - Response:', result);
      return result;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  async updateUsername(userId, newUsername) {
    if (this.skipBackend) {
      throw new Error('Backend server not available');
    }
    
    try {
      const token = localStorage.getItem('auth_token');
      const endpoint = `${this.baseURL}/api/users/${userId}/username`;
      
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: newUsername }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to update username' }));
        throw new Error(error.error || 'Failed to update username');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating username:', error);
      throw error;
    }
  }

  async updateUserRole(userId, role) {
    if (this.skipBackend) {
      throw new Error('Backend server not available');
    }
    
    try {
      const token = localStorage.getItem('auth_token');
      const endpoint = `${this.baseURL}/api/users/${userId}/role`;
      
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to update role' }));
        throw new Error(error.error || 'Failed to update role');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating role:', error);
      throw error;
    }
  }

  async updateUserName(userId, name) {
    // Skip backend call if in development mode without configured backend
    if (this.skipBackend) {
      throw new Error('Backend server not available - will use fallback method');
    }
    
    try {
      // Get the auth token from localStorage (use correct key 'auth_token')
      const token = localStorage.getItem('auth_token');
      const endpoint = API_ENDPOINTS.users.updateName(userId);
      
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
      
      // If backend returns a new token (because username changed), update it
      if (result.token) {
        localStorage.setItem('auth_token', result.token);
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

  async lookupUserByUsername(username) {
    // Skip backend call if in development mode without configured backend
    if (this.skipBackend) {
      return { found: false };
    }

    try {
      const endpoint = API_ENDPOINTS.users.lookup(username);
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 404) {
        return { found: false };
      }

      if (!response.ok) {
        console.warn('Failed to lookup user:', response.status);
        return { found: false };
      }

      const result = await response.json();
      return result;
    } catch (error) {
      // Network error - backend not available
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        return { found: false };
      }
      console.error('Error looking up user:', error);
      return { found: false };
    }
  }

  async getAllUsers() {
    // Skip backend call if in development mode without configured backend
    if (this.skipBackend) {
      console.warn('⚠️ Skipping backend call - no VITE_API_BASE_URL configured');
      return [];
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('❌ No auth token found');
        throw new Error('Not authenticated');
      }

      console.log('📡 Fetching all users from:', API_ENDPOINTS.users.all);
      const response = await fetch(API_ENDPOINTS.users.all, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to get users' }));
        console.error('❌ Backend error:', error);
        throw new Error(error.message || error.error || 'Failed to get users');
      }

      const result = await response.json();
      console.log('✅ Received users:', result);
      return result.users || [];
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        console.error('❌ Network error - backend not reachable');
        return [];
      }
      console.error('❌ Error getting users:', error);
      return [];
    }
  }

  async getFriends(userId) {
    // Skip backend call if in development mode without configured backend
    if (this.skipBackend) {
      return [];
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const endpoint = API_ENDPOINTS.users.friends(userId);
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to get friends' }));
        throw new Error(error.message || error.error || 'Failed to get friends');
      }

      const result = await response.json();
      return result.friends || [];
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        return [];
      }
      console.error('Error getting friends:', error);
      return [];
    }
  }

  async addFriend(userId, friendId) {
    // Skip backend call if in development mode without configured backend
    if (this.skipBackend) {
      throw new Error('Backend server not available');
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const endpoint = API_ENDPOINTS.users.addFriend(userId, friendId);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to add friend' }));
        throw new Error(error.message || error.error || 'Failed to add friend');
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Backend server not available');
      }
      console.error('Error adding friend:', error);
      throw error;
    }
  }

  async removeFriend(userId, friendId) {
    // Skip backend call if in development mode without configured backend
    if (this.skipBackend) {
      throw new Error('Backend server not available');
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const endpoint = API_ENDPOINTS.users.removeFriend(userId, friendId);
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to remove friend' }));
        throw new Error(error.message || error.error || 'Failed to remove friend');
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Backend server not available');
      }
      console.error('Error removing friend:', error);
      throw error;
    }
  }

  // ============ FRIEND REQUEST METHODS ============

  async sendFriendRequest(userId, receiverId) {
    // Skip backend call if in development mode without configured backend
    if (this.skipBackend) {
      throw new Error('Backend server not available');
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const endpoint = `${this.baseURL}/api/users/${userId}/friend-requests`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ receiverId }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to send friend request' }));
        throw new Error(error.message || error.error || 'Failed to send friend request');
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Backend server not available');
      }
      console.error('Error sending friend request:', error);
      throw error;
    }
  }

  async getReceivedFriendRequests(userId) {
    // Skip backend call if in development mode without configured backend
    if (this.skipBackend) {
      return [];
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const endpoint = `${this.baseURL}/api/users/${userId}/friend-requests/received`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to get friend requests' }));
        throw new Error(error.message || error.error || 'Failed to get friend requests');
      }

      const result = await response.json();
      return result.requests || [];
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        return [];
      }
      console.error('Error getting received friend requests:', error);
      return [];
    }
  }

  async getSentFriendRequests(userId) {
    // Skip backend call if in development mode without configured backend
    if (this.skipBackend) {
      return [];
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const endpoint = `${this.baseURL}/api/users/${userId}/friend-requests/sent`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to get sent requests' }));
        throw new Error(error.message || error.error || 'Failed to get sent requests');
      }

      const result = await response.json();
      return result.requests || [];
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        return [];
      }
      console.error('Error getting sent friend requests:', error);
      return [];
    }
  }

  // Batch endpoint to get all friends data in one request (reduces polling overhead)
  async getFriendsBatchCheck(userId) {
    // Skip backend call if in development mode without configured backend
    if (this.skipBackend) {
      return { friends: [], receivedRequests: [], sentRequests: [] };
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const endpoint = `${this.baseURL}/api/users/${userId}/friends/batch-check`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch friends data' }));
        throw new Error(error.message || error.error || 'Failed to fetch friends data');
      }

      const result = await response.json();
      return {
        friends: result.friends || [],
        receivedRequests: result.receivedRequests || [],
        sentRequests: result.sentRequests || []
      };
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        return { friends: [], receivedRequests: [], sentRequests: [] };
      }
      console.error('Error getting friends batch data:', error);
      return { friends: [], receivedRequests: [], sentRequests: [] };
    }
  }

  async acceptFriendRequest(userId, requestId) {
    // Skip backend call if in development mode without configured backend
    if (this.skipBackend) {
      throw new Error('Backend server not available');
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const endpoint = `${this.baseURL}/api/users/${userId}/friend-requests/${requestId}/accept`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to accept friend request' }));
        throw new Error(error.message || error.error || 'Failed to accept friend request');
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Backend server not available');
      }
      console.error('Error accepting friend request:', error);
      throw error;
    }
  }

  async rejectFriendRequest(userId, requestId) {
    // Skip backend call if in development mode without configured backend
    if (this.skipBackend) {
      throw new Error('Backend server not available');
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const endpoint = `${this.baseURL}/api/users/${userId}/friend-requests/${requestId}/reject`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to reject friend request' }));
        throw new Error(error.message || error.error || 'Failed to reject friend request');
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Backend server not available');
      }
      console.error('Error rejecting friend request:', error);
      throw error;
    }
  }

  async cancelFriendRequest(userId, requestId) {
    // Skip backend call if in development mode without configured backend
    if (this.skipBackend) {
      throw new Error('Backend server not available');
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const endpoint = `${this.baseURL}/api/users/${userId}/friend-requests/${requestId}`;
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to cancel friend request' }));
        throw new Error(error.message || error.error || 'Failed to cancel friend request');
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Backend server not available');
      }
      console.error('Error canceling friend request:', error);
      throw error;
    }
  }

  async getUserPublicProfile(usernameOrId) {
    if (this.skipBackend) {
      throw new Error('Backend server not available');
    }

    try {
      const endpoint = `${this.baseURL}/api/users/${usernameOrId}/profile`;
      
      console.log('UserService.getUserPublicProfile() - Fetching from:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch user profile' }));
        throw new Error(error.error || 'Failed to fetch user profile');
      }

      const result = await response.json();
      console.log('UserService.getUserPublicProfile() - Response:', result);
      return result;
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Backend server not available');
      }
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }
}

export const userService = new UserService();
export default userService;

// Named exports for common methods
export const getUserPublicProfile = (usernameOrId) => userService.getUserPublicProfile(usernameOrId);
export const lookupUserByUsername = (username) => userService.lookupUserByUsername(username);
