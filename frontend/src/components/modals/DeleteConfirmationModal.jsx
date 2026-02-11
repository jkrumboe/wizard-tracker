import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { XIcon } from '@/components/ui/Icon';
import '@/styles/components/modal.css';

const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  deleteAll,
  title,
  message,
  confirmText
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  // Determine what to display based on props
  const displayTitle = title || (deleteAll ? t('account.clearAllData') : t('settings.deleteGame'));
  const displayMessage = message || (deleteAll
    ? t('accountMessages.clearDataConfirm')
    : t('accountMessages.deleteGameConfirm'));
  const displayConfirmText = confirmText || (deleteAll ? t('account.clearAllData') : t('common.delete'));

  return (
    <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="modal-container delete-confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{displayTitle}</h2>
          <button className="close-btn" onClick={onClose}>
            <XIcon size={20} />
          </button>
        </div>
        <div className="modal-content">
          <h3 style={{margin: 0}}>
            {displayMessage}
          </h3>
        </div>
        <div className="modal-actions">
            <button className="modal-button secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button className="modal-button danger" onClick={onConfirm}>
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
  confirmText: PropTypes.string
};

export default DeleteConfirmationModal;
