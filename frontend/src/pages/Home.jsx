import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GameHistoryItem from '../components/GameHistoryItem'
import LoadGameDialog from '../components/LoadGameDialog'
import { getRecentGames, getRecentLocalGames } from '../services/gameService'
import { useGameStateContext } from '../hooks/useGameState'

const Home = () => {
  const navigate = useNavigate()
  const { loadSavedGame, getSavedGames } = useGameStateContext()
  const [recentGames, setRecentGames] = useState([])
  const [recentLocalGames, setRecentLocalGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  
  const handleLoadGame = async (gameId) => {
    try {
      const success = await loadSavedGame(gameId)
      if (success) {
        setShowLoadDialog(false)
        navigate("/game-in-progress")
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
        const formattedServerGames = serverGames.map(game => ({
          ...game,
          created_at: game.created_at || new Date().toISOString()
        }))
        
        // Local games should already have created_at, but let's make sure
        const formattedLocalGames = localGames.map(game => ({
          ...game,
          created_at: game.created_at || new Date().toISOString()
        }))
        
        setRecentGames(formattedServerGames)
        setRecentLocalGames(formattedLocalGames)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching games:', error)
        // Even if there's an error with server games, still show local games
        const localGames = getRecentLocalGames(4)
        setRecentLocalGames(localGames)
        setLoading(false)
      }
    }

    fetchGames()
  }, [])
  return (
    <div className="home-container">
      <header className="home-header">
        <h1>Wizard Tracker</h1>
        <p>Track your Wizard card game stats and performance</p>
      </header>

      <div className="action-buttons">
        <Link to="/new-game" className="btn btn-primary">New Game</Link>
        <button 
          onClick={() => setShowLoadDialog(true)}
          className="btn btn-secondary"
        >
          Load Saved Game
        </button>
        <Link to="/lobby" className="btn btn-primary">Multiplayer Lobby</Link>
      </div>
        <section className="recent-games">
        <h2>Recent Games</h2>
        {loading ? (
          <div className="loading-container">
            <div className="loading">Loading games...</div>
          </div>
        ) : (
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
        )}
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