import { API_ENDPOINTS } from './config.js';
import { sessionCache } from '../utils/sessionCache';

/**
 * How long the startup session check may take before we give up and boot with
 * the cached session instead. `navigator.onLine` reports true on a captive
 * portal or a dead Wi-Fi connection, where a plain fetch can hang for minutes -
 * long enough to leave the app sitting on its loading screen.
 */
const AUTH_REQUEST_TIMEOUT_MS = 8000;

/**
 * Tokens are swapped for a fresh one once they are past this share of their
 * lifetime. Mirrors `RENEW_AFTER_FRACTION` in `backend/utils/authToken.js`: as
 * long as the app is opened once inside a token's lifetime, the session slides
 * forward and the user is never asked to sign in again.
 */
const TOKEN_RENEW_AFTER_FRACTION = 0.5;

async function fetchWithTimeout(url, options = {}, timeoutMs = AUTH_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

class AuthService {
  constructor() {
    this.currentUser = null;
    this.token = null;
    this.initialized = false;
  }

  // Initialize auth service and restore session
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Try to restore token and user from session cache
      this.token = await sessionCache.get('auth_token');
      this.currentUser = await sessionCache.get('auth_user');
      
      // Fallback to localStorage if not in sessionCache
      if (!this.token) {
        this.token = localStorage.getItem('auth_token');
        if (this.token) {
          // Sync to sessionCache for consistency
          await sessionCache.set('auth_token', this.token, { persist: true });
        }
      }
      
      if (this.token) {
        console.debug('🔓 Auth service initialized with cached session');
      }
      
      this.initialized = true;
    } catch (error) {
      console.debug('Error initializing auth service:', error);
      this.initialized = true;
    }
  }

  // Store token in session cache
  // `notify` is false when swapping a token for a fresh one: sign-in state has
  // not changed, so the offline upload queue has nothing new to do.
  async setToken(token, { notify = true } = {}) {
    this.token = token;
    await sessionCache.set('auth_token', token, { persist: true });
    // Also store in localStorage for backwards compatibility with existing code
    localStorage.setItem('auth_token', token);
    if (notify) {
      // Games finished while signed out can be uploaded now.
      this.notifyAuthChanged();
    }
  }

  // Let the offline upload queue know that sign-in state changed
  notifyAuthChanged() {
    try {
      globalThis.dispatchEvent(new CustomEvent('keepwiz-auth-changed'));
    } catch {
      // Non-browser context (tests) - nothing to notify.
    }
  }

  // Get token from session cache
  async getStoredToken() {
    if (!this.token) {
      this.token = await sessionCache.get('auth_token');
      // Fallback to localStorage
      if (!this.token) {
        this.token = localStorage.getItem('auth_token');
      }
    }
    return this.token;
  }

  // Remove token from session cache
  async clearToken() {
    this.token = null;
    this.currentUser = null;
    await sessionCache.remove('auth_token');
    await sessionCache.remove('auth_user');
    // Also clear from localStorage
    localStorage.removeItem('auth_token');
  }

  // Get authorization headers
  getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` })
    };
  }

  async login({ username, password }) {
    try {
      const response = await fetch(API_ENDPOINTS.auth.login, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username,
          password 
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        
        // Handle rate limiting with more helpful message
        if (response.status === 429) {
          const retryMinutes = Math.ceil((error.retryAfter || 900) / 60);
          throw new Error(`Too many login attempts from your network. Please try again in ${retryMinutes} minutes.`);
        }
        
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();
      
      // Store the token in session cache
      await this.setToken(data.token);
      
      // Store user data matching database schema
      this.currentUser = {
        $id: data.user.id,
        id: data.user.id,
        username: data.user.username,
        role: data.user.role || 'user',
        profilePicture: data.user.profilePicture || null,
        createdAt: data.user.createdAt,
        identities: data.user.identities || []
      };

      // Persist user data to session cache
      await sessionCache.set('auth_user', this.currentUser, { persist: true });

      console.debug('🔓 Login successful for:', username);
      return this.currentUser;
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  }

  async register({ username, password }) {
    try {
      const response = await fetch(API_ENDPOINTS.auth.register, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username,
          password 
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        
        // Handle rate limiting with more helpful message
        if (response.status === 429) {
          const retryMinutes = Math.ceil((error.retryAfter || 900) / 60);
          throw new Error(`Too many registration attempts from your network. Please try again in ${retryMinutes} minutes.`);
        }
        
        throw new Error(error.error || 'Registration failed');
      }

      const data = await response.json();
      
      // Store the token in session cache
      await this.setToken(data.token);
      
      // Store user data matching database schema
      this.currentUser = {
        $id: data.user.id,
        id: data.user.id,
        username: data.user.username,
        role: data.user.role || 'user',
        profilePicture: data.user.profilePicture || null,
        createdAt: data.user.createdAt
      };

      // Persist user data to session cache
      await sessionCache.set('auth_user', this.currentUser, { persist: true });

      console.debug('🔓 Registration successful for:', username);
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

  // Decode a JWT payload without validating it - only the server can actually
  // vouch for a token.
  decodeTokenPayload(token) {
    try {
      if (!token) return null;

      const parts = token.split('.');
      if (parts.length !== 3) return null;

      return JSON.parse(atob(parts[1]));
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  isTokenExpired(token) {
    if (!token) return true;

    const payload = this.decodeTokenPayload(token);
    if (!payload) return true; // Unreadable token - treat as expired

    // Check expiration (exp is in seconds, Date.now() is in milliseconds)
    if (payload.exp) {
      const now = Math.floor(Date.now() / 1000);
      const isExpired = payload.exp < now;

      if (isExpired) {
        console.debug('🔒 Token expired:', new Date(payload.exp * 1000).toLocaleString());
      }

      return isExpired;
    }

    // No expiration field, assume not expired
    return false;
  }

  /**
   * Whether a token is far enough through its lifetime to be worth swapping for
   * a fresh one. Tokens without an `exp` never need renewing.
   */
  shouldRenewToken(token) {
    const payload = this.decodeTokenPayload(token);
    if (!payload?.exp) return false;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return false; // Already dead - renewal cannot help

    const lifetime = payload.iat ? payload.exp - payload.iat : 0;
    if (lifetime <= 0) return false;

    const remaining = payload.exp - now;
    return remaining <= lifetime * (1 - TOKEN_RENEW_AFTER_FRACTION);
  }

  /**
   * Swap a still-valid token for a fresh one. Every session check is a chance to
   * renew, which is what keeps a returning user signed in without ever being
   * sent back to the login screen.
   *
   * @returns {Promise<boolean>} true when a new token was stored
   */
  async renewTokenIfNeeded() {
    const token = await this.getStoredToken();
    if (!token || !this.shouldRenewToken(token)) return false;
    if (!navigator.onLine) return false;

    try {
      const response = await fetchWithTimeout(API_ENDPOINTS.auth.refresh, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        // A rejected token is handled by the regular session check; anything
        // else (rate limit, server error) is worth retrying on the next check.
        console.debug('🔒 Token renewal declined by server:', response.status);
        return false;
      }

      const data = await response.json();
      if (!data.token) return false;

      await this.setToken(data.token, { notify: false });
      console.debug('🔄 Auth token renewed');
      return true;
    } catch (error) {
      // Offline or flaky connection - the existing token is still valid.
      console.debug('Token renewal could not reach the server:', error);
      return false;
    }
  }

  async getCurrentUser() {
    try {
      // Ensure auth service is initialized
      await this.initialize();
      
      // If we have a cached user and valid token, return it
      if (this.currentUser && this.token) {
        console.debug('🔓 Current user (cached):', this.currentUser.username);
        return this.currentUser;
      }
      
      // Try to restore from session cache
      const cachedUser = await sessionCache.get('auth_user');
      const cachedToken = await sessionCache.get('auth_token');
      
      if (cachedUser && cachedToken) {
        this.currentUser = cachedUser;
        this.token = cachedToken;
        console.debug('🔓 Current user (recovered):', this.currentUser.username);
        return this.currentUser;
      }
      
      // Try to verify token with backend if we have one
      if (this.token || cachedToken) {
        const user = await this.verifyToken();
        if (user) {
          this.currentUser = user;
          await sessionCache.set('auth_user', user, { persist: true });
          return user;
        }
      }
      
      console.debug('🔒 No current user session');
      return null;
    } catch {
      console.debug('🔒 No current user session');
      await this.clearToken();
      return null;
    }
  }

  // Method to verify token with backend
  async verifyToken() {
    try {
      await this.initialize();
      
      if (!this.token) {
        this.token = await sessionCache.get('auth_token');
      }
      
      if (!this.token) return null;
      
      // Call the /me endpoint to verify token and get current user
      const response = await fetchWithTimeout(API_ENDPOINTS.auth.me, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        // Token is invalid or expired
        await this.clearToken();
        return null;
      }

      const data = await response.json();

      // /me hands back a fresh token once the current one is past half its
      // life, so simply opening the app extends the session.
      if (data.token) {
        await this.setToken(data.token, { notify: false });
      }

      // Update current user with data from backend
      this.currentUser = {
        $id: data.user.id,
        id: data.user.id,
        username: data.user.username,
        role: data.user.role || 'user',
        profilePicture: data.user.profilePicture || null,
        createdAt: data.user.createdAt,
        identities: data.user.identities || []
      };
      
      // Persist to session cache
      await sessionCache.set('auth_user', this.currentUser, { persist: true });
      
      return this.currentUser;
    } catch (error) {
      // Only the server rejecting the token means the session is dead. A
      // network failure, an abort or a timeout says nothing about whether the
      // token is still valid - clearing it here would sign the user out every
      // time they opened the app on a bad connection, and take their ability to
      // upload queued games with it.
      console.debug('Token verification could not reach the server; keeping cached session:', error);
      const cachedUser = await sessionCache.get('auth_user');
      if (cachedUser) {
        this.currentUser = cachedUser;
        return cachedUser;
      }
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
    // Clear session cache but keep it available for recovery
    // This is useful when switching to offline mode temporarily
    try {
      // Don't actually clear the cache, just mark as offline session
      sessionCache.set('session_mode', 'offline', { persist: true });
      console.debug('🔄 Session marked as offline (data preserved)');
    } catch (error) {
      console.debug('Error marking session offline:', error);
    }
  }

  async restoreLocalSession() {
    // Restore session when coming back online
    try {
      const mode = await sessionCache.get('session_mode');
      
      if (mode === 'offline') {
        // Restore from cache
        this.token = await sessionCache.get('auth_token');
        this.currentUser = await sessionCache.get('auth_user');
        
        if (this.token && this.currentUser) {
          await sessionCache.set('session_mode', 'online', { persist: true });
          console.debug('🔄 Session restored from offline mode');
          return this.currentUser;
        }
      }
      
      return null;
    } catch (error) {
      console.debug('Error restoring session:', error);
      return null;
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
    try {
      await this.renewTokenIfNeeded();
      return await this.getCurrentUser();
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async checkAuthStatus() {
    try {
      // Ensure initialized
      await this.initialize();
      
      // Check if token is expired before proceeding
      let cachedToken = await sessionCache.get('auth_token');
      if (cachedToken && this.isTokenExpired(cachedToken)) {
        console.debug('🔒 Token expired - logging out');
        await this.logout();
        return null;
      }

      // Slide the session forward while the token is still valid, so an active
      // user never reaches the expiry above.
      if (cachedToken && (await this.renewTokenIfNeeded())) {
        cachedToken = this.token;
      }

            
      // Simple check: if navigator is offline, try to restore from cache
      if (!navigator.onLine) {
        console.debug('🔒 Browser is offline - checking cached auth');
        const cachedUser = await sessionCache.get('auth_user');
        
        if (cachedUser && cachedToken) {
          this.currentUser = cachedUser;
          this.token = cachedToken;
          return cachedUser;
        }
        return null;
      }
      
      return await this.getCurrentUser();
    } catch {
      // Try cache as fallback
      const cachedUser = await sessionCache.get('auth_user');
      if (cachedUser) {
        this.currentUser = cachedUser;
        return cachedUser;
      }
      return null;
    }
  }

  async updateProfile({ username }) {
    try {
      // Update the local user object (fallback for offline mode)
      if (this.currentUser) {
        this.currentUser.username = username;
        console.debug('🔄 Profile updated locally:', username);
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