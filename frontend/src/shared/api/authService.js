import { account, ID } from '@/shared/utils/appwrite';
import { onlineStatusService } from './onlineStatusService';

class AuthService {
  async login({ email, password }) {
    try {
      await account.createEmailPasswordSession(email, password);
      return await account.get();
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async register({ email, password, name }) {
    try {
      await account.create(ID.unique(), email, password, name);
      // Automatically log in after registration
      await account.createEmailPasswordSession(email, password);
      return await account.get();
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async logout() {
    try {
      // Delete current session
      await account.deleteSession('current');
    } catch (error) {
      // If current session deletion fails, try to delete all sessions
      try {
        await account.deleteSessions();
      } catch (deleteAllError) {
        console.debug('Logout errors (ignored):', { current: error, deleteAll: deleteAllError });
      }
    }
    // Don't automatically redirect here, let the calling component handle it
  }

  clearLocalSession() {
    // Clear any stored session data locally without making server calls
    // This is useful when switching to offline mode
    try {
      // Appwrite typically stores session data with these keys
      const appwriteKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('appwrite') || key.includes('session') || key.includes('account'))) {
          appwriteKeys.push(key);
        }
      }
      
      // Remove all found Appwrite-related keys
      appwriteKeys.forEach(key => {
        localStorage.removeItem(key);
        console.debug(`🔄 Cleared localStorage key: ${key}`);
      });
      
      console.debug('🔄 Local session data cleared');
    } catch (error) {
      console.debug('Error clearing local session:', error);
    }
  }

  async isAuthenticated() {
    try {
      await account.get();
      return true;
    } catch {
      return false;
    }
  }

  async refreshToken() {
    // Appwrite handles token refresh automatically
    try {
      return await account.get();
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
      
      return await account.get();
    } catch {
      return null;
    }
  }

  initialize() {
    // No-op for Appwrite - initialization handled in client setup
  }

  async adminLogin({ email, password }) {
    return this.login({ email, password });
  }

  async adminLogout() {
    return this.logout();
  }

  async setupAdmin() {
    // Admin creation would be handled via Appwrite console
    return;
  }

  async updateProfile({ name }) {
    try {
      return await account.updateName(name);
      // Note: Appwrite doesn't have built-in avatar update in account service
      // You might need to handle avatar separately via databases or storage
    } catch (error) {
      throw new Error(error.message);
    }
  }
}

export const authService = new AuthService();
export default authService;