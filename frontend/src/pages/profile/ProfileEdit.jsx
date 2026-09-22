import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/shared/hooks/useUser';
import { XIcon } from "@/components/ui/Icon";
import userService from '@/shared/api/userService';
import avatarService from '@/shared/api/avatarService';
import AvatarEditor from '@/components/profile/AvatarEditor';
import defaultAvatar from "@/assets/default-avatar.png";
import { useTranslation } from 'react-i18next';
import '@/styles/pages/account.css';

const ProfileEdit = () => {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const { t } = useTranslation();

  const [editedName, setEditedName] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatar);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [croppedAvatarBlob, setCroppedAvatarBlob] = useState(null);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState('');
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [messages, setMessages] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Add a message to the queue
  const addMessage = useCallback((text, type = 'error') => {
    const id = Date.now() + Math.random();
    setMessages(prev => [...prev, { id, text, type }]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setMessages(prev => prev.filter(msg => msg.id !== id));
    }, 4000);
  }, []);

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
    setHasChanges(nameChanged || croppedAvatarBlob !== null || removeAvatar);
  }, [editedName, croppedAvatarBlob, removeAvatar, user]);

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

  const clearPendingAvatar = () => {
    if (previewAvatarUrl) {
      URL.revokeObjectURL(previewAvatarUrl);
    }
    setPreviewAvatarUrl('');
    setCroppedAvatarBlob(null);
    setRemoveAvatar(false);
  };

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

    clearPendingAvatar();
    navigate('/profile');
  };

  /** A newly cropped picture replaces whatever was staged before. */
  const handleAvatarChange = (blob) => {
    if (previewAvatarUrl) {
      URL.revokeObjectURL(previewAvatarUrl);
    }
    setCroppedAvatarBlob(blob);
    setPreviewAvatarUrl(URL.createObjectURL(blob));
    setRemoveAvatar(false);
  };

  /** Removal is staged like every other edit and applied on save. */
  const handleAvatarRemove = () => {
    if (previewAvatarUrl) {
      URL.revokeObjectURL(previewAvatarUrl);
    }
    setPreviewAvatarUrl('');
    setCroppedAvatarBlob(null);
    setRemoveAvatar(true);
  };

  const handleSave = async () => {
    if (saving) return; // Prevent multiple simultaneous saves

    try {
      setSaving(true);
      setMessages([]);

      // Remove any spaces from the username input
      const cleanedName = editedName.trim().replace(/\s/g, '');

      // Validate username length and characters
      if (cleanedName && (cleanedName.length < 3 || cleanedName.length > 20)) {
        addMessage(t('profile.usernameLength'), 'error');
        setSaving(false);
        return;
      }

      // Apply the staged picture change (upload or removal)
      if (croppedAvatarBlob || removeAvatar) {
        try {
          setUploadingAvatar(true);

          if (removeAvatar) {
            await avatarService.deleteAvatar();
            setAvatarUrl(defaultAvatar);
            addMessage(t('avatar.photoRemoved'), 'success');
          } else {
            await avatarService.replaceAvatar(croppedAvatarBlob);
            const newAvatarUrl = await avatarService.getAvatarUrl(false);
            setAvatarUrl(newAvatarUrl);
            addMessage(t('profile.avatarUpdated'), 'success');
          }

          clearPendingAvatar();

          // Dispatch custom event to update navbar avatar
          globalThis.dispatchEvent(new CustomEvent('avatarUpdated'));
        } catch (avatarError) {
          console.error("Avatar update failed:", avatarError);
          addMessage(t('profile.avatarUploadFailed', { error: avatarError.message }), 'error');
          return; // Don't continue if the picture could not be saved
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

  if (!user) {
    return (
      <div className="profile-container">
        <div className="error">{t('profile.pleaseLoginToEdit')}</div>
      </div>
    );
  }

  const hasCustomPicture = !removeAvatar && (Boolean(croppedAvatarBlob) || avatarUrl !== defaultAvatar);
  const displayedAvatar = removeAvatar ? defaultAvatar : (previewAvatarUrl || avatarUrl);
  const busyLabel = removeAvatar ? t('avatar.removingPhoto') : t('profile.uploadingAvatar');

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

      <div className="profile-edit-header">
        <button
          onClick={handleCancel}
          className='close-button-edit'
          aria-label={t('profile.cancelEditing')}
        >
          <XIcon size={20} />
        </button>

        {/* Avatar Section */}
        <div className="profile-edit-avatar">
          <AvatarEditor
            src={displayedAvatar}
            alt={t('profile.avatarPreview')}
            size={140}
            hasPicture={hasCustomPicture}
            pending={Boolean(croppedAvatarBlob) || removeAvatar}
            busy={uploadingAvatar}
            busyLabel={busyLabel}
            showHint
            onChange={handleAvatarChange}
            onRemove={handleAvatarRemove}
            onError={(text) => addMessage(text, 'error')}
          />

          {(croppedAvatarBlob || removeAvatar) && !uploadingAvatar && (
            <button
              type="button"
              className="avatar-revert-button"
              onClick={clearPendingAvatar}
            >
              {t('avatar.undoChange')}
            </button>
          )}
        </div>

        {/* Username Section */}
        <div className="profile-edit-field">
          <label htmlFor="username-input" className="profile-edit-label">
            {t('profile.usernameLabel')}
          </label>
          <input
            id="username-input"
            type="text"
            className='edit-name'
            value={editedName}
            onChange={(e) => {
              // Remove any spaces from the input
              setEditedName(e.target.value.replace(/\s/g, ''));
            }}
            placeholder={user?.name || user?.username || t('profile.enterUsername')}
            maxLength={20}
          />
          <small className="profile-edit-help">
            {t('profile.usernameChars')}
          </small>
        </div>

        <div className="edit-buttons">
          <button
            onClick={handleSave}
            className='save-button'
            disabled={saving || uploadingAvatar || !hasChanges}
          >
            {uploadingAvatar
              ? t('profile.uploadingAvatarBtn')
              : saving
                ? t('profile.savingBtn')
                : t('profile.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileEdit;
