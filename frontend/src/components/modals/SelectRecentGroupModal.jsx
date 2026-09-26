import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon, UsersIcon } from '@/components/ui/Icon';
import { getRecentLocalGames } from '@/shared/api/gameService';
import { LocalTableGameStorage } from '@/shared/api/localTableGameStorage';
import { LocalScoreboardGameStorage } from '@/shared/api/localScoreboardGameStorage';
import '@/styles/components/modal.css';
import '@/styles/components/select-friends-modal.css';
import '@/styles/components/select-recent-group-modal.css';

// How many games per source to scan before collapsing them into unique groups
const GAMES_PER_SOURCE = 30;
// How many unique player groups to show
const MAX_GROUPS = 10;

const getGameDate = (game) =>
  new Date(game.lastPlayed || game.savedAt || game.created_at || '1970-01-01');

// Identity of a single player: user id when known, otherwise the normalized name
const getPlayerKey = (player) =>
  player.userId ? `u:${player.userId}` : `n:${(player.name || '').trim().toLowerCase()}`;

const isSamePlayer = (a, b) => {
  if (a.userId && b.userId) return a.userId === b.userId;
  return (a.name || '').trim().toLowerCase() === (b.name || '').trim().toLowerCase();
};

// Extract the players of a game, independent of which game type it came from
const extractPlayers = (game) => {
  if (game._type === 'wizard') {
    return (game.gameState?.players || game.players || []).map(p => ({
      id: p.id || p.userId,
      name: typeof p === 'string' ? p : p.name,
      userId: p.userId || null,
    }));
  }

  // Table / scoreboard games store players in gameData, team based ones in teamMembers
  const gameData = game.gameData?.gameData || game.gameData;
  const rawPlayers = Array.isArray(gameData?.teamMembers)
    ? gameData.teamMembers.flat()
    : (gameData?.players || []);

  return rawPlayers.map(p => ({
    id: null,
    name: typeof p === 'string' ? p : p.name,
    userId: p?.userId || null,
  }));
};

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
      const wizardGames = await getRecentLocalGames(GAMES_PER_SOURCE);

      // Fetch table games
      const tableGames = LocalTableGameStorage.getSavedTableGamesList()
        .filter(game => game.gameFinished)
        .slice(0, GAMES_PER_SOURCE);

      // Fetch scoreboard games
      const scoreboardGames = LocalScoreboardGameStorage.getSavedTableGamesList()
        .filter(game => game.gameFinished)
        .slice(0, GAMES_PER_SOURCE);

      // Combine and sort all games by date, newest first
      const allGames = [
        ...wizardGames.map(g => ({ ...g, _type: 'wizard' })),
        ...tableGames.map(g => ({ ...g, _type: 'table' })),
        ...scoreboardGames.map(g => ({ ...g, _type: 'scoreboard' })),
      ].sort((a, b) => getGameDate(b) - getGameDate(a));

      // Collapse the games into unique player groups - the same people playing
      // different games should only be suggested once
      const groupsByKey = new Map();

      allGames.forEach(game => {
        const players = extractPlayers(game).filter(p => p.name && p.name.trim());
        if (players.length === 0) return;

        const groupKey = players.map(getPlayerKey).sort().join('|');
        const existing = groupsByKey.get(groupKey);

        if (!existing) {
          groupsByKey.set(groupKey, {
            groupId: groupKey,
            date: getGameDate(game).toLocaleDateString(),
            playerCount: players.length,
            players,
          });
          return;
        }

        // Keep the group from the most recent game but fill in user ids that
        // only an older game of another type knows about
        existing.players = existing.players.map(player => {
          if (player.userId) return player;
          const match = players.find(p => p.userId && isSamePlayer(p, player));
          return match ? { ...player, userId: match.userId, id: player.id || match.id } : player;
        });
      });

      setRecentGroups(Array.from(groupsByKey.values()).slice(0, MAX_GROUPS));
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

  const isAlreadySelected = (player) =>
    alreadySelectedPlayers.some(selected => isSamePlayer(selected, player));

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
                {recentGroups.map((group) => (
                  <button
                    key={group.groupId}
                    className={`group-item${selectedGroupId === group.groupId ? ' selected' : ''}${group.players.every(isAlreadySelected) && selectedGroupId !== group.groupId ? ' all-already-added' : ''}`}
                    onClick={() => handleSelectGroup(group)}
                    title={t('selectRecentGroup.selectThisGroup', { defaultValue: 'Select this group' })}
                  >
                    <div className="group-header">
                      <div className="group-info">
                        <span className="group-date">
                          {t('selectRecentGroup.lastPlayed', {
                            defaultValue: 'Last played {{date}}',
                            date: group.date,
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="group-players">
                      {group.players.map((player, pidx) => (
                        <div
                          key={`player-${pidx}`}
                          className={`group-player ${isAlreadySelected(player) ? 'already-added' : ''}`}
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
