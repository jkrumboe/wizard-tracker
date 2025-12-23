import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/shared/hooks/useUser';
import { XIcon } from "@/components/ui/Icon";
import userService from '@/shared/api/userService';
import avatarService from '@/shared/api/avatarService';
import { sanitizeImageUrl } from '@/shared/utils/urlSanitizer';
import ImageCropperModal from '@/components/modals/ImageCropperModal';
import defaultAvatar from "@/assets/default-avatar.png";

const ProfileEdit = () => {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  
  const [editedName, setEditedName] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatar);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
  const [croppedAvatarBlob, setCroppedAvatarBlob] = useState(null);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState('');
  const [showCropper, setShowCropper] = useState(false);
  const [messages, setMessages] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Add a message to the queue
  const addMessage = (text, type = 'error') => {
    const id = Date.now();
    setMessages(prev => [...prev, { id, text, type }]);
    
    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setMessages(prev => prev.filter(msg => msg.id !== id));
    }, 4000);
  };

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
          await avatarService.preloadAvatar();
          const url = await avatarService.getAvatarUrl(false);
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

  // Track if changes have been made
  useEffect(() => {
    const originalName = user?.name || user?.username || '';
    const nameChanged = editedName.trim() !== '' && editedName !== originalName;
    const avatarChanged = croppedAvatarBlob !== null;
    setHasChanges(nameChanged || avatarChanged);
  }, [editedName, croppedAvatarBlob, user]);

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges && !saving) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges, saving]);

  const handleCancel = () => {
    // Check if there are unsaved changes
    if (hasChanges) {
      const confirmLeave = window.confirm(
        'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.'
      );
      if (!confirmLeave) {
        return;
      }
    }
    
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
      setMessages([]);
      
      // Remove any spaces from the username input
      const cleanedName = editedName.trim().replace(/\s/g, '');
      
      // Validate username doesn't contain spaces
      if (cleanedName && /\s/.test(cleanedName)) {
        addMessage('Username cannot contain spaces', 'error');
        setSaving(false);
        return;
      }
      
      // Validate username length and characters
      if (cleanedName && (cleanedName.length < 3 || cleanedName.length > 20)) {
        addMessage('Username must be between 3 and 20 characters', 'error');
        setSaving(false);
        return;
      }
      
      // Handle avatar upload if a file was selected
      if (croppedAvatarBlob) {
        try {
          setUploadingAvatar(true);
          await avatarService.replaceAvatar(croppedAvatarBlob);
          
          // Get the new avatar URL and update the profile
          const newAvatarUrl = await avatarService.getAvatarUrl(false);
          setAvatarUrl(newAvatarUrl);
          
          // Dispatch custom event to update navbar avatar
          globalThis.dispatchEvent(new CustomEvent('avatarUpdated'));
          
          addMessage('Avatar updated successfully!', 'success');
        } catch (avatarError) {
          console.error("Avatar upload failed:", avatarError);
          addMessage(`Failed to upload avatar: ${avatarError.message}`, 'error');
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
          
          addMessage('Username updated successfully!', 'success');
        } catch (error) {
          console.error('Username update failed:', error);
          addMessage(`Failed to update username: ${error.message}`, 'error');
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

      // Navigate back after 2 seconds
      setTimeout(() => {
        navigate('/profile');
      }, 2000);
      
    } catch (err) {
      console.error("Error updating profile:", err);
      addMessage("Failed to update profile", 'error');
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
        
        // Validate file type
        const rasterImageTypes = [
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/gif',
          'image/bmp',
          'image/webp'
        ];
        if (!rasterImageTypes.includes(file.type)) {
          addMessage('Only PNG, JPEG, JPG, GIF, BMP, and WEBP images allowed', 'error');
          return;
        }
        
        // Validate file size (max 10MB - we'll compress it)
        if (file.size > 10 * 1024 * 1024) {
          addMessage('File size must be less than 10MB', 'error');
          return;
        }
        
        // Validate actual file content
        isValidRasterImage(file, (isValid) => {
          if (!isValid) {
            addMessage('File format does not match allowed image types', 'error');
            return;
          }
          
          // Store the file and open cropper
          setSelectedAvatarFile(file);
          setShowCropper(true);
        });
        
      } catch (err) {
        console.error("File selection failed:", err);
        addMessage(err.message || 'Failed to select file', 'error');
      }
    }
  };

  const handleCropComplete = (blob) => {
    // Store cropped blob for upload
    setCroppedAvatarBlob(blob);
    
    // Create preview URL
    const previewUrl = URL.createObjectURL(blob);
    setPreviewAvatarUrl(previewUrl);
    
    setShowCropper(false);
  };

  const handleRemoveNewAvatar = () => {
    // Clean up preview URL
    if (previewAvatarUrl) {
      URL.revokeObjectURL(previewAvatarUrl);
    }
    setCroppedAvatarBlob(null);
    setPreviewAvatarUrl('');
    setSelectedAvatarFile(null);
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
      {/* Messages Stack - Position at top level */}
      {messages.length > 0 && (
        <ul className="messages-container">
          {messages.map((message, index) => (
            <li 
              key={message.id} 
              className={`settings-message ${message.type}`}
            >
              {message.text}
            </li>
          ))}
        </ul>
      )}
      
      <ImageCropperModal
        isOpen={showCropper}
        onClose={() => {
          setShowCropper(false);
          setSelectedAvatarFile(null);
        }}
        imageFile={selectedAvatarFile}
        onCropComplete={handleCropComplete}
      />
      
      <div className="profile-edit-header">
        <button 
          onClick={handleCancel} 
          className='close-button-edit'
          aria-label="Cancel editing"
        >
          <XIcon size={20} />
        </button>
        
        {/* Avatar Section */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-sm)'
        }}>
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
          <div style={{
            display: 'flex',
            gap: 'var(--spacing-sm)',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: '7.5vh',
            paddingLeft: croppedAvatarBlob ? '25%' : '0'
          }}>
            <label className="avatar-upload-label" style={{
              backgroundColor: croppedAvatarBlob ? 'var(--primary)' : 'var(--card-bg-alt)',
              borderColor: croppedAvatarBlob ? 'var(--primary)' : 'var(--border)',
              color: croppedAvatarBlob ? 'white' : 'var(--text)'
            }}>
              <span>{croppedAvatarBlob ? 'New Picture' : 'Change Picture'}</span>
              <input
                type="file"
                className="edit-avatar"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleFileSelect}
                disabled={uploadingAvatar}
                hidden
              />
            </label>
            {croppedAvatarBlob && !uploadingAvatar && (
              <button
                onClick={handleRemoveNewAvatar}
                className="avatar-upload-label"
                style={{
                  backgroundColor: 'var(--card-bg-alt)',
                  color: 'var(--text)'
                }}
                aria-label="Remove new picture"
              >
                Cancel
              </button>
            )}
          </div>
          {uploadingAvatar && (
            <div className="uploading-indicator" style={{ textAlign: 'center' }}>
              Uploading avatar...
            </div>
          )}
        </div>

        {/* Username Section */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-xs)'
        }}>
          <label htmlFor="username-input" style={{
            fontSize: '0.9rem',
            fontWeight: '500',
            color: 'var(--text)'
          }}>
            Username
          </label>
          <input
            id="username-input"
            type="text"
            className='edit-name'
            value={editedName}
            onChange={(e) => {
              // Remove any spaces from the input
              const nameWithoutSpaces = e.target.value.replace(/\s/g, '');
              setEditedName(nameWithoutSpaces);
            }}
            placeholder={user?.name || user?.username || "Enter username"}
            maxLength={20}
          />
          <small style={{ 
            color: 'var(--text-muted)', 
            fontSize: '0.8rem'
          }}>
            3-20 characters
          </small>
        </div>
            
        <div className="edit-buttons" style={{ marginTop: 'var(--spacing-sm)' }}>
          <button 
            onClick={handleSave} 
            className='save-button'
            disabled={saving || uploadingAvatar || !hasChanges}
            style={{
              opacity: saving || uploadingAvatar || !hasChanges ? 0.6 : 1,
              cursor: saving || uploadingAvatar || !hasChanges ? 'not-allowed' : 'pointer'
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
