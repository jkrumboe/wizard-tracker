import { useState, useEffect } from 'react';
import { useUser } from '@/shared/hooks/useUser';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { getRecentLocalGames, getUserCloudGamesList, getRecentPublicGames } from '@/shared/api/gameService';
import { getUserCloudTableGamesList } from '@/shared/api/tableGameService';
import { LocalTableGameStorage } from '@/shared/api/localTableGameStorage';
import { LocalScoreboardGameStorage } from '@/shared/api/localScoreboardGameStorage';
import { dedupeGames } from '@/shared/utils/gameDedup';
import { batchCheckGamesSyncStatus } from '@/shared/utils/syncChecker';

const byNewest = (a, b) =>
  new Date(b.created_at || b.lastPlayed || b.savedAt) - new Date(a.created_at || a.lastPlayed || a.savedAt);

// Highest (or lowest, when lowIsBetter) total wins
const getWinnerName = (players, lowIsBetter) => {
  if (!Array.isArray(players) || players.length === 0) return 'Not determined';
  const winner = players
    .map(player => ({
      ...player,
      total: player.points?.reduce((sum, val) => sum + (Number.parseInt(val, 10) || 0), 0) || 0,
    }))
    .reduce((best, current) => {
      if (!best) return current;
      return lowIsBetter ? (current.total < best.total ? current : best) : (current.total > best.total ? current : best);
    }, null);
  return winner?.name || 'Not determined';
};

async function fetchLocalGames() {
  try {
    const localGames = await getRecentLocalGames(100);
    const formattedLocalGames = Array.isArray(localGames) ? localGames.map(game => ({
      ...game,
      created_at: game.created_at || new Date().toISOString(),
      isLocal: true
    })) : [];

    const formattedTableGames = LocalTableGameStorage.getSavedTableGamesList()
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

        return {
          ...game,
          created_at: game.lastPlayed || game.savedAt || new Date().toISOString(),
          gameType: isScoreboardGame ? 'scoreboard' : 'table',
          scoreEntryMode,
          winner_name: getWinnerName(gameData?.players, gameData?.lowIsBetter || false),
          isUploaded: LocalTableGameStorage.isGameUploaded(game.id),
          isLocal: true
        };
      });

    const scoreboardGames = LocalScoreboardGameStorage.getSavedTableGamesList()
      .filter(game => game.gameFinished)
      .map(game => {
        const fullGame = LocalScoreboardGameStorage.getTableGameById(game.id);
        const gameData = fullGame?.gameData?.gameData || fullGame?.gameData || fullGame;
        return {
          ...game,
          created_at: game.lastPlayed || game.savedAt || new Date().toISOString(),
          gameType: 'scoreboard',
          scoreEntryMode: gameData?.scoreEntryMode || game?.scoreEntryMode || 'twoSideGesture',
          winner_name: getWinnerName(gameData?.players, gameData?.lowIsBetter || false),
          isUploaded: LocalScoreboardGameStorage.isGameUploaded(game.id),
          isLocal: true,
          storageType: 'scoreboard'
        };
      });

    return dedupeGames([...formattedLocalGames, ...formattedTableGames, ...scoreboardGames]).sort(byNewest);
  } catch (error) {
    console.error('Error fetching local games:', error);
    return [];
  }
}

async function fetchCloudGames() {
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
        winner_name: getWinnerName(game.players, rawGameData?.lowIsBetter || false)
      };
    });

  return [...formattedWizardGames, ...formattedTableGames].sort(byNewest);
}

/**
 * Finished games of every type: the user's cloud games merged with local ones
 * when logged in, public + local games when logged out, local games offline.
 * @returns {{ games: Array, loading: boolean, syncStatuses: Object }}
 */
export function useGameHistory() {
  const { user } = useUser();
  const { isOnline } = useOnlineStatus();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncStatuses, setSyncStatuses] = useState({});

  useEffect(() => {
    let cancelled = false;

    const fetchGames = async () => {
      setLoading(true);
      try {
        if (user && isOnline) {
          try {
            const cloudGames = await fetchCloudGames();
            const allLocalGames = await fetchLocalGames();
            // Cloud entries come first so the cloud id stays the one used for navigation;
            // local copies of the same game are folded into them by dedupeGames().
            const mergedGames = dedupeGames([...cloudGames, ...allLocalGames]).sort(byNewest);
            if (cancelled) return;
            setGames(mergedGames);
            setSyncStatuses({});
          } catch (error) {
            console.debug('Failed to fetch cloud games, falling back to local:', error.message);
            const localGames = await fetchLocalGames();
            if (cancelled) return;
            setGames(localGames);
            try {
              const wizardGameIds = localGames.filter(game => game.gameType !== 'table' && game.id).map(game => game.id);
              if (wizardGameIds.length > 0) {
                const statuses = await batchCheckGamesSyncStatus(wizardGameIds);
                if (!cancelled) setSyncStatuses(statuses);
              }
            } catch (syncError) {
              console.debug('Error batch checking sync status:', syncError.message);
            }
          }
        } else if (isOnline) {
          try {
            const [publicGames, localGames] = await Promise.all([
              getRecentPublicGames(100).catch(() => []),
              fetchLocalGames()
            ]);
            const formattedPublicGames = publicGames.map(game => ({ ...game, isCloud: true, isUploaded: true }));
            // Local games first so their local id stays usable offline, public copies fold into them
            const merged = dedupeGames([...localGames, ...formattedPublicGames]).sort(byNewest);
            if (!cancelled) setGames(merged);
          } catch (error) {
            console.debug('Failed to fetch games for unauthenticated user, falling back to local:', error.message);
            const localGames = await fetchLocalGames();
            if (!cancelled) setGames(localGames);
          }
        } else {
          const localGames = await fetchLocalGames();
          if (!cancelled) setGames(localGames);
        }
      } catch (error) {
        console.error('Error fetching games:', error);
        if (!cancelled) setGames([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchGames();
    return () => { cancelled = true; };
  }, [user, isOnline]);

  return { games, loading, syncStatuses };
}
