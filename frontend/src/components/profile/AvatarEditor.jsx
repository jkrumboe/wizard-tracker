import React, { useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { CameraIcon } from '@/components/ui/Icon';
import { sanitizeImageUrl } from '@/shared/utils/urlSanitizer';
import { validateAvatarFile, AVATAR_INPUT_ACCEPT } from '@/shared/utils/imageFileValidation';
import ImageCropperModal from '@/components/modals/ImageCropperModal';
import ProfilePictureModal from '@/components/modals/ProfilePictureModal';
import AvatarActionSheet from '@/components/profile/AvatarActionSheet';
import defaultAvatar from '@/assets/default-avatar.png';
import '@/styles/components/avatar.css';

/**
 * The profile picture control used across the app.
 *
 * Owns the whole picking flow - tap to open the action sheet, pick or shoot a
 * photo, crop it, or view/remove the current one - and hands the finished,
 * square image back through `onChange`. Callers decide whether that image is
 * uploaded right away or staged until a save button is pressed.
 */
const AvatarEditor = ({
  src,
  alt,
  size = 140,
  editable = true,
  hasPicture = false,
  pending = false,
  busy = false,
  busyLabel,
  showBadge = true,
  showHint = false,
  onChange,
  onRemove,
  onError
}) => {
  const { t } = useTranslation();
  const libraryInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const pickerOpenedAt = useRef(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [fileToCrop, setFileToCrop] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const reportError = useCallback(
    (errorKey, params) => {
      onError?.(t(errorKey, params));
    },
    [onError, t]
  );

  const acceptFile = useCallback(
    async (file) => {
      if (!file) return;

      const result = await validateAvatarFile(file);
      if (!result.valid) {
        reportError(result.errorKey, result.params);
        return;
      }

      setFileToCrop(file);
    },
    [reportError]
  );

  const handleInputChange = async (event) => {
    const file = event.target.files?.[0];
    // Reset first so picking the same file twice in a row still fires onChange.
    event.target.value = '';
    await acceptFile(file);
  };

  /**
   * iOS hands back an empty picker when the image lives somewhere sandboxed
   * (WhatsApp, iCloud Drive and friends). Detect that silent cancel and explain it.
   */
  const watchForSilentCancel = (inputRef) => {
    pickerOpenedAt.current = Date.now();

    const checkForFile = () => {
      setTimeout(() => {
        const hasFiles = inputRef.current?.files?.length > 0;
        const elapsed = Date.now() - pickerOpenedAt.current;
        if (!hasFiles && elapsed > 1000 && elapsed < 60000) {
          reportError('profile.restrictedLocation');
        }
      }, 500);
    };

    globalThis.addEventListener('focus', checkForFile, { once: true });
    setTimeout(() => globalThis.removeEventListener('focus', checkForFile), 60000);
  };

  const openLibrary = () => {
    watchForSilentCancel(libraryInputRef);
    libraryInputRef.current?.click();
  };

  const openCamera = () => {
    cameraInputRef.current?.click();
  };

  const handleAvatarActivate = () => {
    if (busy) return;
    if (editable) {
      setSheetOpen(true);
    } else if (hasPicture) {
      setViewerOpen(true);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleAvatarActivate();
    }
  };

  // Drag and drop, for the desktop users who expect it.
  const handleDragOver = (event) => {
    if (!editable || busy) return;
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (event) => {
    if (!editable || busy) return;
    event.preventDefault();
    setIsDragging(false);
    await acceptFile(event.dataTransfer?.files?.[0]);
  };

  const handleCropComplete = (blob) => {
    setFileToCrop(null);
    onChange?.(blob);
  };

  const displaySrc = sanitizeImageUrl(src, defaultAvatar);
  const interactive = editable || hasPicture;
  const frameClassName = [
    'avatar-editor-frame',
    interactive ? 'interactive' : '',
    isDragging ? 'dragging' : '',
    pending ? 'pending' : '',
    busy ? 'busy' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="avatar-editor" style={{ '--avatar-size': size + 'px' }}>
      <div className="avatar-editor-stack">
        <div
          className={frameClassName}
          role={interactive ? 'button' : undefined}
          tabIndex={interactive ? 0 : undefined}
          aria-label={editable ? t('avatar.changePhotoAria') : undefined}
          onClick={handleAvatarActivate}
          onKeyDown={interactive ? handleKeyDown : undefined}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <img
            src={displaySrc}
            alt={alt || t('profile.avatarPreview')}
            className="avatar-editor-image"
            onError={(e) => {
              e.target.src = defaultAvatar;
            }}
          />

          {editable && !busy && (
            <span className="avatar-editor-overlay" aria-hidden="true">
              <CameraIcon size={Math.max(18, Math.round(size / 6))} />
            </span>
          )}

          {busy && (
            <span className="avatar-editor-loading" aria-hidden="true">
              <span className="avatar-editor-spinner" />
            </span>
          )}
        </div>

        {editable && showBadge && (
          <button
            type="button"
            className="avatar-editor-badge"
            onClick={handleAvatarActivate}
            disabled={busy}
            aria-label={t('avatar.changePhotoAria')}
          >
            <CameraIcon size={16} />
          </button>
        )}
      </div>

      {busy && busyLabel && <p className="avatar-editor-status">{busyLabel}</p>}

      {!busy && pending && <p className="avatar-editor-status pending">{t('avatar.pendingChange')}</p>}

      {!busy && !pending && showHint && editable && (
        <p className="avatar-editor-hint">{t('avatar.dropHint')}</p>
      )}

      <input
        ref={libraryInputRef}
        type="file"
        accept={AVATAR_INPUT_ACCEPT}
        onChange={handleInputChange}
        disabled={busy}
        hidden
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleInputChange}
        disabled={busy}
        hidden
      />

      <AvatarActionSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onView={() => setViewerOpen(true)}
        onChooseFromLibrary={openLibrary}
        onTakePhoto={openCamera}
        onRemove={onRemove}
        hasPicture={hasPicture}
        busy={busy}
      />

      <ImageCropperModal
        isOpen={Boolean(fileToCrop)}
        onClose={() => setFileToCrop(null)}
        imageFile={fileToCrop}
        onCropComplete={handleCropComplete}
      />

      <ProfilePictureModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        imageUrl={displaySrc}
        altText={alt || t('profile.avatarPreview')}
        onChangePhoto={
          editable
            ? () => {
                setViewerOpen(false);
                openLibrary();
              }
            : undefined
        }
      />
    </div>
  );
};

AvatarEditor.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string,
  size: PropTypes.number,
  editable: PropTypes.bool,
  hasPicture: PropTypes.bool,
  pending: PropTypes.bool,
  busy: PropTypes.bool,
  busyLabel: PropTypes.string,
  showBadge: PropTypes.bool,
  showHint: PropTypes.bool,
  onChange: PropTypes.func,
  onRemove: PropTypes.func,
  onError: PropTypes.func
};

export default AvatarEditor;
