import React from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon, UsersIcon, ClockIcon } from '@/components/ui/Icon';
import '@/styles/components/modal.css';
import '@/styles/components/add-players-choice-modal.css';

const AddPlayersChoiceModal = ({ isOpen, onClose, onSelectFriends, onSelectRecentGroup }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container add-players-choice-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content choice-content">
          <div className="choice-buttons">
            <button
              className="choice-button friends-button"
              onClick={onSelectFriends}
              title={t('addPlayers.selectFriends', { defaultValue: 'Select from your friends' })}
            >
              <UsersIcon size={40} />
              <span className="choice-label">{t('addPlayers.friends', { defaultValue: 'Friends' })}</span>
              <span className="choice-description">
                {t('addPlayers.friendsDesc', { defaultValue: 'Add players from your friends list' })}
              </span>
            </button>

            <button
              className="choice-button recent-button"
              onClick={onSelectRecentGroup}
              title={t('addPlayers.selectRecent', { defaultValue: 'Select from recent play groups' })}
            >
              <ClockIcon size={40} />
              <span className="choice-label">{t('addPlayers.recentGroup', { defaultValue: 'Recent Group' })}</span>
              <span className="choice-description">
                {t('addPlayers.recentDesc', { defaultValue: 'Add players from a previous game' })}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddPlayersChoiceModal;
