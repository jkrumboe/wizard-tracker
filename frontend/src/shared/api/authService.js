import { API_ENDPOINTS } from './config.js';
import { onlineStatusService } from './onlineStatusService';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.token = this.getStoredToken();
  }

  // Store token in localStorage
  setToken(token) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  // Get token from localStorage
  getStoredToken() {
    return localStorage.getItem('auth_token');
  }

  // Remove token from localStorage
  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
    this.currentUser = null;
  }

  // Get authorization headers
  getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` })
    };
  }

  async login({ email, password }) {
    try {
      // Note: The backend expects 'username' not 'email'
      // For now, we'll use email as username since the UI uses email field
      const response = await fetch(API_ENDPOINTS.auth.login, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username: email, // Using email as username for now
          password 
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();
      
      // Store the token
      this.setToken(data.token);
      
      // Store user data in a format compatible with existing frontend code
      this.currentUser = {
        $id: data.user.id,
        id: data.user.id,
        name: data.user.username,
        email: email, // Keep email for compatibility since backend only stores username
        username: data.user.username,
        createdAt: data.user.createdAt
      };

      console.debug('🔓 Login successful for:', email);
      return this.currentUser;
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  }

  async register({ email, password, name }) {
    try {
      const response = await fetch(API_ENDPOINTS.auth.register, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username: name || email, // Use name as username, fallback to email
          password 
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const data = await response.json();
      
      // Store the token
      this.setToken(data.token);
      
      // Store user data in a format compatible with existing frontend code
      this.currentUser = {
        $id: data.user.id,
        id: data.user.id,
        name: data.user.username,
        email: email, // Keep email for compatibility
        username: data.user.username,
        createdAt: data.user.createdAt
      };

      console.debug('🔓 Registration successful for:', email);
      return this.currentUser;
    } catch (error) {
      console.error('Registration error:', error);
      throw new Error(error.message || 'Registration failed');
    }
  }

  async logout() {
    try {
      // Clear local token and user data
      this.clearToken();
      console.debug('🔓 Successfully logged out');
    } catch (error) {
      console.debug('Logout errors (ignored):', error);
    }
    // Don't automatically redirect here, let the calling component handle it
  }

  async clearAllSessions() {
    try {
      // For our JWT-based system, just clear the local token
      this.clearToken();
      console.debug('🔓 All sessions cleared');
    } catch (error) {
      console.debug('Error clearing sessions:', error);
      throw new Error(error.message);
    }
  }

  async getCurrentUser() {
    try {
      // If we have a stored user and valid token, return it
      if (this.currentUser && this.token) {
        console.debug('🔓 Current user:', this.currentUser.email || this.currentUser.username);
        return this.currentUser;
      }
      
      // Try to verify token with backend if we have one
      if (this.token) {
        const user = await this.verifyToken();
        if (user) {
          this.currentUser = user;
          return user;
        }
      }
      
      console.debug('🔒 No current user session');
      return null;
    } catch {
      console.debug('🔒 No current user session');
      this.clearToken();
      return null;
    }
  }

  // Method to verify token with backend
  async verifyToken() {
    try {
      if (!this.token) return null;
      
      // Call the /me endpoint to verify token and get current user
      const response = await fetch(API_ENDPOINTS.auth.me, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        // Token is invalid or expired
        this.clearToken();
        return null;
      }

      const data = await response.json();
      
      // Update current user with data from backend
      this.currentUser = {
        $id: data.user.id,
        id: data.user.id,
        name: data.user.username,
        username: data.user.username,
        createdAt: data.user.createdAt
      };
      
      return this.currentUser;
    } catch (error) {
      console.debug('Token verification failed:', error);
      this.clearToken();
      return null;
    }
  }

  // Method to force logout and clear all sessions
  async forceLogoutAllSessions() {
    try {
      await this.clearAllSessions();
      console.debug('🔓 Force logged out all sessions');
    } catch {
      console.debug('Force logout completed with errors (ignored)');
    }
  }

  clearLocalSession() {
    // Clear any stored session data locally without making server calls
    // This is useful when switching to offline mode
    try {
      this.clearToken();
      console.debug('🔄 Local session data cleared');
    } catch (error) {
      console.debug('Error clearing local session:', error);
    }
  }

  async isAuthenticated() {
    try {
      const user = await this.getCurrentUser();
      return !!user;
    } catch {
      return false;
    }
  }

  async refreshToken() {
    // For JWT tokens, we don't need to refresh them actively
    // They are stateless and valid until expiry
    try {
      return await this.getCurrentUser();
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async checkAuthStatus() {
    try {
      // Simple check: if navigator is offline, skip auth check
      if (!navigator.onLine) {
        console.debug('🔒 Browser is offline - skipping auth check');
        return null;
      }
      
      // Try to get status from service, but don't wait too long
      try {
        const statusCheck = await Promise.race([
          onlineStatusService.getStatus(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
        ]);
        
        if (!statusCheck.online) {
          console.debug('🔒 App is in offline mode - skipping auth check');
          return null;
        }
      } catch {
        // If status check times out, assume offline for safety
        console.debug('🔒 Status check timed out - assuming offline mode');
        return null;
      }
      
      return await this.getCurrentUser();
    } catch {
      return null;
    }
  }

  initialize() {
    // Initialize the auth service - restore token and user from storage
    try {
      this.token = this.getStoredToken();
      if (this.token) {
        // We'll verify the token when getCurrentUser is called
        console.debug('🔓 Auth service initialized with stored token');
      }
    } catch (error) {
      console.debug('Error initializing auth service:', error);
    }
  }

  async updateProfile({ name }) {
    try {
      // Update the local user object (fallback for offline mode)
      if (this.currentUser) {
        this.currentUser.name = name;
        this.currentUser.username = name; // Keep username in sync with name
        console.debug('🔄 Profile updated locally:', name);
        return this.currentUser;
      }
      throw new Error('No user logged in');
    } catch (error) {
      throw new Error(error.message);
    }
  }
}

export const authService = new AuthService();
export default authService;