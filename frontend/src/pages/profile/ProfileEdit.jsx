import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/shared/hooks/useUser';
import { XIcon } from "@/components/ui/Icon";
import userService from '@/shared/api/userService';
import avatarService from '@/shared/api/avatarService';
import defaultAvatar from "@/assets/default-avatar.png";
import DOMPurify from 'dompurify';

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
      
      // Remove any spaces and sanitize the name
      const sanitizedEditedName = DOMPurify.sanitize(editedName.replace(/\s/g, ''));
      
      // Validate username doesn't contain spaces
      if (sanitizedEditedName && /\s/.test(sanitizedEditedName)) {
        setError('Username cannot contain spaces');
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
      if (sanitizedEditedName && sanitizedEditedName !== user.name && sanitizedEditedName !== user.username) {
        let newUserData = null;
        
        try {
          // Try to update using the Users API
          const result = await userService.updateUserName(user.$id || user.id, sanitizedEditedName);
          
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
          name: sanitizedEditedName,
          username: sanitizedEditedName
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
        
        // Store the selected file for upload later
        setSelectedAvatarFile(file);
        
        // Create preview URL
        const previewUrl = URL.createObjectURL(file);
        setPreviewAvatarUrl(previewUrl);
        
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
            src={previewAvatarUrl && previewAvatarUrl.startsWith('blob:') ? previewAvatarUrl : avatarUrl} 
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
