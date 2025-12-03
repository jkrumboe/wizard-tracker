import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/shared/hooks/useUser';
import { XIcon } from "@/components/ui/Icon";
import userService from '@/shared/api/userService';
import avatarService from '@/shared/api/avatarService';
import { sanitizeImageUrl } from '@/shared/utils/urlSanitizer';
import defaultAvatar from "@/assets/default-avatar.png";

const ProfileEdit = () => {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  
  const [editedName, setEditedName] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatar);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState('');
  const [error, setError] = useState(null);

  // Load current user data
  useEffect(() => {
    if (user) {
      setEditedName(user.name || user.username || '');
    }
  }, [user]);

  // Load avatar URL when user is available
  useEffect(() => {
    const loadAvatarUrl = async () => {
      if (user) {
        try {
          const url = await avatarService.getAvatarUrl();
          setAvatarUrl(url);
        } catch (error) {
          console.error('Error loading avatar:', error);
          setAvatarUrl(defaultAvatar);
        }
      }
    };

    loadAvatarUrl();
  }, [user]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      if (previewAvatarUrl) {
        URL.revokeObjectURL(previewAvatarUrl);
      }
    };
  }, [previewAvatarUrl]);

  const handleCancel = () => {
    // Clean up preview URL if it exists
    if (previewAvatarUrl) {
      URL.revokeObjectURL(previewAvatarUrl);
    }
    setSelectedAvatarFile(null);
    setPreviewAvatarUrl('');
    navigate('/profile');
  };

  const handleSave = async () => {
    if (saving) return; // Prevent multiple simultaneous saves
    
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage('');
      
      // Remove any spaces from the username input
      const cleanedName = editedName.trim().replace(/\s/g, '');
      
      // Validate username doesn't contain spaces
      if (cleanedName && /\s/.test(cleanedName)) {
        setError('Username cannot contain spaces');
        setSaving(false);
        return;
      }
      
      // Validate username length and characters
      if (cleanedName && (cleanedName.length < 3 || cleanedName.length > 128)) {
        setError('Username must be between 3 and 128 characters');
        setSaving(false);
        return;
      }
      
      // Handle avatar upload if a file was selected
      if (selectedAvatarFile) {
        try {
          setUploadingAvatar(true);
          await avatarService.replaceAvatar(selectedAvatarFile);
          
          // Get the new avatar URL and update the profile
          const newAvatarUrl = await avatarService.getAvatarUrl();
          setAvatarUrl(newAvatarUrl);
          
          // Dispatch custom event to update navbar avatar
          window.dispatchEvent(new CustomEvent('avatarUpdated'));
          
          setSuccessMessage('Avatar updated successfully!');
        } catch (avatarError) {
          console.error("Avatar upload failed:", avatarError);
          setError(`Failed to upload avatar: ${avatarError.message}`);
          return; // Don't continue if avatar upload fails
        } finally {
          setUploadingAvatar(false);
        }
      }
      
      // Update username using the Users API through backend
      if (cleanedName && cleanedName !== user.name && cleanedName !== user.username) {
        let newUserData = null;
        
        try {
          // Try to update using the Users API
          const result = await userService.updateUserName(user.$id || user.id, cleanedName);
          
          // Extract updated user data from the result
          if (result && result.user) {
            newUserData = {
              ...user,
              name: result.user.username,
              username: result.user.username,
              ...(result.user.id && { id: result.user.id, $id: result.user.id })
            };
          }
          
          setSuccessMessage(prev => prev ? `${prev} Username updated too!` : 'Username updated successfully!');
        } catch (error) {
          console.error('Username update failed:', error);
          setError(`Failed to update username: ${error.message}`);
          return;
        }
        
        // Update the user context immediately to reflect changes in UI
        const updatedUserData = newUserData || {
          ...user,
          name: cleanedName,
          username: cleanedName
        };
        
        // Force a complete state update by creating a new object
        setUser(() => updatedUserData);
      }

      // Clear success message after 2 seconds and navigate back
      setTimeout(() => {
        setSuccessMessage('');
        navigate('/profile');
      }, 2000);
      
    } catch (err) {
      console.error("Error updating profile:", err);
      setError("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  // Helper to check actual raster image format from magic bytes
  const isValidRasterImage = (file, cb) => {
    const reader = new FileReader();
    reader.onloadend = function() {
      const arr = new Uint8Array(reader.result);
      let valid = false;
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      if (arr.length >= 8 && arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E &&
          arr[3] === 0x47 && arr[4] === 0x0D && arr[5] === 0x0A && arr[6] === 0x1A &&
          arr[7] === 0x0A) {
        valid = true;
      }
      // JPEG: FF D8 FF
      else if (arr.length >= 3 && arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF) {
        valid = true;
      }
      // GIF: GIF87a or GIF89a
      else if (arr.length >= 6 &&
        (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46 &&
        arr[3] === 0x38 && (arr[4] === 0x39 || arr[4] === 0x37) && arr[5] === 0x61)) {
        valid = true;
      }
      // BMP: 42 4D
      else if (arr.length >= 2 && arr[0] === 0x42 && arr[1] === 0x4D) {
        valid = true;
      }
      // WEBP: RIFF....WEBP
      else if (arr.length >= 12 &&
        arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46 &&
        arr[8] === 0x57 && arr[9] === 0x45 && arr[10] === 0x42 && arr[11] === 0x50) {
        valid = true;
      }
      cb(valid);
    };
    // Just read enough bytes for all header checks
    reader.readAsArrayBuffer(file.slice(0, 12));
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        setError(null);
        
        // Validate file type
        // Only allow raster image preview (not SVG, not other vector formats)
        const rasterImageTypes = [
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/gif',
          'image/bmp',
          'image/webp'
        ];
        if (!rasterImageTypes.includes(file.type)) {
          setError('Only PNG, JPEG, JPG, GIF, BMP, and WEBP images allowed');
          return;
        }
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          setError('File size must be less than 5MB');
          return;
        }
        
        // Validate actual file content to ensure it's really a raster image
        isValidRasterImage(file, (isValid) => {
          if (!isValid) {
            setError('File format does not match allowed image types');
            return;
          }
          // Store the selected file for upload later
          setSelectedAvatarFile(file);
          
          // Create preview URL
          const previewUrl = URL.createObjectURL(file);
          setPreviewAvatarUrl(previewUrl);
        });
        
      } catch (err) {
        console.error("File selection failed:", err);
        setError(err.message || 'Failed to select file');
      }
    }
  };

  if (!user) {
    return (
      <div className="profile-container">
        <div className="error">Please log in to edit your profile</div>
      </div>
    );
  }

  return (
    <div className="profile-edit-container">
      <div className="profile-edit-header">
        <button 
          onClick={handleCancel} 
          className='close-button-edit'
          aria-label="Cancel editing"
        >
          <XIcon size={20} />
        </button>
        
        {/* Avatar preview */}
        <div className="avatar-preview-container">
          <img 
            src={sanitizeImageUrl(
              previewAvatarUrl && previewAvatarUrl.startsWith('blob:') ? previewAvatarUrl : avatarUrl,
              defaultAvatar
            )} 
            alt="Avatar Preview" 
            className="avatar-preview" 
          />
        </div>

        <div className="avatar-actions">
          <label className="avatar-upload-label">
            <span>Upload</span>
            <input
              type="file"
              className="edit-avatar"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleFileSelect}
              disabled={uploadingAvatar}
              hidden
            />
          </label>

          <input
            type="text"
            className='edit-name'
            value={editedName}
            onChange={(e) => {
              // Remove any spaces from the input
              const nameWithoutSpaces = e.target.value.replace(/\s/g, '');
              setEditedName(nameWithoutSpaces);
            }}
            placeholder={user?.name || user?.username || "Enter username"}
            maxLength={128}
          />

          {uploadingAvatar && (
            <div className="uploading-indicator">
              Uploading avatar...
            </div>
          )}
        </div>

        <small style={{ 
          color: 'var(--text)', 
          fontSize: '0.85rem',
          display: 'block',
          alignSelf: 'center',
        }}>
          No spaces allowed in username
        </small>
        
        {/* Success message */}
        {successMessage && (
          <div className="settings-message success">
            {successMessage}
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className="settings-message error">
            {error}
          </div>
        )} 
            
        <div className="edit-buttons">
          <button 
            onClick={handleSave} 
            className='save-button'
            disabled={saving || uploadingAvatar || (!editedName && !selectedAvatarFile)}
            style={{
              opacity: saving || uploadingAvatar || (!editedName && !selectedAvatarFile) ? 0.6 : 1,
              cursor: saving || uploadingAvatar || (!editedName && !selectedAvatarFile) ? 'not-allowed' : 'pointer'
            }}
          >
            {uploadingAvatar ? 'Uploading Avatar...' : saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileEdit;
