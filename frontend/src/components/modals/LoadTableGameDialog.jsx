import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UsersIcon, PlayIcon, TrophyIcon } from '@/components/ui/Icon';
import { LocalTableGameStorage } from '@/shared/api';
import { LocalScoreboardGameStorage } from '@/shared/api';
import SwipeableGameCard from '@/components/common/SwipeableGameCard';
import GameHistoryModal from '@/components/modals/GameHistoryModal';

const LoadTableGameDialog = ({
  isOpen,
  onClose,
  onLoadGame,
  onDeleteGame,
  filterByGameName = null, // Optional filter by game name/type
  storageType = 'table',
  initialStatusFilter = 'all'
}) => {
  const { t } = useTranslation();
  const [savedGames, setSavedGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const activeStorage = storageType === 'scoreboard' ? LocalScoreboardGameStorage : LocalTableGameStorage;
  const isGameFinished = (game) => Boolean(game?.gameFinished || game?.gameData?.gameFinished);
  const isScoreboardGame = (game) => (
    storageType === 'scoreboard'
    || game?.gameType === 'scoreboard'
    || game?.scoreEntryMode === 'twoSideGesture'
    || game?.gameData?.scoreEntryMode === 'twoSideGesture'
  );

  useEffect(() => {
    const loadSavedGames = async () => {
      setLoading(true);
      try {
        let games = activeStorage.getSavedTableGamesList();

        // Filter by game name if provided
        if (filterByGameName) {
          games = games.filter(game => game.name === filterByGameName);
        }

        // Add display date to games
        games = games.map(game => ({
          ...game,
          displayDate: new Date(game.lastPlayed || game.createdAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          }),
          displayTime: new Date(game.lastPlayed || game.createdAt).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })
        }));

        // Sort by most recent first
        games.sort((a, b) => {
          const dateA = new Date(b.lastPlayed || b.createdAt);
          const dateB = new Date(a.lastPlayed || a.createdAt);
          return dateA - dateB;
        });

        setSavedGames(games);
      } catch (error) {
        console.error('Error loading saved table games:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      setSearchTerm('');
      setStatusFilter(initialStatusFilter);
      loadSavedGames();
    }
  }, [isOpen, filterByGameName, initialStatusFilter, activeStorage]);

  const handleLoadGame = async (gameId) => {
    setLoading(true);
    try {
      // Get the full saved game object first to get the name
      const games = activeStorage.getAllSavedTableGames();
      const savedGame = games[gameId];

      if (savedGame) {
        const gameData = activeStorage.loadTableGame(gameId);
        if (gameData) {
          // Pass gameData with metadata from the saved game object
          // The gameFinished flag can be in either gameData or the savedGame object
          onLoadGame({
            ...gameData,
            gameName: savedGame.name,
            gameId: gameId,
            gameFinished: savedGame.gameFinished || gameData.gameFinished || false
          });
          onClose();
        }
      }
    } catch (error) {
      console.error('Error loading table game:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGame = async (gameId, gameName) => {
    if (globalThis.confirm(t('loadTableGame.deleteConfirm', { name: gameName }))) {
      try {
        activeStorage.deleteTableGame(gameId);
        // Refresh the list with the current filter
        let games = activeStorage.getSavedTableGamesList();

        // Re-apply filter if it exists
        if (filterByGameName) {
          games = games.filter(game => game.name === filterByGameName);
        }

        // Add display date to games
        games = games.map(game => ({
          ...game,
          displayDate: new Date(game.lastPlayed || game.createdAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          }),
          displayTime: new Date(game.lastPlayed || game.createdAt).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })
        }));

        setSavedGames(games);
        if (onDeleteGame) {
          onDeleteGame(gameId);
        }
      } catch (error) {
        console.error('Error deleting table game:', error);
      }
    }
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);
  };

  const handleStatusFilterChange = (nextFilter) => {
    setStatusFilter(prev => (prev === nextFilter ? 'all' : nextFilter));
  };

  const filteredGames = useMemo(() => {
    return savedGames.filter(game => {
      const normalizedSearch = searchTerm.toLowerCase();
      const searchMatch =
        searchTerm === '' ||
        game.name?.toLowerCase().includes(normalizedSearch) ||
        game.players?.some(p => p.toLowerCase().includes(normalizedSearch));

      const statusMatch =
        statusFilter === 'all' ||
        (statusFilter === 'paused' && !isGameFinished(game)) ||
        (statusFilter === 'finished' && isGameFinished(game));

      return searchMatch && statusMatch;
    });
  }, [savedGames, searchTerm, statusFilter]);

  const finishedCount = savedGames.filter((g) => isGameFinished(g)).length;
  const pausedCount = savedGames.filter((g) => !isGameFinished(g)).length;

  const emptyTitle = searchTerm
    ? t('loadTableGame.noMatches')
    : statusFilter === 'paused'
      ? t('loadTableGame.noPausedGames')
      : statusFilter === 'finished'
        ? t('loadTableGame.noFinishedGames')
        : t('loadTableGame.noSavedGames');

  const renderGameCard = (game) => {
              // Determine winner or current leader (only show if there's a single definite leader)
              let tableLeader = null;
              let isTied = false;
              if (game.gameFinished && game.winner_name) {
                tableLeader = game.winner_name;
              } else if (game.gameData?.players?.length > 0) {
                const scored = game.gameData.players.map(p => ({
                  name: p.name,
                  total: (p.points || []).reduce((s, v) => s + (parseInt(v, 10) || 0), 0)
                }));
                if (scored.some(p => p.total !== 0)) {
                  const sorted = [...scored].sort((a, b) =>
                    game.lowIsBetter ? a.total - b.total : b.total - a.total
                  );
                  if (sorted.length >= 2 && sorted[0].total === sorted[1].total) {
                    isTied = true;
                  } else {
                    tableLeader = sorted[0].name;
                  }
                }
              }

    return (
      <SwipeableGameCard
        key={game.id}
        onDelete={onDeleteGame ? () => handleDeleteGame(game.id, game.name) : undefined}
        onViewDetails={() => handleLoadGame(game.id)}
        viewDetailsLabel={!isGameFinished(game) ? t('loadTableGame.resumeGame') : undefined}
        viewDetailsIcon={!isGameFinished(game) ? <PlayIcon size={16} /> : undefined}
        showViewDetails
        showDelete={!!onDeleteGame}
      >
        <div className="game-card">
          <div className="settings-card-header">
            <div className="game-info">
              <div className="game-winner">
                {tableLeader ? (
                  <><TrophyIcon size={12} /> {tableLeader}</>
                ) : isTied ? (
                  <><TrophyIcon size={12} /> {t('gameHistory.tied')}</>
                ) : (
                  <><UsersIcon size={12} /> {game.players?.length || 0} {t('common.players')}</>
                )}
              </div>
              <div className="game-badges">
                <span className={`mode-badge ${isGameFinished(game) ? 'finished' : 'paused'}`}>
                  {isGameFinished(game) ? t('loadTableGame.finished') : t('loadTableGame.paused')}
                </span>
              </div>
            </div>
            <div className="game-players">
              <UsersIcon size={12} />{' '}
              {game.players?.join(', ') || t('common.noPlayers')}
            </div>
            <div className="actions-game-history">
              <div className="bottom-actions-game-history">
                <div className="game-rounds">
                  {isScoreboardGame(game) ? t('common.sets') : t('common.rounds')}: {game.totalRounds || 0}
                </div>
                <div className="game-date">{game.displayDate}</div>
              </div>
            </div>
          </div>
        </div>
      </SwipeableGameCard>
    );
  };

  return (
    <GameHistoryModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('loadTableGame.tableGames')}
      searchPlaceholder={t('loadTableGame.searchPlaceholder')}
      searchTerm={searchTerm}
      onSearchChange={handleSearchChange}
      loading={loading}
      loadingText={t('loadTableGame.loadingSavedGames')}
      games={savedGames}
      filteredGames={filteredGames}
      pausedCount={pausedCount}
      finishedCount={finishedCount}
      pausedLabel={t('loadTableGame.pausedGames')}
      finishedLabel={t('loadTableGame.finishedGames')}
      statusFilter={statusFilter}
      onStatusFilterChange={handleStatusFilterChange}
      emptyTitle={emptyTitle}
      emptySubtitle={searchTerm ? t('loadTableGame.tryDifferentSearch') : undefined}
      renderGameCard={renderGameCard}
    />
  );
};

export default LoadTableGameDialog;
