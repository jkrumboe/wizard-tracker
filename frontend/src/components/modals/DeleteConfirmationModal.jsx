import React from 'react';
import { XIcon } from '@/components/ui/Icon';
import '@/styles/components/modal.css';

const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  deleteAll
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container delete-confirmation-modal">
        <div className="modal-header">
          <h2>{deleteAll ? 'Clear All Data' : 'Delete Game'}</h2>
          <button className="close-btn" onClick={onClose}>
            <XIcon size={20} />
          </button>
        </div>
        <div className="modal-content">
          <h3>
            {deleteAll
              ? 'Are you sure you want to delete all local storage data?'
              : 'Are you sure you want to delete this game?'}
          </h3>
          <p className="delete-description">
            This action cannot be undone.
          </p>
          <div className="modal-actions">
            <button className="modal-button secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="modal-button danger" onClick={onConfirm}>
              {deleteAll ? 'Clear All Data' : 'Delete Game'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
