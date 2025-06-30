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
  const [currentPage, setCurrentPage] = useState(1)
  const playersPerPage = 5
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const playerData = await getPlayers()
        // Players now come with stats included from the new API
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
    setCurrentPage(1)
  }

  const filteredPlayers = players.filter(
    player => player.name.toLowerCase().includes(filter.toLowerCase())
  )

  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    if (sortOrder === 'asc') {
      if (sortBy === 'winRate') {
        return (a.wins / a.total_games) - (b.wins / b.total_games);
      } else if (sortBy === 'totalGames') {
        return a.total_games - b.total_games;
      }
      return a[sortBy] - b[sortBy];
    } else {
      if (sortBy === 'winRate') {
        return (b.wins / b.total_games) - (a.wins / a.total_games);
      } else if (sortBy === 'totalGames') {
        return b.total_games - a.total_games;
      }
      return b[sortBy] - a[sortBy];
    }
  })

  const totalPages = Math.ceil(sortedPlayers.length / playersPerPage)
  const paginatedPlayers = sortedPlayers.slice(
    (currentPage - 1) * playersPerPage,
    currentPage * playersPerPage
  )

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

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
            Win% {sortBy === 'winRate' && (sortOrder === 'asc' ? '↑' : '↓')}
          </div>
          <div 
            className={`games-col ${sortBy === 'totalGames' ? 'sorted' : ''}`}
            onClick={() => handleSort('totalGames')}
          >
            Games {sortBy === 'totalGames' && (sortOrder === 'asc' ? '↑' : '↓')}
          </div>
        </div>

        <div className="leaderboard-body">
          {Array.from({ length: playersPerPage }).map((_, index) => {
            const player = paginatedPlayers[index];
            return player ? (
              <div key={player.id} className="leaderboard-row">
                <div className="rank-col">{(currentPage - 1) * playersPerPage + index + 1}</div>
                <div className="player-col">
                  <Link to={`/profile/${player.id}`} className="player-link">
                    <img src={player.avatar || defaultAvatar} alt={player.name} className="player-avatar" />
                    <span className="player-name">{player.name}</span>
                  </Link>
                </div>
                <div className="elo-col">{player.elo}</div>
                <div className="winrate-col">{player.win_rate}%</div>
                <div className="games-col">{player.total_games}</div>
              </div>
            ) : (
              <div key={`empty-${index}`} className="leaderboard-row empty-row">
                <div className="rank-col"></div>
                <div className="player-col"></div>
                <div className="elo-col"></div>
                <div className="winrate-col"></div>
                <div className="games-col"></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pagination-controls">
        <button onClick={handlePreviousPage} disabled={currentPage === 1}>
          Prev.
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button onClick={handleNextPage} disabled={currentPage === totalPages}>
          Next
        </button>
      </div>
    </div>
  )
}

export default Leaderboard