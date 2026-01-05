import React from 'react';
import PropTypes from 'prop-types';
import { XIcon } from '@/components/ui/Icon';
import '@/styles/components/modal.css';

const ProfilePictureModal = ({
  isOpen,
  onClose,
  imageUrl,
  altText = 'Profile Picture'
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div 
        className="modal-container profile-picture-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '90vw',
          maxHeight: '90vh',
          width: 'auto',
          padding: 0,
          background: 'transparent',
          boxShadow: 'none',
        }}
      >
        <button 
          className="close-btn" 
          onClick={onClose}
        >
          <XIcon size={20} />
        </button>
        <img
          src={imageUrl}
          alt={altText}
          style={{
            maxWidth: '90vw',
            maxHeight: '85vh',
            width: 'auto',
            height: 'auto',
            borderRadius: 'var(--radius-md)',
            objectFit: 'contain',
          }}
        />
      </div>
    </div>
  );
};

ProfilePictureModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  imageUrl: PropTypes.string.isRequired,
  altText: PropTypes.string,
};

export default ProfilePictureModal;
