// Authentication service with secure cookie support and token refresh
const API_BASE_URL = import.meta.env.VITE_API_URL || "https://backend.jkrumboe.dev/api";

class AuthService {
  constructor() {
    this.refreshTimer = null;
    this.isRefreshing = false;
  }

  // Login with secure cookies
  async login(credentials) {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();
      
      // Store token in localStorage for backward compatibility
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      
      // Set up automatic token refresh
      this.scheduleTokenRefresh();
      
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Register with secure cookies
  async register(userData) {
    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const data = await response.json();
      
      // Store token in localStorage for backward compatibility
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      
      // Set up automatic token refresh
      this.scheduleTokenRefresh();
      
      return data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // Refresh access token
  async refreshToken() {
    if (this.isRefreshing) {
      return false; // Prevent multiple simultaneous refresh attempts
    }

    this.isRefreshing = true;
    
    try {
      const response = await fetch(`${API_BASE_URL}/refresh`, {
        method: 'POST',
        credentials: 'include', // Include cookies
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      
      // Update localStorage token for backward compatibility
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      
      // Schedule next refresh
      this.scheduleTokenRefresh();
      
      return data;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.logout(); // Clear everything if refresh fails
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  // Schedule automatic token refresh (13 minutes for 15-minute tokens)
  scheduleTokenRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    // Refresh 2 minutes before expiry (15min - 2min = 13min)
    this.refreshTimer = setTimeout(() => {
      this.refreshToken();
    }, 13 * 60 * 1000);
  }

  // Logout and clear all authentication data
  async logout() {
    try {
      await fetch(`${API_BASE_URL}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage
      localStorage.removeItem('token');
      
      // Clear refresh timer
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }
      
      // Force page reload to clear any cached state
      window.location.href = '/login';
    }
  }

  // Check if user is authenticated
  isAuthenticated() {
    const token = localStorage.getItem('token');
    if (!token) return false;
    
    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      
      // Check if token is expired
      if (decoded.exp && decoded.exp < currentTime) {
        this.refreshToken(); // Try to refresh
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  // Get current user from token
  getCurrentUser() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      return {
        id: decoded.id,
        role: decoded.role,
        player_id: decoded.player_id
      };
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  // Initialize auth service (call on app start)
  initialize() {
    if (this.isAuthenticated()) {
      this.scheduleTokenRefresh();
    }
  }
}

export const authService = new AuthService();
export default authService;
