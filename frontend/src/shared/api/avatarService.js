import defaultAvatar from '@/assets/default-avatar.png';

class AvatarService {
  constructor() {
    // For now, we'll just use local storage to track avatar preferences
    // In the future, this could be enhanced to upload to the backend
  }

  /**
   * Upload avatar image (currently stores base64 locally)
   * @param {File} file - The image file from input
   * @returns {Promise<string>} - The file identifier (base64 string)
   */
  async uploadAvatar(file) {
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      // Convert to base64 and store locally for now
      const base64 = await this.fileToBase64(file);
      
      // Store in localStorage (in future this could be sent to backend)
      localStorage.setItem('user_avatar', base64);

      return base64;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw new Error(error.message || 'Failed to upload avatar');
    }
  }

  /**
   * Convert file to base64
   * @param {File} file 
   * @returns {Promise<string>}
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }

  /**
   * Get avatar URL for the current user
   * @returns {Promise<string>} - The avatar URL or fallback default avatar
   */
  async getAvatarUrl() {
    try {
      // Check if user has a custom avatar stored locally
      const customAvatar = localStorage.getItem('user_avatar');
      
      if (customAvatar) {
        return customAvatar; // Return base64 data URL
      }

      // Return default avatar
      return defaultAvatar;
    } catch (error) {
      console.error('Error getting avatar URL:', error);
      // Return default avatar as fallback
      return defaultAvatar;
    }
  }

  /**
   * Get avatar URL for the current user with specific dimensions
   * @param {number} width - Image width (ignored for now)
   * @param {number} height - Image height (ignored for now)
   * @returns {Promise<string>} - The avatar URL or fallback default avatar
   */
  // eslint-disable-next-line no-unused-vars
  async getAvatarUrlWithSize(width = 128, height = 128) {
    try {
      // For now, we ignore dimensions and return the same avatar
      return await this.getAvatarUrl();
    } catch (error) {
      console.error('Error getting avatar URL:', error);
      return defaultAvatar;
    }
  }

  /**
   * Delete current user's avatar
   * @returns {Promise<boolean>} - Success status
   */
  async deleteAvatar() {
    try {
      // Remove from localStorage
      localStorage.removeItem('user_avatar');
      return true;
    } catch (error) {
      console.error('Error deleting avatar:', error);
      throw new Error(error.message || 'Failed to delete avatar');
    }
  }

  /**
   * Replace current user's avatar with a new one
   * @param {File} file - The new image file
   * @returns {Promise<string>} - The new file identifier
   */
  async replaceAvatar(file) {
    try {
      // Delete existing avatar first
      await this.deleteAvatar();
      
      // Upload new avatar
      return await this.uploadAvatar(file);
    } catch (error) {
      console.error('Error replacing avatar:', error);
      throw new Error(error.message || 'Failed to replace avatar');
    }
  }
}

export const avatarService = new AvatarService();
export default avatarService;
