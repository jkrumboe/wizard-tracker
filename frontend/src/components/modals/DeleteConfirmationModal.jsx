import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { XIcon } from '@/components/ui/Icon';
import { useModalDismiss } from '@/shared/hooks/useModalDismiss';
import '@/styles/components/modal.css';

const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  deleteAll,
  title,
  message,
  confirmText,
  variant = 'danger'
}) => {
  const { t } = useTranslation();
  const backdrop = useModalDismiss(isOpen, onClose);
  if (!isOpen) return null;

  // Determine what to display based on props
  const displayTitle = title || (deleteAll ? t('account.clearAllData') : t('settings.deleteGame'));
  const displayMessage = message || (deleteAll
    ? t('accountMessages.clearDataConfirm')
    : t('accountMessages.deleteGameConfirm'));
  const displayConfirmText = confirmText || (deleteAll ? t('account.clearAllData') : t('common.delete'));

  // Often rendered inside another modal: keep clicks from reaching its backdrop
  const handleOverlayClick = (e) => {
    e.stopPropagation();
    backdrop.onClick(e);
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className="modal-container delete-confirmation-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirmation-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="delete-confirmation-title">{displayTitle}</h2>
          <button className="close-btn" onClick={onClose} aria-label={t('common.close')}>
            <XIcon size={20} />
          </button>
        </div>
        <div className="modal-content">
          <h3 className="delete-confirmation-message">
            {displayMessage}
          </h3>
        </div>
        <div className="modal-actions">
            <button className="modal-button secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button className={`modal-button ${variant}`} onClick={onConfirm}>
              {displayConfirmText}
            </button>
          </div>
      </div>
    </div>
  );
};

DeleteConfirmationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  deleteAll: PropTypes.bool,
  title: PropTypes.string,
  message: PropTypes.string,
  confirmText: PropTypes.string,
  // 'primary' for confirmations that don't destroy anything (e.g. finishing a game)
  variant: PropTypes.oneOf(['danger', 'primary'])
};

export default DeleteConfirmationModal;
