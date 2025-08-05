import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import GameHistoryItem from '@/components/game/GameHistoryItem'
import LoadGameDialog from '@/components/modals/LoadGameDialog'
import { getRecentGames, getRecentLocalGames } from '@/shared/api/gameService'
import { useGameStateContext } from '@/shared/hooks/useGameState'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import "@/styles/components/offline-notification.css"
import "@/styles/pages/home.css"

const Home = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isOnline } = useOnlineStatus()
  const { loadSavedGame, getSavedGames } = useGameStateContext()
  const [recentGames, setRecentGames] = useState([])
  const [recentLocalGames, setRecentLocalGames] = useState([])
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [offlineMessage, setOfflineMessage] = useState('')
  
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

  // Check for offline mode redirect
  useEffect(() => {
    if (location.state?.offlineRedirect) {
      setOfflineMessage(location.state.message || 'Online features are currently unavailable');
      
      // Clear the message after 5 seconds
      const timer = setTimeout(() => {
        setOfflineMessage('');
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        let serverGames = [];
        // Only fetch server games when online
        if (isOnline) {
          // Fetch server games
          serverGames = await getRecentGames(4);
        }
        
        // Always fetch local games
        const localGames = await getRecentLocalGames(10); // Fix: await the async function
        
        // Ensure all games have proper date formatting for sorting
        const formattedServerGames = Array.isArray(serverGames) ? serverGames.map(game => ({
          ...game,
          created_at: game.created_at || new Date().toISOString()
        })) : [];
        
        // Local games should already have created_at, but let's make sure
        const formattedLocalGames = Array.isArray(localGames) ? localGames.map(game => ({
          ...game,
          created_at: game.created_at || new Date().toISOString()
        })) : [];
        
        setRecentGames(formattedServerGames)
        setRecentLocalGames(formattedLocalGames)
      } catch (error) {
        console.error('Error fetching games:', error)
        // Even if there's an error with server games, still show local games
        try {
          const localGames = await getRecentLocalGames(4)
          const formattedLocalGames = Array.isArray(localGames) ? localGames.map(game => ({
            ...game,
            created_at: game.created_at || new Date().toISOString()
          })) : [];
          setRecentLocalGames(formattedLocalGames)
        } catch (localError) {
          console.error('Error fetching local games:', localError)
          setRecentLocalGames([])
        }
      }
    }

    fetchGames()
  }, [isOnline])

  // Check for offline message from navigation state
  useEffect(() => {
    if (location.state?.offlineMessage) {
      setOfflineMessage(location.state.offlineMessage);
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

      {offlineMessage && (
        <div className="offline-notification">
          <div className="offline-message">{offlineMessage}</div>
        </div>
      )}

      <section className="recent-games">
        <div className="section-header">
          <h2>Recent Games</h2>
        </div>
        {/* <div className="game-list"> */}
          {recentGames.length > 0 || recentLocalGames.length > 0 ? (
            <div className="game-history">
              {/* Combine and sort all games by date */}
              {[...recentGames, ...recentLocalGames]
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 6) // Limit to 6 most recent games
                .map(game => (
                  <GameHistoryItem key={game.id} game={game} />
                ))
              }
            </div>
          ) : (
            <div className="empty-message">No games found</div>
          )}
        {/* </div> */}
      </section>

      {/* Load Game Dialog */}
      <LoadGameDialog
        isOpen={showLoadDialog}
        onClose={() => setShowLoadDialog(false)}
        onLoadGame={handleLoadGame}
        getSavedGames={getSavedGames}
      />
    </div>
  )
}

export default Home