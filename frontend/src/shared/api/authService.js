import { account, ID } from '@/shared/utils/appwrite';

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
      await account.deleteSession('current');
    } catch (error) {
      // Ignore errors on logout, we want to clear local state anyway
      console.log('Logout error (ignored):', error);
    }
    // Don't automatically redirect here, let the calling component handle it
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