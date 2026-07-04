import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/shared/hooks/useUser';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import Icon, { CheckMarkIcon, SearchIcon, XIcon } from '@/components/ui/Icon';
import GameHistoryItem from '@/components/game/GameHistoryItem';
import GameFilterModal from '@/components/modals/GameFilterModal';
import { getRecentLocalGames, getUserCloudGamesList, getRecentPublicGames, createGame } from '@/shared/api/gameService';
import { getUserCloudTableGamesList } from '@/shared/api/tableGameService';
import { LocalTableGameStorage } from '@/shared/api/localTableGameStorage';
import { LocalGameStorage } from '@/shared/api/localGameStorage';
import { LocalScoreboardGameStorage } from '@/shared/api/localScoreboardGameStorage';
import { filterGames, getDefaultFilters } from '@/shared/utils/gameFilters';
import { batchCheckGamesSyncStatus } from '@/shared/utils/syncChecker';
import '@/styles/pages/gamesPage.css';

// Custom icon for scoreboard games showing two team squares
const ScoreboardIcon = () => (
  <div className="mode-icon mode-icon-scoreboard">
    <span className="mode-tile mode-tile-team-a">A</span>
    <span className="mode-tile mode-tile-team-b">B</span>
  </div>
);

// Visual cue for call-and-made scoring: call first, then made result.
const CallAndMadeIcon = () => (
  <div className="mode-icon mode-icon-call-made">
    <span className="call-made-speaker-wrap" aria-hidden="true">
      <Icon name="Megaphone" size={40} strokeWidth={1.5} className="call-made-speaker-icon" />
      <span className="call-made-check">
        <CheckMarkIcon size={20} />
      </span>
    </span>
  </div>
);

// Visual cue for table score sheets.
const TableTemplateIcon = () => (
  <div className="mode-icon mode-icon-table-template">
    <div className="score-sheet-icon">
      <div className="score-sheet-row score-sheet-head">
        <span className="score-round-col">Rd</span>
        <span className="score-value-col">Pts</span>
      </div>
      <div className="score-sheet-row">
        <span className="score-round-col">1</span>
        <span className="score-value-col score-line" />
      </div>
      <div className="score-sheet-row">
        <span className="score-round-col">2</span>
        <span className="score-value-col score-line" />
      </div>
      <div className="score-sheet-row">
        <span className="score-round-col">3</span>
        <span className="score-value-col score-line" />
      </div>
    </div>
  </div>
);

const GamesPage = () => {
  const { t } = useTranslation();
  const { user } = useUser();
  const { isOnline } = useOnlineStatus();

  const [allGames, setAllGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState(getDefaultFilters());
  const [gameSyncStatuses, setGameSyncStatuses] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const filteredGames = useMemo(() => {
    let games = filterGames(allGames, filters);
    if (typeFilter !== 'all') {
      games = games.filter(game => game.gameType === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      games = games.filter(game => {
        const name = (game.name || game.gameType || '').toLowerCase();
        const players = (game.players || [])
          .map(p => typeof p === 'string' ? p : (p.name || '')).join(' ').toLowerCase();
        return name.includes(q) || players.includes(q);
      });
    }
    return games;
  }, [allGames, filters, searchQuery, typeFilter]);

  const handleApplyFilters = (newFilters) => setFilters(newFilters);

  const fetchLocalGames = async () => {
    try {
      const localGames = await getRecentLocalGames(100);
      const formattedLocalGames = Array.isArray(localGames) ? localGames.map(game => ({
        ...game,
        created_at: game.created_at || new Date().toISOString(),
        isLocal: true
      })) : [];

      const tableGames = LocalTableGameStorage.getSavedTableGamesList();
      const formattedTableGames = tableGames
        .filter(game => game.gameFinished)
        .map(game => {
          const fullGame = LocalTableGameStorage.getTableGameById(game.id);
          const gameData = fullGame?.gameData?.gameData || fullGame?.gameData || fullGame;
          const scoreEntryMode = gameData?.scoreEntryMode || game?.scoreEntryMode || null;
          const isScoreboardGame =
            scoreEntryMode === 'twoSideGesture'
            || game.id?.startsWith?.('scoreboard_game_')
            || game.gameTypeName === 'Volleyball'
            || game.name === 'Volleyball';

          let winnerName = 'Not determined';
          if (gameData?.players && Array.isArray(gameData.players)) {
            const playersWithScores = gameData.players.map(player => {
              const total = player.points?.reduce((sum, val) => sum + (Number.parseInt(val, 10) || 0), 0) || 0;
              return { ...player, total };
            });
            if (playersWithScores.length > 0) {
              const lowIsBetter = gameData.lowIsBetter || false;
              const winner = playersWithScores.reduce((best, current) => {
                if (!best) return current;
                return lowIsBetter ? (current.total < best.total ? current : best) : (current.total > best.total ? current : best);
              }, null);
              winnerName = winner?.name || 'Not determined';
            }
          }

          return {
            ...game,
            created_at: game.lastPlayed || game.savedAt || new Date().toISOString(),
            gameType: isScoreboardGame ? 'scoreboard' : 'table',
            scoreEntryMode,
            winner_name: winnerName,
            isUploaded: LocalTableGameStorage.isGameUploaded(game.id),
            isLocal: true
          };
        });

      const scoreboardGames = LocalScoreboardGameStorage.getSavedTableGamesList()
        .filter(game => game.gameFinished)
        .map(game => {
          const fullGame = LocalScoreboardGameStorage.getTableGameById(game.id);
          const gameData = fullGame?.gameData?.gameData || fullGame?.gameData || fullGame;
          const scoreEntryMode = gameData?.scoreEntryMode || game?.scoreEntryMode || 'twoSideGesture';
          let winnerName = 'Not determined';
          if (gameData?.players && Array.isArray(gameData.players)) {
            const playersWithScores = gameData.players.map(player => {
              const total = player.points?.reduce((sum, val) => sum + (Number.parseInt(val, 10) || 0), 0) || 0;
              return { ...player, total };
            });
            if (playersWithScores.length > 0) {
              const lowIsBetter = gameData.lowIsBetter || false;
              const winner = playersWithScores.reduce((best, current) => {
                if (!best) return current;
                return lowIsBetter ? (current.total < best.total ? current : best) : (current.total > best.total ? current : best);
              }, null);
              winnerName = winner?.name || 'Not determined';
            }
          }
          return {
            ...game,
            created_at: game.lastPlayed || game.savedAt || new Date().toISOString(),
            gameType: 'scoreboard',
            scoreEntryMode,
            winner_name: winnerName,
            isUploaded: LocalScoreboardGameStorage.isGameUploaded(game.id),
            isLocal: true,
            storageType: 'scoreboard'
          };
        });

      return [...formattedLocalGames, ...formattedTableGames, ...scoreboardGames].sort((a, b) =>
        new Date(b.created_at || b.lastPlayed || b.savedAt) - new Date(a.created_at || a.lastPlayed || a.savedAt)
      );
    } catch (error) {
      console.error('Error fetching local games:', error);
      return [];
    }
  };

  const fetchCloudGames = async () => {
    const [wizardGames, tableGames] = await Promise.all([
      getUserCloudGamesList(),
      getUserCloudTableGamesList()
    ]);

    const formattedWizardGames = wizardGames.map(game => ({
      id: game.cloudId,
      cloudId: game.cloudId,
      localId: game.localId,
      players: game.players,
      winner_id: game.winner_id,
      final_scores: game.final_scores,
      created_at: game.created_at,
      total_rounds: game.total_rounds,
      isPaused: game.isPaused,
      gameFinished: game.gameFinished,
      isUploaded: true,
      isCloud: true,
      gameType: 'wizard'
    }));

    const formattedTableGames = tableGames
      .filter(game => game.gameFinished)
      .map(game => {
        const rawGameDataOuter = game.rawData?.gameData;
        const rawGameData = rawGameDataOuter?.gameData || rawGameDataOuter;
        const scoreEntryMode = rawGameData?.scoreEntryMode || game.scoreEntryMode || null;
        const isScoreboardGame =
          scoreEntryMode === 'twoSideGesture'
          || game.cloudId?.startsWith?.('scoreboard_game_')
          || game.gameTypeName === 'Volleyball'
          || game.name === 'Volleyball';

        let winnerName = 'Not determined';
        if (game.players && Array.isArray(game.players)) {
          const playersWithScores = game.players.map(player => {
            const total = player.points?.reduce((sum, val) => sum + (Number.parseInt(val, 10) || 0), 0) || 0;
            return { ...player, total };
          });
          if (playersWithScores.length > 0) {
            const lowIsBetter = rawGameData?.lowIsBetter || false;
            const winner = playersWithScores.reduce((best, current) => {
              if (!best) return current;
              return lowIsBetter ? (current.total < best.total ? current : best) : (current.total > best.total ? current : best);
            }, null);
            winnerName = winner?.name || 'Not determined';
          }
        }

        return {
          id: game.cloudId,
          cloudId: game.cloudId,
          localId: game.localId,
          name: game.name || game.gameTypeName || 'Table Game',
          players: game.players?.map(p => p.name || p) || [],
          created_at: game.created_at,
          totalRounds: game.totalRounds,
          gameFinished: game.gameFinished,
          isUploaded: true,
          isCloud: true,
          gameType: isScoreboardGame ? 'scoreboard' : 'table',
          scoreEntryMode,
          gameData: rawGameData,
          winner_name: winnerName
        };
      });

    return [...formattedWizardGames, ...formattedTableGames].sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    );
  };

  useEffect(() => {
    const fetchGames = async () => {
      setLoading(true);
      try {
        if (user && isOnline) {
          try {
            const cloudGames = await fetchCloudGames();
            const localScoreboardGames = LocalScoreboardGameStorage.getSavedTableGamesList()
              .filter(game => game.gameFinished)
              .map(game => {
                const fullGame = LocalScoreboardGameStorage.getTableGameById(game.id);
                const gameData = fullGame?.gameData?.gameData || fullGame?.gameData || fullGame;
                const scoreEntryMode = gameData?.scoreEntryMode || game?.scoreEntryMode || 'twoSideGesture';
                let winnerName = 'Not determined';
                if (gameData?.players && Array.isArray(gameData.players)) {
                  const playersWithScores = gameData.players.map(player => {
                    const total = player.points?.reduce((sum, val) => sum + (Number.parseInt(val, 10) || 0), 0) || 0;
                    return { ...player, total };
                  });
                  if (playersWithScores.length > 0) {
                    const lowIsBetter = gameData.lowIsBetter || false;
                    const winner = playersWithScores.reduce((best, current) => {
                      if (!best) return current;
                      return lowIsBetter ? (current.total < best.total ? current : best) : (current.total > best.total ? current : best);
                    }, null);
                    winnerName = winner?.name || 'Not determined';
                  }
                }
                return {
                  ...game,
                  created_at: game.lastPlayed || game.savedAt || new Date().toISOString(),
                  gameType: 'scoreboard',
                  scoreEntryMode,
                  winner_name: winnerName,
                  isUploaded: LocalScoreboardGameStorage.isGameUploaded(game.id),
                  isLocal: true,
                  storageType: 'scoreboard'
                };
              });

            // Also collect local wizard + table games that aren't yet in the cloud list
            const allLocalGames = await fetchLocalGames();

            // Helper: check if a local game is already represented in the cloud list
            const isAlreadyInCloud = (localGame) =>
              cloudGames.some((cloudGame) =>
                cloudGame.id === localGame.id
                || cloudGame.cloudId === localGame.id
                || cloudGame.localId === localGame.id
                || (localGame.cloudId && (cloudGame.id === localGame.cloudId || cloudGame.cloudId === localGame.cloudId))
              );

            const mergedGames = [...cloudGames];

            // Merge local wizard/table games not yet uploaded
            allLocalGames.forEach((localGame) => {
              if (!isAlreadyInCloud(localGame)) mergedGames.push(localGame);
            });

            // Merge local scoreboard games (different storage)
            localScoreboardGames.forEach((localGame) => {
              if (!isAlreadyInCloud(localGame)) mergedGames.push(localGame);
            });

            mergedGames.sort((a, b) =>
              new Date(b.created_at || b.lastPlayed || b.savedAt) - new Date(a.created_at || a.lastPlayed || a.savedAt)
            );
            setAllGames(mergedGames);
            setGameSyncStatuses({});
          } catch (error) {
            console.debug('Failed to fetch cloud games, falling back to local:', error.message);
            const localGames = await fetchLocalGames();
            setAllGames(localGames);
            if (localGames.length > 0) {
              try {
                const wizardGameIds = localGames.filter(game => game.gameType !== 'table' && game.id).map(game => game.id);
                if (wizardGameIds.length > 0) {
                  const syncStatuses = await batchCheckGamesSyncStatus(wizardGameIds);
                  setGameSyncStatuses(syncStatuses);
                }
              } catch (syncError) {
                console.debug('Error batch checking sync status:', syncError.message);
              }
            }
          }
        } else if (isOnline) {
          try {
            const [publicGames, localGames] = await Promise.all([
              getRecentPublicGames(100).catch(() => []),
              fetchLocalGames()
            ]);
            const formattedPublicGames = publicGames.map(game => ({ ...game, isCloud: true, isUploaded: true }));
            // Always show local games first, then non-duplicate public games
            const merged = [...localGames];
            formattedPublicGames.forEach(pg => {
              if (!merged.some(lg => lg.id === pg.id)) {
                merged.push(pg);
              }
            });
            setAllGames(merged.sort((a, b) =>
              new Date(b.created_at || b.lastPlayed || b.savedAt) - new Date(a.created_at || a.lastPlayed || a.savedAt)
            ));
          } catch (error) {
            console.debug('Failed to fetch games for unauthenticated user, falling back to local:', error.message);
            const localGames = await fetchLocalGames();
            setAllGames(localGames);
          }
        } else {
          const localGames = await fetchLocalGames();
          setAllGames(localGames);
        }
      } catch (error) {
        console.error('Error fetching games:', error);
        setAllGames([]);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, [user, isOnline]);

  // Auto-upload local games (all types) scored while not logged in
  useEffect(() => {
    if (!user || !isOnline) return;

    const uploadPendingGames = async () => {
      try {
        const { createTableGame } = await import('@/shared/api/tableGameService');

        // Wizard games
        const localGames = LocalGameStorage.getAllSavedGames();
        const unsyncedWizard = Object.entries(localGames).filter(([, game]) =>
          game.gameFinished && !game.isUploaded && !game.isImported && !game.isShared && !game.originalGameId
        );
        for (let i = 0; i < unsyncedWizard.length; i++) {
          const [gameId, gameData] = unsyncedWizard[i];
          try {
            if (i > 0) await new Promise(resolve => setTimeout(resolve, 300));
            const result = await createGame(gameData, gameId);
            if (result?.game?.id) LocalGameStorage.markGameAsUploaded(gameId, result.game.id);
          } catch { /* silent fail */ }
        }

        // Table games
        const allTableGames = LocalTableGameStorage.getAllSavedTableGamesAllUsers();
        const unsyncedTable = Object.entries(allTableGames).filter(([, game]) =>
          game.gameFinished && !game.isUploaded
        );
        for (let i = 0; i < unsyncedTable.length; i++) {
          const [gameId, record] = unsyncedTable[i];
          try {
            if (i > 0) await new Promise(resolve => setTimeout(resolve, 300));
            const gameData = record.gameData?.gameData || record.gameData || record;
            const result = await createTableGame(gameData, gameId);
            if (result?.game?._id) LocalTableGameStorage.markGameAsUploaded(gameId, result.game._id);
          } catch { /* silent fail */ }
        }

        // Scoreboard games
        const allScoreboardGames = LocalScoreboardGameStorage.getAllSavedTableGamesAllUsers();
        const unsyncedScoreboard = Object.entries(allScoreboardGames).filter(([, game]) =>
          game.gameFinished && !game.isUploaded
        );
        for (let i = 0; i < unsyncedScoreboard.length; i++) {
          const [gameId, record] = unsyncedScoreboard[i];
          try {
            if (i > 0) await new Promise(resolve => setTimeout(resolve, 300));
            const gameData = record.gameData?.gameData || record.gameData || record;
            const result = await createTableGame(gameData, gameId);
            if (result?.game?._id) LocalScoreboardGameStorage.markGameAsUploaded(gameId, result.game._id);
          } catch { /* silent fail */ }
        }
      } catch { /* silent fail */ }
    };

    const timer = setTimeout(uploadPendingGames, 1500);
    return () => clearTimeout(timer);
  }, [user, isOnline]);

  const links = [
    { to: '/start?type=scoreboard', label: t('gamesPage.scoreboardGames'), icon: 'Target'      },
    { to: '/start?type=call-made',  label: t('gamesPage.callAndMadeGames'),  icon: 'Wand2'       },
    { to: '/start?type=table',      label: t('gamesPage.tableGames'),         icon: 'Dices'       },
    { to: '/leaderboard',           label: t('nav.leaderboard'),              icon: 'Trophy'      },
    { to: '/friend-leaderboard',    label: t('nav.friendCompareShort'),       icon: 'Swords'      },
  ];

  if (user?.role === 'admin') {
    links.push({ to: '/admin', label: t('nav.adminPanel'), icon: 'ShieldCheck' });
  }

  return (
    <div className="games-page">

      <div className="games-link-grid">
        {links.map((item) => (
          <Link key={item.to} to={item.to} className="games-link-card">
            <div className="games-link-icon-wrap" aria-hidden="true">
              <Icon name={item.icon} size={28} strokeWidth={1.5} />
            </div>
            <span className="games-link-label">{item.label}</span>
          </Link>
        ))}
      </div>

      <section className="games-history-section">

        <div className="games-filter-bar">
          <div className="games-search-row">
            <div className="games-search-wrapper">
              <SearchIcon size={16} className="games-search-icon" />
              <input
                type="text"
                className="games-search-input"
                placeholder={t('account.searchGames')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="games-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>
            <select
              className="games-type-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">{t('common.all')}</option>
              <option value="wizard">Wizard</option>
              <option value="table">{t('gamesPage.tableGames')}</option>
              <option value="scoreboard">{t('gamesPage.scoreboardGames')}</option>
            </select>
          </div>
        </div>

        <div className="games-list-header">
          <span className="games-list-count">
            {t('account.gamesCount', { count: filteredGames.length })}
          </span>
        </div>

        {filteredGames.length > 0 ? (
          <div className="game-history">
            {filteredGames.map(game => (
              <GameHistoryItem
                key={game.id}
                game={{
                  ...game,
                  isUploaded: game.gameType === 'table'
                    ? game.isUploaded
                    : gameSyncStatuses[game.id]?.synced || game.isUploaded
                }}
              />
            ))}
          </div>
        ) : loading ? (
          <div className="loading-message">{t('home.loadingGames')}</div>
        ) : (
          <div className="empty-message">
            {allGames.length > 0 ? t('home.noGamesMatchFilters') : t('home.noGamesFound')}
          </div>
        )}
      </section>

      <GameFilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApplyFilters={handleApplyFilters}
        initialFilters={filters}
      />
    </div>
  );
};

export default GamesPage;
