import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon, CheckMarkIcon } from '@/components/ui/Icon';
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

// Name of the game a group last played, for the card title
const getGameName = (game) => {
  if (game._type === 'wizard') return game.gameState?.templateName || game.templateName || 'Wizard';
  return game.gameTypeName || game.gameName || game.name || '';
};

const DAY_MS = 24 * 60 * 60 * 1000;

// "today", "yesterday", "3 days ago" - falls back to the date after a month
const formatLastPlayed = (date, language) => {
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS);
  if (days < 0 || days > 30) return date.toLocaleDateString(language);
  return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(-days, 'day');
};

const MAX_AVATARS = 4;

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
  const { t, i18n } = useTranslation();
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
            lastPlayedAt: getGameDate(game),
            gameName: getGameName(game),
            gamesPlayed: 1,
            playerCount: players.length,
            players,
          });
          return;
        }

        existing.gamesPlayed += 1;

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
          <h2>{t('selectRecentGroup.title', { defaultValue: 'Recent Play Groups' })}</h2>
          <button className="close-btn" onClick={handleClose} aria-label={t('common.close')}>
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
                {recentGroups.map((group) => {
                  const isSelected = selectedGroupId === group.groupId;
                  const allAdded = !isSelected && group.players.every(isAlreadySelected);
                  const extraPlayers = group.players.length - MAX_AVATARS;
                  return (
                    <button
                      key={group.groupId}
                      className={`group-item${isSelected ? ' selected' : ''}${allAdded ? ' all-already-added' : ''}`}
                      onClick={() => handleSelectGroup(group)}
                      title={t('selectRecentGroup.selectThisGroup', { defaultValue: 'Select this group' })}
                      aria-pressed={isSelected}
                    >
                      <div className="group-header">
                        <div className="group-avatars" aria-hidden="true">
                          {group.players.slice(0, MAX_AVATARS).map((player, pidx) => (
                            <span key={`avatar-${pidx}`} className="group-avatar">
                              {player.name.trim().charAt(0).toUpperCase()}
                            </span>
                          ))}
                          {extraPlayers > 0 && (
                            <span className="group-avatar group-avatar-more">+{extraPlayers}</span>
                          )}
                        </div>
                        <div className="group-info">
                          <span className="group-title">
                            {group.gameName || t('common.players')}
                          </span>
                          <span className="group-meta">
                            {formatLastPlayed(group.lastPlayedAt, i18n.language)}
                            {' · '}
                            {t('selectRecentGroup.gamesTogether', {
                              count: group.gamesPlayed,
                              defaultValue: '{{count}} games together',
                            })}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="group-check" aria-hidden="true">
                            <CheckMarkIcon size={16} />
                          </span>
                        )}
                      </div>
                      <div className="group-players">
                        {group.players.map((player, pidx) => (
                          <span
                            key={`player-${pidx}`}
                            className={`group-player${isAlreadySelected(player) ? ' already-added' : ''}`}
                          >
                            {player.name}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelectRecentGroupModal;
