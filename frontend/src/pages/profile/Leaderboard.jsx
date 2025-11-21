import { useState, useEffect } from 'react'
import { getLeaderboard } from '@/shared/api/gameService'
import "@/styles/pages/leaderboard.css"

const Leaderboard = () => {
  const [players, setPlayers] = useState([])
  const [gameTypes, setGameTypes] = useState(['all'])
  const [selectedGameType, setSelectedGameType] = useState('Wizard') // Default to Wizard
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortBy, setSortBy] = useState('wins')
  const [sortOrder, setSortOrder] = useState('desc')
  const [filter, setFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalGames, setTotalGames] = useState(0)
  const playersPerPage = 10

  useEffect(() => {
    fetchLeaderboard()
  }, [selectedGameType])

  const fetchLeaderboard = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getLeaderboard(selectedGameType)
      setPlayers(data.leaderboard || [])
      setGameTypes(data.gameTypes || ['all'])
      setTotalGames(data.totalGames || 0)
      setCurrentPage(1) // Reset to first page when filter changes
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

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

  const handleGameTypeChange = (e) => {
    setSelectedGameType(e.target.value)
  }

  const filteredPlayers = players.filter(
    player => player.name.toLowerCase().includes(filter.toLowerCase())
  )

  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    let aVal, bVal;
    
    switch(sortBy) {
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      case 'winRate':
        aVal = a.winRate;
        bVal = b.winRate;
        break;
      case 'totalGames':
        aVal = a.totalGames;
        bVal = b.totalGames;
        break;
      case 'avgScore':
        aVal = a.avgScore;
        bVal = b.avgScore;
        break;
      case 'wins':
      default:
        aVal = a.wins;
        bVal = b.wins;
        break;
    }
    
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
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
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <h2>Loading Leaderboard...</h2>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error Loading Leaderboard</h2>
        <p>{error}</p>
        <button onClick={fetchLeaderboard} className="retry-button">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="leaderboard-container">
      <h1>Leaderboard</h1>
      
      <div className="leaderboard-stats">
        <span>Total Games: {totalGames}</span>
        <span>Total Players: {players.length}</span>
      </div>

      <div className="filter-container">
        <input
          type="text"
          placeholder="Search players..."
          value={filter}
          onChange={handleFilterChange}
          className="search-input"
        />
        
        <select 
          value={selectedGameType} 
          onChange={handleGameTypeChange}
          className="game-type-select"
        >
          {gameTypes.map(type => (
            <option key={type} value={type}>
              {type === 'all' ? 'All Game Types' : type}
            </option>
          ))}
        </select>
      </div>

      {sortedPlayers.length === 0 ? (
        <div className="no-results">
          <p>No players found{filter ? ' matching your search' : ''}.</p>
        </div>
      ) : (
        <>
          <div className="leaderboard-table">
            <div className="leaderboard-header">
              <div className="rank-col">#</div>
              <div 
                className={`player-col ${sortBy === 'name' ? 'sorted' : ''}`}
                onClick={() => handleSort('name')}
              >
                Player {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
              <div 
                className={`wins-col ${sortBy === 'wins' ? 'sorted' : ''}`}
                onClick={() => handleSort('wins')}
              >
                Wins {sortBy === 'wins' && (sortOrder === 'asc' ? '↑' : '↓')}
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
              <div 
                className={`score-col ${sortBy === 'avgScore' ? 'sorted' : ''}`}
                onClick={() => handleSort('avgScore')}
              >
                Avg Score {sortBy === 'avgScore' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
            </div>

            <div className="leaderboard-body">
              {Array.from({ length: playersPerPage }).map((_, index) => {
                const player = paginatedPlayers[index];
                const globalRank = (currentPage - 1) * playersPerPage + index + 1;
                
                return player ? (
                  <div key={player.id} className="leaderboard-row">
                    <div className="rank-col">
                      {globalRank === 1 && <span className="medal gold">🥇</span>}
                      {globalRank === 2 && <span className="medal silver">🥈</span>}
                      {globalRank === 3 && <span className="medal bronze">🥉</span>}
                      {globalRank > 3 && globalRank}
                    </div>
                    <div className="player-col">
                      <span className="player-name">{player.name}</span>
                    </div>
                    <div className="wins-col">{player.wins}</div>
                    <div className="winrate-col">{player.winRate}%</div>
                    <div className="games-col">{player.totalGames}</div>
                    <div className="score-col">{player.avgScore}</div>
                  </div>
                ) : (
                  <div key={`empty-${index}`} className="leaderboard-row empty-row">
                    <div className="rank-col"></div>
                    <div className="player-col"></div>
                    <div className="wins-col"></div>
                    <div className="winrate-col"></div>
                    <div className="games-col"></div>
                    <div className="score-col"></div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pagination-controls">
            <button onClick={handlePreviousPage} disabled={currentPage === 1}>
              Previous
            </button>
            <span>
              Page {currentPage} of {totalPages || 1}
            </span>
            <button onClick={handleNextPage} disabled={currentPage === totalPages || totalPages === 0}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default Leaderboard