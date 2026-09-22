import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { XIcon, CameraIcon, TrashIcon } from '@/components/ui/Icon';
import '@/styles/components/avatar.css';

/**
 * Full screen viewer for a profile picture.
 *
 * Behaves like the photo viewers people know from other apps: tap anywhere to
 * dismiss, Escape closes, the page behind stays put, and the picture's own
 * actions sit in a bar underneath it.
 */
const ProfilePictureModal = ({
  isOpen,
  onClose,
  imageUrl,
  altText = 'Profile Picture',
  title,
  onChangePhoto,
  onRemovePhoto
}) => {
  const { t } = useTranslation();
  const closeButtonRef = useRef(null);

  // Escape to close, and keep the page behind from scrolling away underneath.
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const hasActions = Boolean(onChangePhoto || onRemovePhoto);

  return (
    <div
      className="photo-viewer-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={title || altText}
    >
      <div className="photo-viewer-topbar">
        <span className="photo-viewer-title">{title || altText}</span>
        <button
          ref={closeButtonRef}
          type="button"
          className="photo-viewer-close"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <XIcon size={20} />
        </button>
      </div>

      <figure className="photo-viewer-stage" onClick={handleOverlayClick}>
        <img src={imageUrl} alt={altText} className="photo-viewer-image" />
      </figure>

      {hasActions && (
        <div className="photo-viewer-actions">
          {onChangePhoto && (
            <button type="button" className="photo-viewer-action" onClick={onChangePhoto}>
              <CameraIcon size={18} />
              <span>{t('avatar.changePhoto')}</span>
            </button>
          )}
          {onRemovePhoto && (
            <button
              type="button"
              className="photo-viewer-action danger"
              onClick={onRemovePhoto}
            >
              <TrashIcon size={18} />
              <span>{t('avatar.removePhoto')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

ProfilePictureModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  imageUrl: PropTypes.string.isRequired,
  altText: PropTypes.string,
  title: PropTypes.string,
  onChangePhoto: PropTypes.func,
  onRemovePhoto: PropTypes.func
};

export default ProfilePictureModal;
