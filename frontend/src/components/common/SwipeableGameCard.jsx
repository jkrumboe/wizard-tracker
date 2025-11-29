import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrashIcon, CloudIcon, ShareIcon, EyeIcon, EditIcon } from '@/components/ui/Icon';
import PropTypes from 'prop-types';

/**
 * SwipeableGameCard component that wraps game cards with swipe-to-reveal actions
 */
const SwipeableGameCard = ({
  children,
  onDelete,
  onSync,
  onShare,
  onEdit,
  detailsPath,
  isUploading = false,
  isSharing = false,
  showSync = false,
  showShare = false,
  showEdit = false,
  syncTitle = '',
  disableSync = false,
  disableShare = false,
}) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const navigate = useNavigate();
  const cardRef = useRef(null);

  const SWIPE_THRESHOLD = 50; // Minimum distance to trigger swipe
  const ACTION_BUTTON_WIDTH = 45; // Width of each action button in pixels
  
  // Calculate dynamic max swipe based on number of visible actions
  const visibleActionsCount = [
    !!detailsPath, // View button
    showEdit,
    showSync,
    showShare,
    true // Delete button (always shown)
  ].filter(Boolean).length;
  
  const MAX_SWIPE = visibleActionsCount * ACTION_BUTTON_WIDTH;

  // Handle touch/mouse start
  const handleStart = (clientX) => {
    setIsDragging(true);
    startX.current = clientX;
    currentX.current = translateX;
  };

  // Handle touch/mouse move
  const handleMove = (clientX) => {
    if (!isDragging) return;

    const diff = startX.current - clientX;
    const newTranslateX = currentX.current + diff;

    // Only allow left swipe (positive values to move left)
    if (newTranslateX > 0) {
      setTranslateX(Math.min(newTranslateX, MAX_SWIPE));
    } else {
      setTranslateX(0);
    }
  };

  // Handle touch/mouse end
  const handleEnd = () => {
    setIsDragging(false);

    // If swiped past threshold, snap to open position
    if (translateX > SWIPE_THRESHOLD) {
      setTranslateX(MAX_SWIPE);
      setIsOpen(true);
    } else {
      setTranslateX(0);
      setIsOpen(false);
    }
  };

  // Touch event handlers
  const handleTouchStart = (e) => {
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    handleMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  // Add mouse move and up listeners when dragging
  useEffect(() => {
    const handleMouseMove = (e) => {
      handleMove(e.clientX);
    };

    const handleMouseUp = () => {
      handleEnd();
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, translateX]);

  // Close swipe when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target) && isOpen) {
        setTranslateX(0);
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle action button clicks
  const handleActionClick = (e, handler) => {
    e.stopPropagation();
    if (handler) {
      handler();
    }
    // Close the swipe after action
    setTimeout(() => {
      setTranslateX(0);
      setIsOpen(false);
    }, 300);
  };

  const handleMouseDown = (e) => {
    // Don't start drag if clicking on a button
    if (e.target.closest('button') || e.target.closest('a')) return;
    handleStart(e.clientX);
  };

  return (
    <div 
      ref={cardRef}
      className="swipeable-card-container"
    >
      {/* Action buttons revealed on swipe */}
      <div className="swipe-actions" style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'stretch',
        width: `${MAX_SWIPE}px`,
        transform: `translateX(${MAX_SWIPE - translateX}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s ease',
      }}>
        {/* View button - always show first */}
        {detailsPath && (
          <button
            className="swipe-action-button view-action"
            onClick={(e) => handleActionClick(e, () => navigate(detailsPath))}
            title="View game details"
            aria-label="View game details"
          >
            <EyeIcon size={24} />
          </button>
        )}

        {/* Edit button */}
        {showEdit && onEdit && (
          <button
            className="swipe-action-button edit-action"
            onClick={(e) => handleActionClick(e, onEdit)}
            title="Edit template"
            aria-label="Edit template"
          >
            <EditIcon size={24} />
          </button>
        )}

        {/* Sync/Upload button */}
        {showSync && (
          <button
            className={`swipe-action-button sync-action ${isUploading ? 'uploading' : ''}`}
            onClick={(e) => handleActionClick(e, onSync)}
            disabled={disableSync || isUploading}
            title={syncTitle}
            aria-label={isUploading ? "Uploading..." : "Upload to cloud"}
          >
            {isUploading ? (
              <span className="share-spinner" aria-label="Uploading..." />
            ) : (
              <CloudIcon size={24} />
            )}
          </button>
        )}

        {/* Share button */}
        {showShare && (
          <button
            className={`swipe-action-button share-action ${isSharing ? 'sharing' : ''}`}
            onClick={(e) => handleActionClick(e, onShare)}
            disabled={disableShare || isSharing}
            title={isSharing ? 'Creating share link...' : 'Share game'}
            aria-label={isSharing ? "Sharing..." : "Share game"}
          >
            {isSharing ? (
              <span className="share-spinner" aria-label="Sharing..." />
            ) : (
              <ShareIcon size={24} />
            )}
          </button>
        )}

        {/* Delete button */}
        <button
          className="swipe-action-button delete-action"
          onClick={(e) => handleActionClick(e, onDelete)}
          title="Delete game"
          aria-label="Delete game"
        >
          <TrashIcon size={24} />
        </button>
      </div>

      {/* Main card content */}
      <div
        className="swipeable-card-content"
        style={{
          transform: `translateX(-${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease',
          cursor: 'default',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        {children}
      </div>
    </div>
  );
};

SwipeableGameCard.propTypes = {
  children: PropTypes.node.isRequired,
  onDelete: PropTypes.func.isRequired,
  onSync: PropTypes.func,
  onShare: PropTypes.func,
  onEdit: PropTypes.func,
  detailsPath: PropTypes.string,
  isUploading: PropTypes.bool,
  isSharing: PropTypes.bool,
  showSync: PropTypes.bool,
  showShare: PropTypes.bool,
  showEdit: PropTypes.bool,
  syncTitle: PropTypes.string,
  disableSync: PropTypes.bool,
  disableShare: PropTypes.bool,
};

export default SwipeableGameCard;
