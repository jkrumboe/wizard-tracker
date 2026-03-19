import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LocalGameStorage } from '@/shared/api/localGameStorage';
import { UsersIcon, PlayIcon, TrophyIcon } from '@/components/ui/Icon';
import SwipeableGameCard from '@/components/common/SwipeableGameCard';
import GameHistoryModal from '@/components/modals/GameHistoryModal';

const WizardGameHistoryModal = ({
  isOpen,
  onClose,
  onSelectGame,
  onDeleteGame,
  initialStatusFilter = 'all'
}) => {
  const { t } = useTranslation();
  const [games, setGames] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  const loadGames = useCallback(() => {
    setLoading(true);
    try {
      const allGames = LocalGameStorage.getAllSavedGames();

      const gamesList = Object.entries(allGames).map(([id, game]) => {
        const gameState = game.gameState || {};
        const stableDateSource =
          game.created_at ||
          game.referenceDate ||
          game._internalState?.referenceDate ||
          game.savedAt ||
          game.saved_at ||
          game.lastPlayed;
        const date = new Date(stableDateSource || Date.now());

        // Handle nested gameState structure
        const players = game.players || gameState.players || [];
        const isPaused = game.isPaused || gameState.isPaused || false;
        const currentRound = game.currentRound || gameState.currentRound || game._internalState?.currentRound || 0;
        const maxRounds =
          game.total_rounds ||
          game.maxRounds ||
          gameState.maxRounds ||
          game.totalRounds ||
          game.round_data?.length ||
          gameState.round_data?.length ||
          0;

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
          created_at: game.created_at || game.referenceDate || game.savedAt,
          lastPlayed: game.lastPlayed || game.saved_at || game.savedAt,
          eloChange: game.eloChange ?? game.elo_change ?? null,
          eloRating: game.eloRating ?? game.elo_rating ?? null,
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
        const dateA = new Date(a.created_at || a.lastPlayed || 0);
        const dateB = new Date(b.created_at || b.lastPlayed || 0);
        return dateB - dateA;
      });

      setGames(gamesList);
    } catch (error) {
      console.error('Error loading games:', error);
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadGames();
      setSearchTerm('');
      setStatusFilter(initialStatusFilter);
    }
  }, [isOpen, loadGames, initialStatusFilter]);

  const handleSearchChange = (value) => {
    setSearchTerm(value);
  };

  const handleStatusFilterChange = (nextFilter) => {
    setStatusFilter(prev => (prev === nextFilter ? 'all' : nextFilter));
  };

  const filteredGames = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase();

    return games.filter((game) => {
      const searchMatch =
        searchTerm === '' ||
        game.name?.toLowerCase().includes(normalizedSearch) ||
        game.players?.some((p) => {
          const playerName = typeof p === 'string' ? p : p.name;
          return playerName?.toLowerCase().includes(normalizedSearch);
        });

      const statusMatch =
        statusFilter === 'all' ||
        (statusFilter === 'paused' && game.isPaused) ||
        (statusFilter === 'finished' && !game.isPaused);

      return searchMatch && statusMatch;
    });
  }, [games, searchTerm, statusFilter]);

  const handleSelectGame = (game) => {
    const shouldClose = onSelectGame?.(game);
    if (shouldClose !== false) {
      onClose();
    }
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

  const pausedCount = games.filter(g => g.isPaused).length;
  const finishedCount = games.filter(g => !g.isPaused).length;
  const emptyTitle = searchTerm
    ? t('gameHistory.noMatches')
    : statusFilter === 'paused'
      ? t('gameHistory.noPausedGames')
      : statusFilter === 'finished'
        ? t('gameHistory.noFinishedGames')
        : t('gameHistory.noGames');

  const renderGameCard = (game) => {
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
                {game.eloChange !== null && (
                  <span className={`mode-badge ${game.eloChange >= 0 ? 'elo-positive' : 'elo-negative'}`}>
                    {game.eloChange >= 0 ? '+' : ''}{Math.round(game.eloChange)} ELO
                  </span>
                )}
                {game.eloRating !== null && (
                  <span className="mode-badge table">
                    {Math.round(game.eloRating)}
                  </span>
                )}
                <span className={`mode-badge ${game.isPaused ? 'paused' : 'finished'}`}>
                  {game.isPaused ? t('gameHistory.paused') : t('gameHistory.finished')}
                </span>
              </div>
            </div>
            <div className="game-players">
              <UsersIcon size={12} />{' '}
              {playerList.join(', ') || t('common.noPlayers')}
            </div>
            <div className="actions-game-history">
              <div className="bottom-actions-game-history">
                <div className="game-rounds">
                  {t('common.rounds')}: {game.isPaused
                    ? `${game.currentRound || 0} / ${game.maxRounds || 0}`
                    : game.maxRounds || game.currentRound || 0}
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
      title={t('gameHistory.title')}
      searchPlaceholder={t('gameHistory.searchPlaceholder')}
      searchTerm={searchTerm}
      onSearchChange={handleSearchChange}
      loading={loading}
      loadingText={t('common.loading')}
      games={games}
      filteredGames={filteredGames}
      pausedCount={pausedCount}
      finishedCount={finishedCount}
      pausedLabel={t('gameHistory.pausedGames')}
      finishedLabel={t('gameHistory.finishedGames')}
      statusFilter={statusFilter}
      onStatusFilterChange={handleStatusFilterChange}
      emptyTitle={emptyTitle}
      emptySubtitle={searchTerm ? t('gameHistory.tryDifferentSearch') : undefined}
      renderGameCard={renderGameCard}
    />
  );
};

export default WizardGameHistoryModal;
