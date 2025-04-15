import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getPlayers } from '../services/playerService'
import defaultAvatar from "../assets/default-avatar.png";

const Leaderboard = () => {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('elo')
  const [sortOrder, setSortOrder] = useState('desc')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const playerData = await getPlayers()
        setPlayers(playerData)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching players:', error)
        setLoading(false)
      }
    }

    fetchPlayers()
  }, [])

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const handleFilterChange = (e) => {
    setFilter(e.target.value)
  }

  const filteredPlayers = players.filter(
    player => player.name.toLowerCase().includes(filter.toLowerCase())
  )

  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    if (sortOrder === 'asc') {
      return a[sortBy] - b[sortBy]
    } else {
      return b[sortBy] - a[sortBy]
    }
  })

  if (loading) {
    return <div className="loading">Loading leaderboard...</div>
  }

  return (
    <div className="leaderboard-container">
      <h1>Leaderboard</h1>
      
      <div className="filter-container">
        <input
          type="text"
          placeholder="Search players..."
          value={filter}
          onChange={handleFilterChange}
          className="search-input"
        />
      </div>

      <div className="leaderboard-table">
        <div className="leaderboard-header">
          <div className="rank-col">#</div>
          <div className="player-col">Player</div>
          <div 
            className={`elo-col ${sortBy === 'elo' ? 'sorted' : ''}`}
            onClick={() => handleSort('elo')}
          >
            ELO {sortBy === 'elo' && (sortOrder === 'asc' ? '↑' : '↓')}
          </div>
          <div 
            className={`winrate-col ${sortBy === 'winRate' ? 'sorted' : ''}`}
            onClick={() => handleSort('winRate')}
          >
            Win % {sortBy === 'winRate' && (sortOrder === 'asc' ? '↑' : '↓')}
          </div>
          <div 
            className={`games-col ${sortBy === 'totalGames' ? 'sorted' : ''}`}
            onClick={() => handleSort('totalGames')}
          >
            Games {sortBy === 'totalGames' && (sortOrder === 'asc' ? '↑' : '↓')}
          </div>
        </div>

        <div className="leaderboard-body">
          {sortedPlayers.map((player, index) => (
            <div key={player.id} className="leaderboard-row">
              <div className="rank-col">{index + 1}</div>
              <div className="player-col">
                <Link to={`/profile/${player.id}`} className="player-link">
                  <img src={player.avatar || defaultAvatar} alt={player.name} className="player-avatar" />
                  <span className="player-name">{player.name}</span>
                </Link>
              </div>
              <div className="elo-col">{player.elo}</div>
              <div className="winrate-col">{player.winRate}%</div>
              <div className="games-col">{player.totalGames}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Leaderboard