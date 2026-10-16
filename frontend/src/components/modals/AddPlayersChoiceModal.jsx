import React from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon, UsersIcon, ClockIcon, ChevronRightIcon } from '@/components/ui/Icon';
import '@/styles/components/modal.css';
import '@/styles/components/add-players-choice-modal.css';

const AddPlayersChoiceModal = ({ isOpen, onClose, onSelectFriends, onSelectRecentGroup }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container add-players-choice-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('addPlayers.title', { defaultValue: 'Add players' })}</h2>
          <button className="close-btn" onClick={onClose} aria-label={t('common.close')}>
            <XIcon size={20} />
          </button>
        </div>

        <div className="modal-content choice-content">
          <button
            className="choice-option"
            onClick={onSelectFriends}
            title={t('addPlayers.selectFriends', { defaultValue: 'Select from your friends' })}
          >
            <span className="choice-icon" aria-hidden="true">
              <UsersIcon size={22} />
            </span>
            <span className="choice-text">
              <span className="choice-label">{t('addPlayers.friends', { defaultValue: 'Friends' })}</span>
              <span className="choice-description">
                {t('addPlayers.friendsDesc', { defaultValue: 'Add players from your friends list' })}
              </span>
            </span>
            <ChevronRightIcon size={18} className="choice-chevron" aria-hidden="true" />
          </button>

          <button
            className="choice-option"
            onClick={onSelectRecentGroup}
            title={t('addPlayers.selectRecent', { defaultValue: 'Select from recent play groups' })}
          >
            <span className="choice-icon" aria-hidden="true">
              <ClockIcon size={22} />
            </span>
            <span className="choice-text">
              <span className="choice-label">{t('addPlayers.recentGroup', { defaultValue: 'Recent Group' })}</span>
              <span className="choice-description">
                {t('addPlayers.recentDesc', { defaultValue: 'Add players from a previous game' })}
              </span>
            </span>
            <ChevronRightIcon size={18} className="choice-chevron" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPlayersChoiceModal;
