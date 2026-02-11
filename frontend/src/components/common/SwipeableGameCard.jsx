import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { TrashIcon, CloudIcon, ShareIcon, EyeIcon, EditIcon, RotateCcwIcon } from '@/components/ui/Icon';
import { EllipsisVertical } from 'lucide-react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

/**
 * SwipeableGameCard — wraps a card with a "⋮" context-menu button.
 * Tapping the button opens a dropdown popover listing the available actions.
 * No swiping required — everything is immediately visible and tappable.
 */
const SwipeableGameCard = ({
  children,
  onDelete,
  onSync,
  onSyncToSystem,
  onShare,
  onEdit,
  onViewDetails,
  detailsPath,
  isUploading = false,
  isSharing = false,
  showSync = false,
  showSyncToSystem = false,
  showShare = false,
  showEdit = false,
  showViewDetails = false,
  showDelete = true,
  syncTitle = '',
  syncToSystemTitle = '',
  disableSync = false,
  disableSyncToSystem = false,
  disableShare = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const containerRef = useRef(null);
  const menuRef = useRef(null);
  const btnRef = useRef(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Position the dropdown relative to the container using fixed positioning
  const updateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = menuRef.current?.offsetHeight || 40;
    const spaceBelow = window.innerHeight - rect.bottom;
    const showAbove = spaceBelow < dropdownHeight + 8;

    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      ...(showAbove
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, []);

  // Build the list of visible actions
  const actions = [];

  if (detailsPath) {
    actions.push({
      key: 'view',
      label: t('common.viewDetails'),
      icon: <EyeIcon size={16} />,
      className: 'action-view',
      handler: () => navigate(detailsPath),
    });
  }
  if (showViewDetails && onViewDetails) {
    actions.push({
      key: 'viewDetails',
      label: t('common.viewDetails'),
      icon: <EyeIcon size={16} />,
      className: 'action-view',
      handler: onViewDetails,
    });
  }
  if (showEdit && onEdit) {
    actions.push({
      key: 'edit',
      label: t('common.edit'),
      icon: <EditIcon size={16} />,
      className: 'action-edit',
      handler: onEdit,
    });
  }
  if (showSync) {
    actions.push({
      key: 'sync',
      label: isUploading ? t('common.uploading') : (syncTitle || t('common.uploadToCloud')),
      icon: isUploading
        ? <span className="share-spinner small" aria-label="Uploading…" />
        : <CloudIcon size={16} />,
      className: 'action-sync',
      handler: onSync,
      disabled: disableSync || isUploading,
    });
  }
  if (showSyncToSystem) {
    actions.push({
      key: 'syncSystem',
      label: syncToSystemTitle || t('common.syncToSystem'),
      icon: <RotateCcwIcon size={16} />,
      className: 'action-sync-system',
      handler: onSyncToSystem,
      disabled: disableSyncToSystem,
    });
  }
  if (showShare) {
    actions.push({
      key: 'share',
      label: isSharing ? t('common.sharing') : t('common.share'),
      icon: isSharing
        ? <span className="share-spinner small" aria-label="Sharing…" />
        : <ShareIcon size={16} />,
      className: 'action-share',
      handler: onShare,
      disabled: disableShare || isSharing,
    });
  }
  if (showDelete && onDelete) {
    actions.push({
      key: 'delete',
      label: t('common.delete'),
      icon: <TrashIcon size={16} />,
      className: 'action-delete',
      handler: onDelete,
    });
  }

  // Calculate position when menu opens and on scroll/resize
  useEffect(() => {
    if (!menuOpen) return;
    updateDropdownPosition();
    const onScrollOrResize = () => setMenuOpen(false);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [menuOpen, updateDropdownPosition]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [menuOpen]);

  // Close menu on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [menuOpen]);

  const handleToggle = (e) => {
    e.stopPropagation();
    setMenuOpen((prev) => !prev);
  };

  const handleAction = (e, action) => {
    e.stopPropagation();
    if (action.disabled) return;
    if (action.handler) action.handler();
    setMenuOpen(false);
  };

  return (
    <div ref={containerRef} className="card-actions-container">
      {/* Card content */}
      <div className="card-actions-content">
        {children}
      </div>

      {/* Context menu trigger */}
      {actions.length > 0 && (
        <div className="card-actions-menu-wrapper">
          <button
            ref={btnRef}
            className={`card-actions-menu-btn ${menuOpen ? 'active' : ''}`}
            onClick={handleToggle}
            aria-label={t('common.moreActions')}
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            <EllipsisVertical size={18} />
          </button>
        </div>
      )}

      {/* Dropdown — rendered via portal so it floats above everything */}
      {menuOpen && actions.length > 0 && createPortal(
        <div
          ref={menuRef}
          className="card-actions-dropdown"
          role="menu"
          style={dropdownStyle}
        >
          {actions.map((action) => (
            <button
              key={action.key}
              className={`card-actions-dropdown-item ${action.className} ${action.disabled ? 'disabled' : ''}`}
              onClick={(e) => handleAction(e, action)}
              disabled={action.disabled}
              role="menuitem"
            >
              <span className="card-actions-dropdown-icon">{action.icon}</span>
              <span className="card-actions-dropdown-label">{action.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

SwipeableGameCard.propTypes = {
  children: PropTypes.node.isRequired,
  onDelete: PropTypes.func,
  onSync: PropTypes.func,
  onSyncToSystem: PropTypes.func,
  onShare: PropTypes.func,
  onEdit: PropTypes.func,
  onViewDetails: PropTypes.func,
  detailsPath: PropTypes.string,
  isUploading: PropTypes.bool,
  isSharing: PropTypes.bool,
  showSync: PropTypes.bool,
  showSyncToSystem: PropTypes.bool,
  showShare: PropTypes.bool,
  showEdit: PropTypes.bool,
  showViewDetails: PropTypes.bool,
  showDelete: PropTypes.bool,
  syncTitle: PropTypes.string,
  syncToSystemTitle: PropTypes.string,
  disableSync: PropTypes.bool,
  disableSyncToSystem: PropTypes.bool,
  disableShare: PropTypes.bool,
};

export default SwipeableGameCard;
