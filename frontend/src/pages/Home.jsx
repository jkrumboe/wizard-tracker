import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import GameHistoryItem from '@/components/game/GameHistoryItem'
import LoadGameDialog from '@/components/modals/LoadGameDialog'
import GameFilterModal from '@/components/modals/GameFilterModal'
import FriendsModal from '@/components/modals/FriendsModal'
import { getRecentLocalGames } from '@/shared/api/gameService'
import { LocalTableGameStorage } from '@/shared/api/localTableGameStorage'
import { useGameStateContext } from '@/shared/hooks/useGameState'
import { useUser } from '@/shared/hooks/useUser'
import { filterGames, getDefaultFilters, hasActiveFilters } from '@/shared/utils/gameFilters'
import { batchCheckGamesSyncStatus } from '@/shared/utils/syncChecker'
import { FilterIcon, UsersIcon } from '@/components/ui/Icon'
import "@/styles/pages/home.css"

const Home = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useUser()
  const { loadSavedGame, getSavedGames } = useGameStateContext()
  const [allGames, setAllGames] = useState([])
  const [loading, setLoading] = useState(false)
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [showFriendsModal, setShowFriendsModal] = useState(false)
  const [filters, setFilters] = useState(getDefaultFilters())
  const [gameSyncStatuses, setGameSyncStatuses] = useState({})
  
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

  useEffect(() => {
    const fetchLocalGames = async () => {
      setLoading(true);
      try {
        // Fetch regular wizard games
        const localGames = await getRecentLocalGames(100);
        const formattedLocalGames = Array.isArray(localGames) ? localGames.map(game => ({
          ...game,
          created_at: game.created_at || new Date().toISOString()
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
              isUploaded: isUploaded
            };
          });
        
        // Combine and sort by date
        const allGames = [...formattedLocalGames, ...formattedTableGames].sort((a, b) => {
          const dateA = new Date(a.created_at || a.lastPlayed || a.savedAt);
          const dateB = new Date(b.created_at || b.lastPlayed || b.savedAt);
          return dateB - dateA;
        });
        
        setAllGames(allGames);
        
        // Batch check sync status for wizard games
        if (user && allGames.length > 0) {
          try {
            const wizardGameIds = allGames
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
      } catch (error) {
        console.error('Error fetching local games:', error);
        setAllGames([]);
      } finally {
        setLoading(false);
      }
    };
    
    // Only fetch games if there's a user, otherwise clear the list
    // This prevents showing all users' games when logged out
    if (user) {
      fetchLocalGames();
    } else {
      setAllGames([]);
      setLoading(false);
    }
  }, [user]); // Re-fetch games when user changes (e.g., after login/logout)

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
          <h2>Finished Games</h2>
          <button 
            className="filter-button"
            onClick={() => setShowFilterModal(true)}
            aria-label="Filter games"
          >
            <FilterIcon size={20} />
            {hasActiveFilters(filters) && <span className="filter-badge">•</span>}
          </button>
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
          <div className="loading-message">📊 Loading games...</div>
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