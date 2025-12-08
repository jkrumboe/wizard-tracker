import defaultAvatar from '@/assets/default-avatar.png';
import { API_BASE_URL } from './config.js';
import { compressImage, createThumbnail } from '@/shared/utils/imageCompression';

class AvatarService {
  constructor() {
    // Service now uses backend API for storage
    this.avatarCache = null; // Memory cache for avatar
    this.thumbnailCache = null; // Memory cache for thumbnail
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

    // 4. Validate file size (max 10MB for input - we'll compress it)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('File size must be less than 10MB');
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

        // No maximum dimension check - we'll compress large images
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
   * @param {File|Blob} file - The image file or blob from input/cropper
   * @returns {Promise<string>} - The file identifier (base64 string)
   */
  async uploadAvatar(file) {
    try {
      // Comprehensive security validation
      await this.validateImageFile(file);

      // Compress image to optimize size and quality
      console.log('Compressing image...', { originalSize: file.size });
      const compressed = await compressImage(file, {
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.85,
        mimeType: 'image/jpeg',
        maxSizeKB: 400 // Target 400KB max
      });

      console.log('Compressed:', {
        originalSize: file.size,
        compressedSize: compressed.size,
        reduction: `${Math.round((1 - compressed.size / file.size) * 100)}%`
      });

      const base64 = compressed.dataUrl;
      
      // Additional check: Verify base64 data URL format
      if (!base64.startsWith('data:image/')) {
        throw new Error('Invalid image data format');
      }

      // Create thumbnail for faster loading
      const thumbnail = await createThumbnail(base64, 128);

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

      // Cache in memory and localStorage
      this.avatarCache = base64;
      this.thumbnailCache = thumbnail;
      localStorage.setItem('user_avatar', base64);
      localStorage.setItem('user_avatar_thumbnail', thumbnail);
      localStorage.setItem('user_avatar_timestamp', Date.now().toString());
      
      return base64;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      // If backend fails, try storing locally as fallback
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        const compressed = await compressImage(file, {
          maxWidth: 512,
          maxHeight: 512,
          quality: 0.85,
          mimeType: 'image/jpeg',
          maxSizeKB: 400
        });
        const base64 = compressed.dataUrl;
        const thumbnail = await createThumbnail(base64, 128);
        
        this.avatarCache = base64;
        this.thumbnailCache = thumbnail;
        localStorage.setItem('user_avatar', base64);
        localStorage.setItem('user_avatar_thumbnail', thumbnail);
        localStorage.setItem('user_avatar_timestamp', Date.now().toString());
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
   * @param {boolean} useThumbnail - Use thumbnail for faster loading
   * @returns {Promise<string>} - The avatar URL or fallback default avatar
   */
  async getAvatarUrl(useThumbnail = false) {
    try {
      // Check memory cache first (instant)
      if (useThumbnail && this.thumbnailCache) {
        return this.thumbnailCache;
      }
      if (!useThumbnail && this.avatarCache) {
        return this.avatarCache;
      }

      // Check localStorage cache (fast)
      const cacheKey = useThumbnail ? 'user_avatar_thumbnail' : 'user_avatar';
      const cached = localStorage.getItem(cacheKey);
      const timestamp = localStorage.getItem('user_avatar_timestamp');
      
      // Use cache if less than 5 minutes old
      if (cached && timestamp) {
        const age = Date.now() - parseInt(timestamp);
        if (age < 5 * 60 * 1000) { // 5 minutes
          if (useThumbnail) {
            this.thumbnailCache = cached;
          } else {
            this.avatarCache = cached;
          }
          return cached;
        }
      }

      // Try to get from backend
      const response = await fetch(`${API_BASE_URL}/api/users/me/profile-picture`, {
        headers: this.getAuthHeader()
      });

      if (response.ok) {
        const data = await response.json();
        if (data.profilePicture) {
          // Update cache
          this.avatarCache = data.profilePicture;
          localStorage.setItem('user_avatar', data.profilePicture);
          localStorage.setItem('user_avatar_timestamp', Date.now().toString());
          
          // Generate and cache thumbnail if needed
          if (useThumbnail) {
            if (!this.thumbnailCache) {
              const thumbnail = await createThumbnail(data.profilePicture, 128);
              this.thumbnailCache = thumbnail;
              localStorage.setItem('user_avatar_thumbnail', thumbnail);
            }
            return this.thumbnailCache;
          }
          
          return data.profilePicture;
        }
      }

      // Fallback to localStorage if backend fails or returns null
      if (cached) {
        if (useThumbnail) {
          this.thumbnailCache = cached;
        } else {
          this.avatarCache = cached;
        }
        return cached;
      }

      // Return default avatar
      return defaultAvatar;
    } catch (error) {
      console.error('Error getting avatar URL:', error);
      
      // Try localStorage as fallback
      const cacheKey = useThumbnail ? 'user_avatar_thumbnail' : 'user_avatar';
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        if (useThumbnail) {
          this.thumbnailCache = cached;
        } else {
          this.avatarCache = cached;
        }
        return cached;
      }
      
      // Return default avatar as final fallback
      return defaultAvatar;
    }
  }

  /**
   * Preload avatar for faster display
   * Loads thumbnail first, then full image in background
   */
  async preloadAvatar() {
    try {
      // Load thumbnail immediately
      await this.getAvatarUrl(true);
      // Load full image in background
      this.getAvatarUrl(false).catch(() => {});
    } catch (error) {
      console.error('Error preloading avatar:', error);
    }
  }

  /**
   * Clear avatar cache
   */
  clearCache() {
    this.avatarCache = null;
    this.thumbnailCache = null;
    localStorage.removeItem('user_avatar');
    localStorage.removeItem('user_avatar_thumbnail');
    localStorage.removeItem('user_avatar_timestamp');
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
      // Use thumbnail for small sizes
      return await this.getAvatarUrl(width <= 128);
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
        // Clear all caches
        this.clearCache();
        return true;
      }

      throw new Error('Failed to delete profile picture');
    } catch (error) {
      console.error('Error deleting avatar:', error);
      // Clear caches anyway as fallback
      this.clearCache();
      throw new Error(error.message || 'Failed to delete avatar');
    }
  }

  /**
   * Replace current user's avatar with a new one
   * @param {File|Blob} file - The new image file or blob
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

