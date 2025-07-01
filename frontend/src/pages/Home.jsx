import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GameHistoryItem from '../components/GameHistoryItem'
import LoadGameDialog from '../components/LoadGameDialog'
import PageTransition from '../components/PageTransition'
import { getRecentGames, getRecentLocalGames } from '../services/gameService'
import { useGameStateContext } from '../hooks/useGameState'

const Home = () => {
  const navigate = useNavigate()
  const { loadSavedGame, getSavedGames } = useGameStateContext()
  const [recentGames, setRecentGames] = useState([])
  const [recentLocalGames, setRecentLocalGames] = useState([])
  
  // Only show loading on initial app load, not on subsequent navigations
  const isInitialLoad = !sessionStorage.getItem('appLoaded')
  const [loading, setLoading] = useState(isInitialLoad)
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  
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

  useEffect(() => {
    const fetchGames = async () => {
      try {
        // Fetch both server games and local games
        const serverGames = await getRecentGames(4) // Increased limit since we're combining
        const localGames = getRecentLocalGames(4) // This is synchronous
        
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
        setLoading(false)
        
        // Mark that the app has been loaded in this session
        sessionStorage.setItem('appLoaded', 'true')
      } catch (error) {
        console.error('Error fetching games:', error)
        // Even if there's an error with server games, still show local games
        try {
          const localGames = getRecentLocalGames(4)
          const formattedLocalGames = Array.isArray(localGames) ? localGames.map(game => ({
            ...game,
            created_at: game.created_at || new Date().toISOString()
          })) : [];
          setRecentLocalGames(formattedLocalGames)
        } catch (localError) {
          console.error('Error fetching local games:', localError)
          setRecentLocalGames([])
        }
        setLoading(false)
        
        // Mark that the app has been loaded in this session even if there's an error
        sessionStorage.setItem('appLoaded', 'true')
      }
    }

    fetchGames()
  }, [])

  return (
    <PageTransition
      isLoading={loading}
      loadingTitle="Welcome!"
      loadingSubtitle={
        <>
          The home base for tracking your Wizard games.
          <br />
          View stats, history, and more!
        </>
      }
    >
      <div className="home-container">
        <header className="home-header">
          <h1>Wizard Tracker</h1>
          <p>Track your Wizard card game stats and performance</p>
        </header>

        <section className="recent-games">
          <h2>Recent Games</h2>
          <div className="game-list">
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
          </div>
        </section>

        {/* Load Game Dialog */}
        <LoadGameDialog
          isOpen={showLoadDialog}
          onClose={() => setShowLoadDialog(false)}
          onLoadGame={handleLoadGame}
          getSavedGames={getSavedGames}
        />
      </div>
    </PageTransition>
  )
}

export default Home