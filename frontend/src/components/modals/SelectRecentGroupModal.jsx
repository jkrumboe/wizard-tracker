import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon, UsersIcon, CheckMarkIcon } from '@/components/ui/Icon';
import { getRecentLocalGames } from '@/shared/api/gameService';
import { LocalTableGameStorage } from '@/shared/api/localTableGameStorage';
import { LocalScoreboardGameStorage } from '@/shared/api/localScoreboardGameStorage';
import '@/styles/components/modal.css';
import '@/styles/components/select-friends-modal.css';
import '@/styles/components/select-recent-group-modal.css';

const SelectRecentGroupModal = ({ isOpen, onClose, onSelectGroup, selectedGroupId, alreadySelectedPlayers = [] }) => {
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
      // Fetch wizard games
      const wizardGames = await getRecentLocalGames(10);

      // Fetch table games
      const tableGames = LocalTableGameStorage.getSavedTableGamesList()
        .filter(game => game.gameFinished)
        .slice(0, 10);

      // Fetch scoreboard games
      const scoreboardGames = LocalScoreboardGameStorage.getSavedTableGamesList()
        .filter(game => game.gameFinished)
        .slice(0, 10);

      // Combine and sort all games by date
      const allGames = [
        ...wizardGames.map(g => ({ ...g, _type: 'wizard' })),
        ...tableGames.map(g => ({ ...g, _type: 'table' })),
        ...scoreboardGames.map(g => ({ ...g, _type: 'scoreboard' })),
      ]
        .sort((a, b) => {
          const dateA = new Date(a.lastPlayed || a.savedAt || a.created_at || '1970-01-01');
          const dateB = new Date(b.lastPlayed || b.savedAt || b.created_at || '1970-01-01');
          return dateB - dateA;
        })
        .slice(0, 10);

      // Extract player groups from games
      const groups = allGames.map(game => {
        let players;
        if (game._type === 'wizard') {
          players = (game.gameState?.players || game.players || []).map(p => ({
            id: p.id || p.userId,
            name: p.name,
            userId: p.userId || null,
          }));
        } else {
          // Table / scoreboard games store players in gameData
          const gameData = game.gameData?.gameData || game.gameData;
          const rawPlayers = gameData?.players || [];
          players = rawPlayers.map(p => ({
            id: null,
            name: typeof p === 'string' ? p : p.name,
            userId: null,
          }));
        }

        return {
          gameId: game.id,
          date: new Date(game.lastPlayed || game.savedAt || game.created_at).toLocaleDateString(),
          playerCount: players.length,
          players,
          gameName: game.gameName || game.name || game.gameTypeName || 'Game',
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
    onSelectGroup(group);
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
                    className={`group-item${selectedGroupId === group.gameId ? ' selected' : ''}${group.players.every(player => alreadySelectedPlayers.some(p => p.userId === player.userId || p.name === player.name)) && selectedGroupId !== group.gameId ? ' all-already-added' : ''}`}
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
