/**
 * Local User Profile Service
 * Manages multiple user profiles on a single device
 * Each user has their own set of games and data stored locally
 */

const LOCAL_USER_PROFILES_KEY = "wizardTracker_userProfiles";
const CURRENT_USER_KEY = "wizardTracker_currentUserId";

export class LocalUserProfileService {
  /**
   * Get all user profiles
   * @returns {Object} - Object containing all user profiles keyed by userId
   */
  static getAllProfiles() {
    try {
      const stored = localStorage.getItem(LOCAL_USER_PROFILES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error("Error loading user profiles:", error);
      return {};
    }
  }

  /**
   * Save user profiles
   * @param {Object} profiles - The profiles object to save
   */
  static saveProfiles(profiles) {
    try {
      localStorage.setItem(LOCAL_USER_PROFILES_KEY, JSON.stringify(profiles));
    } catch (error) {
      console.error("Error saving user profiles:", error);
    }
  }

  /**
   * Create or update a user profile
   * @param {string} userId - The user ID (from authentication or generated)
   * @param {string} username - The username
   * @param {Object} additionalData - Additional profile data
   * @returns {Object} - The created/updated profile
   */
  static createOrUpdateProfile(userId, username, additionalData = {}) {
    const profiles = this.getAllProfiles();
    const timestamp = new Date().toISOString();
    
    const profile = profiles[userId] || {
      userId,
      username,
      createdAt: timestamp,
      lastActive: timestamp,
      ...additionalData
    };
    
    // Update the profile
    profile.username = username;
    profile.lastActive = timestamp;
    profile.updatedAt = timestamp;
    
    // Merge additional data
    Object.assign(profile, additionalData);
    
    profiles[userId] = profile;
    this.saveProfiles(profiles);
    
    return profile;
  }

  /**
   * Get a user profile by ID
   * @param {string} userId - The user ID
   * @returns {Object|null} - The user profile or null if not found
   */
  static getProfile(userId) {
    if (!userId) return null;
    const profiles = this.getAllProfiles();
    return profiles[userId] || null;
  }

  /**
   * Delete a user profile
   * @param {string} userId - The user ID to delete
   */
  static deleteProfile(userId) {
    const profiles = this.getAllProfiles();
    delete profiles[userId];
    this.saveProfiles(profiles);
    
    // If this was the current user, clear current user
    if (this.getCurrentUserId() === userId) {
      this.clearCurrentUser();
    }
  }

  /**
   * Set the current active user
   * @param {string} userId - The user ID to set as current
   */
  static setCurrentUser(userId) {
    if (!userId) {
      this.clearCurrentUser();
      return;
    }
    
    localStorage.setItem(CURRENT_USER_KEY, userId);
    
    // Update last active timestamp
    const profiles = this.getAllProfiles();
    if (profiles[userId]) {
      profiles[userId].lastActive = new Date().toISOString();
      this.saveProfiles(profiles);
    }
  }

  /**
   * Get the current active user ID
   * @returns {string|null} - The current user ID or null
   */
  static getCurrentUserId() {
    return localStorage.getItem(CURRENT_USER_KEY);
  }

  /**
   * Get the current active user profile
   * @returns {Object|null} - The current user profile or null
   */
  static getCurrentUserProfile() {
    const userId = this.getCurrentUserId();
    return userId ? this.getProfile(userId) : null;
  }

  /**
   * Clear the current user
   */
  static clearCurrentUser() {
    localStorage.removeItem(CURRENT_USER_KEY);
  }

  /**
   * Get all profiles as a list sorted by last active
   * @returns {Array} - Array of user profiles
   */
  static getProfilesList() {
    const profiles = this.getAllProfiles();
    return Object.values(profiles).sort((a, b) => {
      const dateA = new Date(a.lastActive || a.createdAt);
      const dateB = new Date(b.lastActive || b.createdAt);
      return dateB - dateA; // Most recent first
    });
  }

  /**
   * Check if a user profile exists
   * @param {string} userId - The user ID to check
   * @returns {boolean} - True if profile exists
   */
  static profileExists(userId) {
    const profiles = this.getAllProfiles();
    return !!profiles[userId];
  }

  /**
   * Migrate existing games to the current authenticated user
   * This should be called when a user first logs in to claim existing local games
   * @param {string} userId - The user ID to assign games to
   */
  static migrateExistingGamesToUser(userId) {
    if (!userId) return;
    
    console.debug('🔄 Migrating existing games to user:', userId);
    
    // This will be implemented in the storage services
    // For now, just create the profile
    const profile = this.getProfile(userId);
    if (!profile) {
      console.error('Cannot migrate games: user profile not found');
      return;
    }
    
    console.debug('✅ User profile ready for game migration:', profile);
  }

  /**
   * Generate a unique guest user ID
   * @returns {string} - A unique guest user ID
   */
  static generateGuestUserId() {
    return `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Create a guest user profile
   * @param {string} guestName - Optional guest name
   * @returns {Object} - The created guest profile
   */
  static createGuestProfile(guestName = null) {
    const guestId = this.generateGuestUserId();
    const username = guestName || `Guest_${Date.now().toString().slice(-6)}`;
    
    const profile = this.createOrUpdateProfile(guestId, username, {
      isGuest: true
    });
    
    this.setCurrentUser(guestId);
    
    return profile;
  }

  /**
   * Export all user profiles as JSON
   * @returns {string} - JSON string of all profiles
   */
  static exportProfiles() {
    const profiles = this.getAllProfiles();
    return JSON.stringify(profiles, null, 2);
  }

  /**
   * Import user profiles from JSON
   * @param {string} jsonData - JSON string of profiles
   * @returns {boolean} - Success status
   */
  static importProfiles(jsonData) {
    try {
      const profiles = JSON.parse(jsonData);
      this.saveProfiles(profiles);
      return true;
    } catch (error) {
      console.error("Error importing profiles:", error);
      return false;
    }
  }

  /**
   * Clear all user profiles (use with caution)
   */
  static clearAllProfiles() {
    localStorage.removeItem(LOCAL_USER_PROFILES_KEY);
    this.clearCurrentUser();
  }
}
