import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import GameHistoryItem from '../components/GameHistoryItem'
import { getRecentGames } from '../services/gameService'

const Home = () => {
  const [recentGames, setRecentGames] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const games = await getRecentGames(3)
        setRecentGames(games)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching games:', error)
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
        <Link to="/leaderboard" className="btn btn-secondary">Leaderboard</Link>
      </div>

      <section className="recent-games">
        <h2>Recent Games</h2>
        {loading ? (
          <div className="loading">Loading recent games...</div>
        ) : (
          <div className="game-list">
            {recentGames.length > 0 ? (
              recentGames.map(game => (
                <GameHistoryItem key={game.id} game={game} />
              ))
            ) : (
              <div className="empty-message">No recent games found</div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

export default Home 