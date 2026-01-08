import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import GameHistoryItem from '@/components/game/GameHistoryItem'
import LoadGameDialog from '@/components/modals/LoadGameDialog'
import GameFilterModal from '@/components/modals/GameFilterModal'
import FriendsModal from '@/components/modals/FriendsModal'
import { getRecentLocalGames, getUserCloudGamesList } from '@/shared/api/gameService'
import { getUserCloudTableGamesList } from '@/shared/api/tableGameService'
import { LocalTableGameStorage } from '@/shared/api/localTableGameStorage'
import { useGameStateContext } from '@/shared/hooks/useGameState'
import { useUser } from '@/shared/hooks/useUser'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { filterGames, getDefaultFilters } from '@/shared/utils/gameFilters'
import { batchCheckGamesSyncStatus } from '@/shared/utils/syncChecker'
import { UsersIcon } from '@/components/ui/Icon'
import "@/styles/pages/home.css"

const Home = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useUser()
  const { isOnline } = useOnlineStatus()
  const { loadSavedGame, getSavedGames } = useGameStateContext()
  const [allGames, setAllGames] = useState([])
  const [loading, setLoading] = useState(false)
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [showFriendsModal, setShowFriendsModal] = useState(false)
  const [filters, setFilters] = useState(getDefaultFilters())
  const [gameSyncStatuses, setGameSyncStatuses] = useState({})
  const [_isShowingCloudGames, setIsShowingCloudGames] = useState(false)
  
  // Apply filters to games
  const filteredGames = useMemo(() => {
    return filterGames(allGames, filters);
  }, [allGames, filters]);

  const handleLoadGame = async (gameId) => {
    try {
      const success = await loadSavedGame(gameId)
      if (success) {
        setShowLoadDialog(false)
        navigate("/game/current")
      }
      return success
    } catch (error) {
      console.error('Failed to load game:', error)
      return false
    }
  }

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
  };

  // Fetch local games (for offline mode or as fallback)
  const fetchLocalGames = async () => {
    try {
      // Fetch regular wizard games
      const localGames = await getRecentLocalGames(100);
      const formattedLocalGames = Array.isArray(localGames) ? localGames.map(game => ({
        ...game,
        created_at: game.created_at || new Date().toISOString(),
        isLocal: true
      })) : [];
      
      // Fetch table games
      const tableGames = LocalTableGameStorage.getSavedTableGamesList();
      const formattedTableGames = tableGames
        .filter(game => game.gameFinished) // Only show finished table games
        .map(game => {
          // Get the full game data to calculate winner
          const fullGame = LocalTableGameStorage.getTableGameById(game.id);
          const gameData = fullGame?.gameData;
          
          // Calculate winner based on scores
          let winnerName = "Not determined";
          if (gameData?.players && Array.isArray(gameData.players)) {
            const playersWithScores = gameData.players.map(player => {
              const total = player.points?.reduce((sum, val) => sum + (Number.parseInt(val, 10) || 0), 0) || 0;
              return { ...player, total };
            });
            
            if (playersWithScores.length > 0) {
              // Check if low score is better from game settings
              const lowIsBetter = gameData.lowIsBetter || false;
              const winner = playersWithScores.reduce((best, current) => {
                if (!best) return current;
                if (lowIsBetter) {
                  return current.total < best.total ? current : best;
                } else {
                  return current.total > best.total ? current : best;
                }
              }, null);
              
              winnerName = winner?.name || "Not determined";
            }
          }
          
          // Check if uploaded
          const isUploaded = LocalTableGameStorage.isGameUploaded(game.id);
          
          return {
            ...game,
            created_at: game.lastPlayed || game.savedAt || new Date().toISOString(),
            gameType: 'table',
            winner_name: winnerName,
            isUploaded: isUploaded,
            isLocal: true
          };
        });
      
      // Combine and sort by date
      const allLocalGames = [...formattedLocalGames, ...formattedTableGames].sort((a, b) => {
        const dateA = new Date(a.created_at || a.lastPlayed || a.savedAt);
        const dateB = new Date(b.created_at || b.lastPlayed || b.savedAt);
        return dateB - dateA;
      });
      
      return allLocalGames;
    } catch (error) {
      console.error('Error fetching local games:', error);
      return [];
    }
  };

  // Fetch cloud games (for online mode)
  const fetchCloudGames = async () => {
    try {
      // Fetch both wizard games and table games from cloud
      const [wizardGames, tableGames] = await Promise.all([
        getUserCloudGamesList(),
        getUserCloudTableGamesList()
      ]);

      console.debug('Cloud games fetched:', {
        wizardGamesCount: wizardGames.length,
        tableGamesCount: tableGames.length,
        tableGamesFinished: tableGames.filter(g => g.gameFinished).length
      });

      // Format wizard games
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

      // Format table games
      const formattedTableGames = tableGames
        .filter(game => game.gameFinished) // Only show finished table games
        .map(game => {
          // Calculate winner from players data
          let winnerName = "Not determined";
          if (game.players && Array.isArray(game.players)) {
            const playersWithScores = game.players.map(player => {
              const total = player.points?.reduce((sum, val) => sum + (Number.parseInt(val, 10) || 0), 0) || 0;
              return { ...player, total };
            });
            
            if (playersWithScores.length > 0) {
              const rawData = game.rawData?.gameData;
              const lowIsBetter = rawData?.lowIsBetter || false;
              const winner = playersWithScores.reduce((best, current) => {
                if (!best) return current;
                if (lowIsBetter) {
                  return current.total < best.total ? current : best;
                } else {
                  return current.total > best.total ? current : best;
                }
              }, null);
              
              winnerName = winner?.name || "Not determined";
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
            gameType: 'table',
            winner_name: winnerName
          };
        });

      // Combine and sort by date
      const allCloudGames = [...formattedWizardGames, ...formattedTableGames].sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return dateB - dateA;
      });

      return allCloudGames;
    } catch (error) {
      console.error('Error fetching cloud games:', error);
      throw error;
    }
  };

  useEffect(() => {
    const fetchGames = async () => {
      setLoading(true);
      try {
        // If user is logged in and online, try to fetch cloud games
        if (user && isOnline) {
          try {
            const cloudGames = await fetchCloudGames();
            setAllGames(cloudGames);
            setIsShowingCloudGames(true);
            setGameSyncStatuses({}); // No need to check sync status for cloud games
            console.debug('Showing cloud games');
          } catch (error) {
            // If cloud fetch fails, fall back to local games
            console.debug('Failed to fetch cloud games, falling back to local:', error.message);
            const localGames = await fetchLocalGames();
            setAllGames(localGames);
            setIsShowingCloudGames(false);
            
            // Batch check sync status for wizard games
            if (localGames.length > 0) {
              try {
                const wizardGameIds = localGames
                  .filter(game => game.gameType !== 'table' && game.id)
                  .map(game => game.id);
                
                if (wizardGameIds.length > 0) {
                  const syncStatuses = await batchCheckGamesSyncStatus(wizardGameIds);
                  setGameSyncStatuses(syncStatuses);
                }
              } catch (syncError) {
                console.debug('Error batch checking sync status:', syncError.message);
              }
            }
          }
        } else {
          // Offline or not logged in - show local games
          const localGames = await fetchLocalGames();
          setAllGames(localGames);
          setIsShowingCloudGames(false);
          console.debug('Showing local games (offline or not logged in)');
          
          // Batch check sync status for wizard games if user is logged in
          if (user && localGames.length > 0) {
            try {
              const wizardGameIds = localGames
                .filter(game => game.gameType !== 'table' && game.id)
                .map(game => game.id);
              
              if (wizardGameIds.length > 0) {
                const syncStatuses = await batchCheckGamesSyncStatus(wizardGameIds);
                setGameSyncStatuses(syncStatuses);
              }
            } catch (error) {
              console.debug('Error batch checking sync status on Home:', error.message);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching games:', error);
        setAllGames([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchGames();
  }, [user, isOnline]); // Re-fetch games when user or online status changes

  // Check for offline message from navigation state
  useEffect(() => {
    if (location.state?.offlineMessage) {
      // setOfflineMessage(location.state.offlineMessage);
      // Clear the state to avoid showing the message after navigating away and back
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  return (
    <div className="home-container">
      <header className="home-header">
        <h1>KeepWiz</h1>
        <p>Track your Wizard card game stats and performance</p>
      </header>

      <div className="friends-section">
        <button 
          className="friends-button"
          onClick={() => setShowFriendsModal(true)}
          aria-label="Manage friends"
        >
          <UsersIcon size={20} />
          <span>Friends</span>
        </button>
      </div>

      <section className="recent-games">
        <div className="section-header">
          <h2>Games</h2>
          {!isOnline && user && (
            <span className="offline-indicator" title="Showing local games while offline">
              Offline
            </span>
          )}
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
          <div className="loading-message">Loading games...</div>
        ) : (
          <>
            {allGames.length > 0 ? (
              <div className="empty-message">No games match your filters</div>
            ) : (
              <div className="empty-message">No games found</div>
            )}
          </>
        )}
      </section>

      {/* Load Game Dialog */}
      <LoadGameDialog
        isOpen={showLoadDialog}
        onClose={() => setShowLoadDialog(false)}
        onLoadGame={handleLoadGame}
        getSavedGames={getSavedGames}
      />

      {/* Filter Modal */}
      <GameFilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApplyFilters={handleApplyFilters}
        initialFilters={filters}
      />

      {/* Friends Modal */}
      <FriendsModal
        isOpen={showFriendsModal}
        onClose={() => setShowFriendsModal(false)}
      />
    </div>
  )
}

export default Home