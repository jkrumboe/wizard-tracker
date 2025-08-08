import { account, storage, avatars, Permission, Role, ID } from '@/shared/utils/appwrite';

class AvatarService {
  constructor() {
    this.bucketId = 'avatar'; // You'll need to create this bucket in Appwrite console
  }

  /**
   * Upload avatar image to Appwrite Storage
   * @param {File} file - The image file from input
   * @returns {Promise<string>} - The file ID of the uploaded image
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

      // Get current user to set permissions
      const user = await account.get();

      // Upload image to storage with proper permissions
      const created = await storage.createFile(
        this.bucketId,
        ID.unique(),
        file, // Pass the file directly in Appwrite 18.x
        [
          Permission.read(Role.any()),              // Anyone can view the avatar
          Permission.update(Role.user(user.$id)),   // Only the owner can update
          Permission.delete(Role.user(user.$id))    // Only the owner can delete
        ]
      );

      const fileId = created.$id;

      // Save fileId in user preferences
      await account.updatePrefs({ avatarFileId: fileId });

      return fileId;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw new Error(error.message || 'Failed to upload avatar');
    }
  }

  /**
   * Get avatar URL for the current user
   * @returns {Promise<string>} - The avatar URL or fallback initials URL
   */
  async getAvatarUrl() {
    try {
      const prefs = await account.getPrefs();
      const fileId = prefs.avatarFileId;

      if (fileId) {
        // Use preview to get a standardized 128x128 image
        return storage.getFilePreview(
          this.bucketId, 
          fileId, 
          128, // width
          128  // height
        );
      }

      // Fallback to initials avatar
      return avatars.getInitials(undefined, 128, 128);
    } catch (error) {
      console.error('Error getting avatar URL:', error);
      // Return initials as fallback
      return avatars.getInitials(undefined, 128, 128);
    }
  }

  /**
   * Get avatar URL for the current user with specific dimensions
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @returns {Promise<string>} - The avatar URL or fallback initials URL
   */
  async getAvatarUrlWithSize(width = 128, height = 128) {
    try {
      const prefs = await account.getPrefs();
      const fileId = prefs.avatarFileId;

      if (fileId) {
        return storage.getFilePreview(
          this.bucketId, 
          fileId, 
          width, 
          height
        );
      }

      return avatars.getInitials(undefined, width, height);
    } catch (error) {
      console.error('Error getting avatar URL:', error);
      return avatars.getInitials(undefined, width, height);
    }
  }

  /**
   * Delete current user's avatar
   * @returns {Promise<boolean>} - Success status
   */
  async deleteAvatar() {
    try {
      const prefs = await account.getPrefs();
      const fileId = prefs.avatarFileId;

      if (fileId) {
        // Delete file from storage
        // Note: Only the file owner can delete due to permissions set during upload
        await storage.deleteFile(this.bucketId, fileId);
        
        // Remove from user preferences
        const updatedPrefs = { ...prefs };
        delete updatedPrefs.avatarFileId;
        await account.updatePrefs(updatedPrefs);
      }

      return true;
    } catch (error) {
      console.error('Error deleting avatar:', error);
      throw new Error(error.message || 'Failed to delete avatar');
    }
  }

  /**
   * Replace current user's avatar with a new one
   * This deletes the old avatar and uploads a new one
   * @param {File} file - The new image file
   * @returns {Promise<string>} - The new file ID
   */
  async replaceAvatar(file) {
    try {
      // Delete existing avatar first (if any)
      const prefs = await account.getPrefs();
      if (prefs.avatarFileId) {
        try {
          await storage.deleteFile(this.bucketId, prefs.avatarFileId);
        } catch (error) {
          // Continue even if delete fails (file might not exist)
          console.warn('Could not delete old avatar:', error);
        }
      }

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
