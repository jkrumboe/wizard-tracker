import React from 'react';
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
  if (!isOpen) return null;

  // Determine what to display based on props
  const displayTitle = title || (deleteAll ? 'Clear All Data' : 'Delete Game');
  const displayMessage = message || (deleteAll
    ? 'Are you sure you want to delete all local storage data?'
    : 'Are you sure you want to delete this game?');
  const displayConfirmText = confirmText || (deleteAll ? 'Clear All Data' : 'Delete');

  return (
    <div className="modal-overlay">
      <div className="modal-container delete-confirmation-modal">
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
              Cancel
            </button>
            <button className="modal-button danger" onClick={onConfirm}>
              {displayConfirmText}
            </button>
          </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
