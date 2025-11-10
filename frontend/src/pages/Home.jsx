import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import GameHistoryItem from '@/components/game/GameHistoryItem'
import LoadGameDialog from '@/components/modals/LoadGameDialog'
import GameFilterModal from '@/components/modals/GameFilterModal'
import FriendsModal from '@/components/modals/FriendsModal'
import { getRecentLocalGames } from '@/shared/api/gameService'
import { useGameStateContext } from '@/shared/hooks/useGameState'
import { useUser } from '@/shared/hooks/useUser'
import { filterGames, getDefaultFilters, hasActiveFilters } from '@/shared/utils/gameFilters'
import { FilterIcon, UsersIcon } from '@/components/ui/Icon'
import "@/styles/components/offline-notification.css"
import "@/styles/pages/home.css"

const Home = () => {
  const navigate = useNavigate()
  const location = useLocation()
  // const { isOnline } = useOnlineStatus()
  const { user } = useUser()
  const { loadSavedGame, getSavedGames } = useGameStateContext()
  const [allGames, setAllGames] = useState([])
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [showFriendsModal, setShowFriendsModal] = useState(false)
  const [filters, setFilters] = useState(getDefaultFilters())
  // const [offlineMessage, setOfflineMessage] = useState('')
  
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

  // Check for offline mode redirect
  useEffect(() => {
    if (location.state?.offlineRedirect) {
      // setOfflineMessage(location.state.message || 'Online features are currently unavailable');
      
      // Clear the message after 5 seconds
      const timer = setTimeout(() => {
        // setOfflineMessage('');
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  useEffect(() => {
    const fetchLocalGames = async () => {
      try {
        const localGames = await getRecentLocalGames(100);
        const formattedLocalGames = Array.isArray(localGames) ? localGames.map(game => ({
          ...game,
          created_at: game.created_at || new Date().toISOString()
        })) : [];
        setAllGames(formattedLocalGames);
      } catch (error) {
        console.error('Error fetching local games:', error);
        setAllGames([]);
      }
    };
    
    // Only fetch games if there's a user, otherwise clear the list
    // This prevents showing all users' games when logged out
    if (user) {
      fetchLocalGames();
    } else {
      setAllGames([]);
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

      {/* {offlineMessage && (
        <div className="offline-notification">
          <div className="offline-message">{offlineMessage}</div>
        </div>
      )} */}

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
              <GameHistoryItem key={game.id} game={game} />
            ))}
          </div>
        ) : allGames.length > 0 ? (
          <div className="empty-message">No games match your filters</div>
        ) : (
          <div className="empty-message">No games found</div>
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