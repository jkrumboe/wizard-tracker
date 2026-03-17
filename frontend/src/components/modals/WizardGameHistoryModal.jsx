import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LocalGameStorage } from '@/shared/api/localGameStorage';
import { XIcon, UsersIcon, PlayIcon, TrophyIcon } from '@/components/ui/Icon';
import SwipeableGameCard from '@/components/common/SwipeableGameCard';
import '@/styles/modals/wizardGameHistoryModal.css';

const WizardGameHistoryModal = ({ isOpen, onClose, onSelectGame, onDeleteGame }) => {
  const { t } = useTranslation();
  const [games, setGames] = useState([]);
  const [filteredGames, setFilteredGames] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const loadGames = () => {
    setLoading(true);
    try {
      const allGames = LocalGameStorage.getAllSavedGames();

      const gamesList = Object.entries(allGames).map(([id, game]) => {
        const date = new Date(game.lastPlayed || game.saved_at || game.created_at);

        // Handle nested gameState structure
        const gameState = game.gameState || {};
        const players = game.players || gameState.players || [];
        const isPaused = game.isPaused || gameState.isPaused || false;
        const currentRound = game.currentRound || gameState.currentRound || 0;
        const maxRounds = game.maxRounds || gameState.maxRounds || game.totalRounds || 0;

        return {
          id,
          name: game.name || `Game ${date.toLocaleDateString()}`,
          players: Array.isArray(players) ? players : [],
          isPaused: isPaused && !game.gameFinished && !gameState.gameFinished,
          currentRound,
          maxRounds,
          gameFinished: game.gameFinished || gameState.gameFinished || false,
          winner_id: game.winner_id || gameState.winner_id || [],
          final_scores: game.final_scores || gameState.final_scores || {},
          created_at: game.created_at || game.savedAt,
          lastPlayed: game.lastPlayed || game.saved_at || game.created_at,
          displayDate: date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          }),
          displayTime: date.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })
        };
      });

      // Sort by date (newest first)
      gamesList.sort((a, b) => {
        const dateA = new Date(b.lastPlayed || b.created_at);
        const dateB = new Date(a.lastPlayed || a.created_at);
        return dateA - dateB;
      });

      setGames(gamesList);
      filterGames(gamesList, searchTerm);
    } catch (error) {
      console.error('Error loading games:', error);
      setGames([]);
      setFilteredGames([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadGames();
    }
  }, [isOpen, loadGames]);

  const filterGames = (gamesList, search) => {
    let filtered = gamesList.filter(game => {
      const searchMatch = search === '' ||
        (game.name && game.name.toLowerCase().includes(search.toLowerCase())) ||
        (game.players && game.players.some(p => {
          const playerName = typeof p === 'string' ? p : p.name;
          return playerName?.toLowerCase().includes(search.toLowerCase());
        }));

      return searchMatch;
    });

    setFilteredGames(filtered);
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    filterGames(games, value);
  };

  const handleSelectGame = (game) => {
    onSelectGame?.(game);
    onClose();
  };

  const handleDeleteGame = (gameId, gameName) => {
    if (globalThis.confirm(t('gameHistory.deleteConfirm', { name: gameName || 'Game' }))) {
      try {
        LocalGameStorage.deleteGame(gameId);
        // Refresh games list
        loadGames();
        if (onDeleteGame) {
          onDeleteGame(gameId);
        }
      } catch (error) {
        console.error('Error deleting game:', error);
      }
    }
  };

  if (!isOpen) return null;

  const pausedCount = games.filter(g => g.isPaused).length;
  const finishedCount = games.filter(g => !g.isPaused).length;
  const totalCount = games.length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="wizard-game-history-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-content">
            <h2>{t('gameHistory.title')}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <XIcon size={24} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="modal-search">
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder={t('gameHistory.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button className="search-clear-btn" onClick={() => handleSearchChange('')} aria-label="Clear search">
                <XIcon size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        {totalCount > 0 && (
          <div className="modal-stats">
            <div className="stat-item paused">
              <span className="stat-badge"></span>
              <span>{pausedCount} {t('gameHistory.pausedGames')}</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item finished">
              <span className="stat-badge"></span>
              <span>{finishedCount} {t('gameHistory.finishedGames')}</span>
            </div>
          </div>
        )}

        {/* Games List */}
        <div className="games-list">
          {loading ? (
            <div className="empty-state">
              <div className="loading-spinner"></div>
              <p>{t('common.loading')}</p>
            </div>
          ) : filteredGames.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">
                {searchTerm ? t('gameHistory.noMatches') : t('gameHistory.noGames')}
              </p>
              {searchTerm && (
                <p className="empty-subtitle">{t('gameHistory.tryDifferentSearch')}</p>
              )}
            </div>
          ) : (
            filteredGames.map((game) => {
              const playerList = Array.isArray(game.players)
                ? game.players.map(p => typeof p === 'string' ? p : p.name || 'Unknown')
                : [];

              // Determine winner or current leader (only show if there's a single definite leader)
              let leaderName = null;
              let isTied = false;
              const winnerIds = Array.isArray(game.winner_id) ? game.winner_id : (game.winner_id ? [game.winner_id] : []);
              if (game.gameFinished && winnerIds.length === 1) {
                const p = game.players.find(pl => (pl.id || pl) === winnerIds[0]);
                leaderName = typeof p === 'string' ? p : p?.name;
              } else if (game.gameFinished && winnerIds.length > 1) {
                isTied = true;
              }
              if (!leaderName && !isTied && game.final_scores && Object.keys(game.final_scores).length > 0) {
                const entries = Object.entries(game.final_scores);
                const sorted = entries.sort((a, b) => b[1] - a[1]);
                if (sorted.length >= 2 && sorted[0][1] === sorted[1][1]) {
                  isTied = true;
                } else if (sorted.length > 0) {
                  const p = game.players.find(pl => (pl.id || pl) === sorted[0][0]);
                  leaderName = typeof p === 'string' ? p : p?.name;
                }
              }

              return (
                <SwipeableGameCard
                  key={game.id}
                  onDelete={() => handleDeleteGame(game.id, game.name)}
                  onViewDetails={() => handleSelectGame(game)}
                  viewDetailsLabel={game.isPaused ? t('gameHistory.continueGame') : undefined}
                  viewDetailsIcon={game.isPaused ? <PlayIcon size={16} /> : undefined}
                  showViewDetails
                  showDelete
                >
                  <div className="game-card">
                    <div className="settings-card-header">
                      <div className="game-info">
                        <div className="game-winner">
                          {leaderName ? (
                            <><TrophyIcon size={12} /> {leaderName}</>
                          ) : isTied ? (
                            <><TrophyIcon size={12} /> {t('gameHistory.tied')}</>
                          ) : (
                            <><UsersIcon size={12} /> {playerList.length} {t('common.players')}</>
                          )}
                          {game.isPaused ? ' | ' + t('gameHistory.paused') : ''}
                        </div>
                        <div className="game-badges">
                          <span className={`mode-badge ${game.isPaused ? 'paused' : 'finished'}`}>
                            {game.isPaused ? t('gameHistory.paused') : t('gameHistory.finished')}
                          </span>
                        </div>
                      </div>
                      <div className="game-players">
                        <UsersIcon size={12} />{" "}
                        {playerList.join(', ') || t('common.noPlayers')}
                      </div>
                      <div className="actions-game-history">
                        <div className="bottom-actions-game-history">
                          <div className="game-rounds">
                            {t('common.rounds')}: {game.isPaused && game.currentRound
                              ? `${game.currentRound} / ${game.maxRounds}`
                              : game.maxRounds || 0}
                          </div>
                          <div className="game-date">{game.displayDate}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </SwipeableGameCard>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default WizardGameHistoryModal;
