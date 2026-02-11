import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/shared/hooks/useUser';
import { XIcon } from "@/components/ui/Icon";
import userService from '@/shared/api/userService';
import avatarService from '@/shared/api/avatarService';
import { sanitizeImageUrl } from '@/shared/utils/urlSanitizer';
import ImageCropperModal from '@/components/modals/ImageCropperModal';
import defaultAvatar from "@/assets/default-avatar.png";
import { useTranslation } from 'react-i18next';

const ProfileEdit = () => {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const { t } = useTranslation();
  
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
  const fileInputRef = useRef(null);
  const filePickerOpenTime = useRef(null);

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
        t('profile.unsavedChangesConfirm')
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
        addMessage(t('profile.usernameNoSpaces'), 'error');
        setSaving(false);
        return;
      }
      
      // Validate username length and characters
      if (cleanedName && (cleanedName.length < 3 || cleanedName.length > 20)) {
        addMessage(t('profile.usernameLength'), 'error');
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
          
          addMessage(t('profile.avatarUpdated'), 'success');
        } catch (avatarError) {
          console.error("Avatar upload failed:", avatarError);
          addMessage(t('profile.avatarUploadFailed', { error: avatarError.message }), 'error');
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
          
          addMessage(t('profile.usernameUpdated'), 'success');
        } catch (error) {
          console.error('Username update failed:', error);
          addMessage(t('profile.usernameUpdateFailed', { error: error.message }), 'error');
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
      addMessage(t('profile.profileUpdateFailed'), 'error');
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
      // HEIF/HEIC: ftyp followed by heic, heix, mif1, etc.
      else if (arr.length >= 12 &&
        arr[4] === 0x66 && arr[5] === 0x74 && arr[6] === 0x79 && arr[7] === 0x70) {
        // Check for HEIF variants: heic, heix, mif1, msf1
        valid = true; // Accept any ftyp-based format, iOS will convert
      }
      cb(valid);
    };
    reader.onerror = function(error) {
      console.error('FileReader error during image validation:', error);
      cb(false);
    };
    // Just read enough bytes for all header checks
    try {
      reader.readAsArrayBuffer(file.slice(0, 12));
    } catch (error) {
      console.error('Failed to read file slice:', error);
      cb(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    
    if (!file) {
      return;
    }
    
    try {
      // Validate file type - include HEIF/HEIC for iOS
      const rasterImageTypes = [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/gif',
        'image/bmp',
        'image/webp',
        'image/heif',
        'image/heic',
        'image/heif-sequence',
        'image/heic-sequence'
      ];
      
      // Some mobile browsers may not set type correctly
      const fileExtension = file.name?.split('.').pop()?.toLowerCase();
      const validExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'heif', 'heic'];
      
      if (!rasterImageTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
        addMessage(t('profile.invalidFileType', { type: file.type || t('common.unknown') }), 'error');
        return;
      }
      
      // Validate file size (max 10MB - we'll compress it)
      if (file.size > 10 * 1024 * 1024) {
        addMessage(t('profile.fileSizeExceeds', { size: `${(file.size / 1024 / 1024).toFixed(1)}MB` }), 'error');
        return;
      }
      
      // Validate actual file content with timeout
      const validationPromise = new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          resolve(false);
        }, 5000); // 5 second timeout
        
        isValidRasterImage(file, (isValid) => {
          clearTimeout(timeoutId);
          resolve(isValid);
        });
      });
      
      const isValid = await validationPromise;
      
      if (!isValid) {
        addMessage(t('profile.cannotVerifyImage'), 'error');
        return;
      }
      
      // Store the file and open cropper
      setSelectedAvatarFile(file);
      setShowCropper(true);
      
    } catch (err) {
      addMessage(t('profile.imageProcessFailed', { error: err.message || t('common.error') }), 'error');
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
        <div className="error">{t('profile.pleaseLoginToEdit')}</div>
      </div>
    );
  }

  return (
    <div className="profile-edit-container">
      {/* Messages Stack - Position at top level */}
      {messages.length > 0 && (
        <ul className="messages-container">
          {messages.map((message) => (
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
          aria-label={t('profile.cancelEditing')}
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
              alt={t('profile.avatarPreview')} 
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
              <span>{croppedAvatarBlob ? t('profile.newPicture') : t('profile.changePicture')}</span>
              <input
                ref={fileInputRef}
                type="file"
                className="edit-avatar"
                accept="image/*,image/heic,image/heif"
                onChange={handleFileSelect}
                onClick={() => {
                  filePickerOpenTime.current = Date.now();
                  
                  // iOS workaround: detect when picker closes without selecting
                  const checkForFile = () => {
                    setTimeout(() => {
                      if (fileInputRef.current) {
                        const hasFiles = fileInputRef.current.files?.length > 0;
                        const timeSinceOpen = Date.now() - filePickerOpenTime.current;
                        
                        if (!hasFiles && timeSinceOpen > 1000 && timeSinceOpen < 60000) {
                          addMessage(t('profile.restrictedLocation'), 'error');
                        }
                      }
                    }, 500);
                  };
                  
                  // Listen for window focus (when picker closes)
                  window.addEventListener('focus', checkForFile, { once: true });
                  
                  // Fallback timeout in case focus doesn't fire
                  setTimeout(() => {
                    window.removeEventListener('focus', checkForFile);
                  }, 60000);
                }}
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
                aria-label={t('profile.removeNewPicture')}
              >
                {t('common.cancel')}
              </button>
            )}
          </div>
          {uploadingAvatar && (
            <div className="uploading-indicator" style={{ textAlign: 'center' }}>
              {t('profile.uploadingAvatar')}
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
            {t('profile.usernameLabel')}
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
            placeholder={user?.name || user?.username || t('profile.enterUsername')}
            maxLength={20}
          />
          <small style={{ 
            color: 'var(--text-muted)', 
            fontSize: '0.8rem'
          }}>
            {t('profile.usernameChars')}
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
            {uploadingAvatar ? t('profile.uploadingAvatarBtn') : saving ? t('profile.savingBtn') : t('profile.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileEdit;
