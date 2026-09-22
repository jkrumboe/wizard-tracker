import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { CameraIcon, ImageIcon, EyeIcon, TrashIcon } from '@/components/ui/Icon';
import '@/styles/components/avatar.css';

/**
 * Action sheet shown when a profile picture is tapped.
 *
 * Slides up from the bottom on phones and centers itself on wider screens,
 * matching the "tap your picture, pick what to do" pattern of other apps.
 * Removing a picture asks for confirmation inside the sheet instead of
 * throwing a browser dialog at the user.
 */
const AvatarActionSheet = ({
  isOpen,
  onClose,
  onView,
  onChooseFromLibrary,
  onTakePhoto,
  onRemove,
  hasPicture = false,
  busy = false
}) => {
  const { t } = useTranslation();
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const sheetRef = useRef(null);

  // A camera shortcut only makes sense on touch devices - on a desktop the
  // `capture` attribute is ignored and would just open the file picker twice.
  const supportsCamera =
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(pointer: coarse)').matches;

  useEffect(() => {
    if (!isOpen) {
      setConfirmingRemove(false);
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    sheetRef.current?.focus();

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

  const runAction = (action) => () => {
    onClose();
    action?.();
  };

  return (
    <div className="avatar-sheet-overlay" onClick={handleOverlayClick}>
      <div
        className="avatar-sheet"
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('avatar.sheetTitle')}
      >
        <span className="avatar-sheet-grabber" aria-hidden="true" />

        {confirmingRemove ? (
          <div className="avatar-sheet-confirm">
            <h3 className="avatar-sheet-heading">{t('avatar.removeConfirmTitle')}</h3>
            <p className="avatar-sheet-subtitle">{t('avatar.removeConfirmBody')}</p>
            <div className="avatar-sheet-confirm-actions">
              <button
                type="button"
                className="avatar-sheet-button ghost"
                onClick={() => setConfirmingRemove(false)}
                disabled={busy}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="avatar-sheet-button danger"
                onClick={runAction(onRemove)}
                disabled={busy}
              >
                {t('avatar.removePhoto')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="avatar-sheet-heading">{t('avatar.sheetTitle')}</h3>

            <div className="avatar-sheet-actions">
              {hasPicture && onView && (
                <button type="button" className="avatar-sheet-action" onClick={runAction(onView)}>
                  <span className="avatar-sheet-action-icon"><EyeIcon size={20} /></span>
                  <span className="avatar-sheet-action-text">
                    <span className="avatar-sheet-action-label">{t('avatar.viewPhoto')}</span>
                    <span className="avatar-sheet-action-hint">{t('avatar.viewPhotoHint')}</span>
                  </span>
                </button>
              )}

              {supportsCamera && onTakePhoto && (
                <button type="button" className="avatar-sheet-action" onClick={runAction(onTakePhoto)}>
                  <span className="avatar-sheet-action-icon"><CameraIcon size={20} /></span>
                  <span className="avatar-sheet-action-text">
                    <span className="avatar-sheet-action-label">{t('avatar.takePhoto')}</span>
                    <span className="avatar-sheet-action-hint">{t('avatar.takePhotoHint')}</span>
                  </span>
                </button>
              )}

              <button
                type="button"
                className="avatar-sheet-action"
                onClick={runAction(onChooseFromLibrary)}
              >
                <span className="avatar-sheet-action-icon"><ImageIcon size={20} /></span>
                <span className="avatar-sheet-action-text">
                  <span className="avatar-sheet-action-label">
                    {hasPicture ? t('avatar.changePhoto') : t('avatar.uploadPhoto')}
                  </span>
                  <span className="avatar-sheet-action-hint">{t('avatar.choosePhotoHint')}</span>
                </span>
              </button>

              {hasPicture && onRemove && (
                <button
                  type="button"
                  className="avatar-sheet-action danger"
                  onClick={() => setConfirmingRemove(true)}
                >
                  <span className="avatar-sheet-action-icon"><TrashIcon size={20} /></span>
                  <span className="avatar-sheet-action-text">
                    <span className="avatar-sheet-action-label">{t('avatar.removePhoto')}</span>
                    <span className="avatar-sheet-action-hint">{t('avatar.removePhotoHint')}</span>
                  </span>
                </button>
              )}
            </div>

            <button type="button" className="avatar-sheet-button ghost full" onClick={onClose}>
              {t('common.cancel')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

AvatarActionSheet.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onView: PropTypes.func,
  onChooseFromLibrary: PropTypes.func.isRequired,
  onTakePhoto: PropTypes.func,
  onRemove: PropTypes.func,
  hasPicture: PropTypes.bool,
  busy: PropTypes.bool
};

export default AvatarActionSheet;
