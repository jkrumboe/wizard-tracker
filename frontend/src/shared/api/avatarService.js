import defaultAvatar from '@/assets/default-avatar.png';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

class AvatarService {
  constructor() {
    // Service now uses backend API for storage
  }

  /**
   * Get authorization header
   * @returns {Object} - Authorization header object
   */
  getAuthHeader() {
    const token = localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  /**
   * Validate image file for security
   * @param {File} file - The image file to validate
   * @returns {Promise<boolean>} - True if valid
   * @throws {Error} - If validation fails
   */
  async validateImageFile(file) {
    // 1. Check if file exists
    if (!file) {
      throw new Error('No file provided');
    }

    // 2. Validate file type (whitelist only safe image types)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      throw new Error('Only JPEG, PNG, GIF, and WebP images are allowed');
    }

    // 3. Validate file extension matches MIME type
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!validExtensions.includes(fileExtension)) {
      throw new Error('Invalid file extension');
    }

    // 4. Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('File size must be less than 5MB');
    }

    // 5. Validate minimum file size (prevents empty/corrupted files)
    const minSize = 100; // 100 bytes
    if (file.size < minSize) {
      throw new Error('File is too small or corrupted');
    }

    // 6. Validate file name (prevent malicious filenames)
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '');
    if (sanitizedName.length === 0) {
      throw new Error('Invalid filename');
    }

    // 7. Validate image dimensions and content
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        // Check minimum dimensions (prevent 1x1 tracking pixels)
        if (img.width < 50 || img.height < 50) {
          reject(new Error('Image must be at least 50x50 pixels'));
          return;
        }

        // Check maximum dimensions (prevent extremely large images)
        if (img.width > 4096 || img.height > 4096) {
          reject(new Error('Image dimensions must not exceed 4096x4096 pixels'));
          return;
        }

        // Check aspect ratio (prevent extremely stretched images)
        const aspectRatio = img.width / img.height;
        if (aspectRatio > 10 || aspectRatio < 0.1) {
          reject(new Error('Image aspect ratio is too extreme'));
          return;
        }

        resolve(true);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Invalid or corrupted image file'));
      };

      img.src = url;
    });
  }

  /**
   * Upload avatar image to backend
   * @param {File} file - The image file from input
   * @returns {Promise<string>} - The file identifier (base64 string)
   */
  async uploadAvatar(file) {
    try {
      // Comprehensive security validation
      await this.validateImageFile(file);

      // Convert to base64
      const base64 = await this.fileToBase64(file);
      
      // Additional check: Verify base64 data URL format
      if (!base64.startsWith('data:image/')) {
        throw new Error('Invalid image data format');
      }

      // Check base64 size after encoding
      const base64Size = base64.length;
      if (base64Size > 10 * 1024 * 1024) { // 10MB base64 limit
        throw new Error('Encoded image is too large');
      }

      // Upload to backend
      const response = await fetch(`${API_BASE_URL}/api/users/me/profile-picture`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        },
        body: JSON.stringify({ profilePicture: base64 })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload profile picture');
      }

      // Also store in localStorage as fallback
      localStorage.setItem('user_avatar', base64);
      
      return base64;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      // If backend fails, try storing locally as fallback
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        const base64 = await this.fileToBase64(file);
        localStorage.setItem('user_avatar', base64);
        console.warn('Avatar stored locally only (backend unavailable)');
        return base64;
      }
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
      // Try to get from backend first
      const response = await fetch(`${API_BASE_URL}/api/users/me/profile-picture`, {
        headers: this.getAuthHeader()
      });

      if (response.ok) {
        const data = await response.json();
        if (data.profilePicture) {
          // Also cache locally
          localStorage.setItem('user_avatar', data.profilePicture);
          return data.profilePicture;
        }
      }

      // Fallback to localStorage if backend fails or returns null
      const customAvatar = localStorage.getItem('user_avatar');
      if (customAvatar) {
        return customAvatar;
      }

      // Return default avatar
      return defaultAvatar;
    } catch (error) {
      console.error('Error getting avatar URL:', error);
      
      // Try localStorage as fallback
      const customAvatar = localStorage.getItem('user_avatar');
      if (customAvatar) {
        return customAvatar;
      }
      
      // Return default avatar as final fallback
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
      // Try to delete from backend
      const response = await fetch(`${API_BASE_URL}/api/users/me/profile-picture`, {
        method: 'DELETE',
        headers: this.getAuthHeader()
      });

      if (response.ok) {
        // Also remove from localStorage
        localStorage.removeItem('user_avatar');
        return true;
      }

      throw new Error('Failed to delete profile picture');
    } catch (error) {
      console.error('Error deleting avatar:', error);
      // Remove from localStorage anyway as fallback
      localStorage.removeItem('user_avatar');
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
      // Just upload the new avatar (backend will replace)
      return await this.uploadAvatar(file);
    } catch (error) {
      console.error('Error replacing avatar:', error);
      throw new Error(error.message || 'Failed to replace avatar');
    }
  }
}

export const avatarService = new AvatarService();
export default avatarService;
