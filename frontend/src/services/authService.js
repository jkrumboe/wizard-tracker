// Authentication service with secure cookie support and token refresh
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5055/api";

class AuthService {
  constructor() {
    this.refreshTimer = null;
    this.isRefreshing = false;
  }

  // Hash a password using SHA-256 so the plaintext is never sent over the network
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Login with secure cookies
  async login(credentials) {
    try {
      const hashed = await this.hashPassword(credentials.password);
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({ ...credentials, password: hashed }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();
      
      // Note: Tokens are now in HTTP-only cookies, not in the response body
      // Keep this for backward compatibility during transition
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
      const hashed = await this.hashPassword(userData.password);
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({ ...userData, password: hashed }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const data = await response.json();
      
      // Note: Tokens are now in HTTP-only cookies, not in the response body
      // Keep this for backward compatibility during transition
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

  // Check authentication status with server (using HTTP-only cookies)
  async checkAuthStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/me`, {
        method: 'GET',
        credentials: 'include', // Include HTTP-only cookies
      });

      if (response.ok) {
        const data = await response.json();
        return data.user;
      } else if (response.status === 401) {
        // Not authenticated
        return null;
      } else {
        throw new Error('Failed to check authentication status');
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      return null;
    }
  }

  // Initialize auth service (call on app start)
  initialize() {
    if (this.isAuthenticated()) {
      this.scheduleTokenRefresh();
    }
  }

  // Admin authentication methods
  async adminLogin(credentials) {
    try {
      const hashed = await this.hashPassword(credentials.password);
      const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({ ...credentials, password: hashed }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Admin login failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Admin login error:', error);
      throw error;
    }
  }

  async adminLogout() {
    try {
      await fetch(`${API_BASE_URL}/admin/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Admin logout error:', error);
    } finally {
      // Force page reload to clear any cached state
      window.location.href = '/admin/login';
    }
  }

  // Check if user is authenticated as admin (basic check - server will validate properly)
  isAdminAuthenticated() {
    // This is a basic client-side check
    // The real authentication happens on the server with the HTTP-only cookie
    // We'll rely on API calls to determine if admin is authenticated
    return true; // Let the server handle the real validation
  }

  // Setup initial admin user (for first-time setup)
  async setupAdmin() {
    try {
      const response = await fetch(`${API_BASE_URL}/setup-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Admin setup failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Admin setup error:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();
export default authService;
