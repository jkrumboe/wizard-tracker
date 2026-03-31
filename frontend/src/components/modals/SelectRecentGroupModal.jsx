import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon, UsersIcon, CheckMarkIcon } from '@/components/ui/Icon';
import { getRecentLocalGames } from '@/shared/api/gameService';
import '@/styles/components/modal.css';
import '@/styles/components/select-friends-modal.css';
import '@/styles/components/select-recent-group-modal.css';

const SelectRecentGroupModal = ({ isOpen, onClose, onConfirm, alreadySelectedPlayers = [] }) => {
  const { t } = useTranslation();
  const [recentGroups, setRecentGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadRecentGroups();
    }
  }, [isOpen]);

  const loadRecentGroups = async () => {
    setLoading(true);
    try {
      const games = await getRecentLocalGames(10);
      
      // Extract player groups from games
      const groups = games.map(game => {
        const players = game.gameState?.players || game.players || [];
        return {
          gameId: game.id,
          date: new Date(game.lastPlayed || game.savedAt || game.created_at).toLocaleDateString(),
          playerCount: players.length,
          players: players.map(p => ({
            id: p.id || p.userId,
            name: p.name,
            userId: p.userId || null,
          })),
          gameName: game.gameName || 'Wizard Game',
        };
      });

      setRecentGroups(groups);
    } catch (err) {
      console.error('Error loading recent groups:', err);
      setRecentGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGroup = (group) => {
    // Filter out players who are already selected
    const newPlayers = group.players.filter(player =>
      !alreadySelectedPlayers.some(p => 
        p.userId === player.userId || p.name === player.name
      )
    );

    if (newPlayers.length === 0) {
      // Show message that all players are already selected
      globalThis.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          message: t('selectRecentGroup.allPlayersAlreadyAdded', { 
            defaultValue: 'All players from this group are already added.' 
          }),
          type: 'info',
          duration: 3000
        }
      }));
      return;
    }

    onConfirm(newPlayers);
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-container select-friends-modal recent-group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <UsersIcon size={20} />
            {t('selectRecentGroup.title', { defaultValue: 'Recent Play Groups' })}
          </h2>
          <button className="close-btn" onClick={handleClose}>
            <XIcon size={20} />
          </button>
        </div>

        <div className="modal-content">
          {loading ? (
            <div className="loading-message">
              {t('selectRecentGroup.loading', { defaultValue: 'Loading recent groups...' })}
            </div>
          ) : recentGroups.length === 0 ? (
            <div className="empty-message">
              {t('selectRecentGroup.noGroups', { 
                defaultValue: 'No recent games found. Play a game first to use this feature.' 
              })}
            </div>
          ) : (
            <>
              <div className="recent-groups-list">
                {recentGroups.map((group, idx) => (
                  <button
                    key={`group-${group.gameId}-${idx}`}
                    className="group-item"
                    onClick={() => handleSelectGroup(group)}
                    title={t('selectRecentGroup.selectThisGroup', { defaultValue: 'Select this group' })}
                  >
                    <div className="group-header">
                      <div className="group-info">
                        <span className="group-game-name">{group.gameName}</span>
                        <span className="group-date">{group.date}</span>
                      </div>
                    </div>
                    <div className="group-players">
                      {group.players.map((player, pidx) => (
                        <div
                          key={`player-${pidx}`}
                          className={`group-player ${alreadySelectedPlayers.some(p => 
                            p.userId === player.userId || p.name === player.name
                          ) ? 'already-added' : ''}`}
                        >
                          <span className="player-name">{player.name}</span>
                          {alreadySelectedPlayers.some(p => 
                            p.userId === player.userId || p.name === player.name
                          ) && (
                            <span className="already-added-badge">
                              {t('selectRecentGroup.alreadyAdded', { defaultValue: 'Already added' })}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={handleClose} className="cancel-button">
            {t('common.close', { defaultValue: 'Close' })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectRecentGroupModal;
