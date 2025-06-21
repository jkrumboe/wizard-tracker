import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import GameHistoryItem from '../components/GameHistoryItem'
import { getRecentGames, getRecentLocalGames } from '../services/gameService'

const Home = () => {
  const [recentGames, setRecentGames] = useState([])
  const [recentLocalGames, setRecentLocalGames] = useState([])
  const [loading, setLoading] = useState(true)
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
    <div className="container">
      <header className="home-header">
        <h1>Wizard Tracker</h1>
        <p>Track your Wizard card game stats and performance</p>
      </header>

      <div className="action-buttons">
        <Link to="/new-game" className="btn btn-primary">New Game</Link>
        <Link to="/lobby" className="btn btn-primary">Multiplayer Lobby</Link>
      </div>
      
      <section className="recent-games">
        <h2>Recent Games</h2>
        {loading ? (
          <div className="loading">Loading games...</div>
        ) : (
          <div className="game-list">
            {recentGames.length > 0 || recentLocalGames.length > 0 ? (
              <>
                {/* Combine and sort all games by date */}
                {[...recentGames, ...recentLocalGames]
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .slice(0, 6) // Limit to 6 most recent games
                  .map(game => (
                    <GameHistoryItem key={game.id} game={game} />
                  ))
                }
              </>
            ) : (
              <div className="empty-message">No games found</div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

export default Home