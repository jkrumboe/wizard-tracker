import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getLeaderboard } from '@/shared/api/gameService'
import { UsersIcon } from '@/components/ui/Icon'
import "@/styles/pages/leaderboard.css"

const Leaderboard = () => {
  const navigate = useNavigate()
  const [players, setPlayers] = useState([])
  const [gameTypes, setGameTypes] = useState(['all'])
  const [gameTypeSettings, setGameTypeSettings] = useState({}) // Track lowIsBetter per game type
  const [selectedGameType, setSelectedGameType] = useState('Wizard') // Default to Wizard
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortBy, setSortBy] = useState('wins')
  const [sortOrder, setSortOrder] = useState('desc')
  const [filter, setFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [lastRefresh, setLastRefresh] = useState(null)
  const playersPerPage = 10

  // Handle player click - Navigate to user profile
  const handlePlayerClick = async (player) => {
    console.log('🎯 Player clicked:', {
      name: player.name,
      userId: player.userId,
      id: player.id,
      fullPlayerData: player
    });

    try {
      // Navigate using userId (identity system)
      if (!player.userId) {
        alert('Cannot view profile for guest players');
        return;
      }
      console.log('✅ Navigating to user profile:', `/user/${player.userId}`);
      console.log('📊 Player stats:', {
        wins: player.wins,
        totalGames: player.totalGames,
        winRate: player.winRate,
        avgScore: player.avgScore
      });
      navigate(`/user/${player.userId}`)
    } catch (error) {
      console.error('💥 Error navigating to player:', error)
      alert(`Error loading player profile: ${error.message}`)
    }
  }

  useEffect(() => {
    fetchLeaderboard()
    
    // Set up auto-refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      fetchLeaderboard(true) // true = silent refresh
    }, 30000)
    
    // Listen for custom game upload events
    const handleGameUploaded = () => {
      console.log('🎮 Game uploaded event received, refreshing leaderboard...')
      fetchLeaderboard(true)
    }
    
    window.addEventListener('gameUploaded', handleGameUploaded)
    
    return () => {
      clearInterval(refreshInterval)
      window.removeEventListener('gameUploaded', handleGameUploaded)
    }
  }, [selectedGameType, fetchLeaderboard]);

  const fetchLeaderboard = async (silent = false) => {
    if (!silent) {
      setLoading(true)
    }
    setError(null)
    try {
      const data = await getLeaderboard(selectedGameType)
      console.log('Leaderboard data received:', data.leaderboard) // Log first 3 players for debugging
      setPlayers(data.leaderboard || [])
      setGameTypes(data.gameTypes || ['all'])
      setGameTypeSettings(data.gameTypeSettings || {})
      // Note: totalGames is now display-only (state kept for UI compatibility)
      setLastRefresh(new Date())
      if (!silent) {
        setCurrentPage(1) // Reset to first page when filter changes
      }
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

  // Determine if lower scores are better for the selected game type
  const lowIsBetter = selectedGameType && selectedGameType !== 'all' 
    ? gameTypeSettings[selectedGameType]?.lowIsBetter || false 
    : false;

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
        // Primary sort by wins
        if (a.wins !== b.wins) {
          return sortOrder === 'asc' ? a.wins - b.wins : b.wins - a.wins;
        }
        // Tiebreaker 1: win rate
        if (a.winRate !== b.winRate) {
          return b.winRate - a.winRate;
        }
        // Tiebreaker 2: average score (direction depends on game type)
        if (a.avgScore !== b.avgScore) {
          if (lowIsBetter) {
            // For low-is-better games, lower average is better
            return a.avgScore - b.avgScore;
          } else {
            // For high-is-better games, higher average is better
            return b.avgScore - a.avgScore;
          }
        }
        // Tiebreaker 3: total games
        return b.totalGames - a.totalGames;
    }
    
    // For non-wins sorting, apply the primary sort
    if (aVal !== bVal) {
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    // Tiebreaker for other sorts: use wins as secondary sort
    if (a.wins !== b.wins) {
      return b.wins - a.wins;
    }
    
    // Final tiebreaker: win rate
    return b.winRate - a.winRate;
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
      <h1 style={{marginBottom: '0'}}>Leaderboard</h1>
      
      {lastRefresh && (
        <div style={{ 
          fontSize: '0.85rem', 
          color: 'var(--text-secondary)', 
          textAlign: 'center',
          marginBottom: '0.5rem' 
        }}>
          Last updated: {lastRefresh.toLocaleTimeString()}
        </div>
      )}
      
      <Link 
        to="/friend-leaderboard" 
        className="friend-leaderboard-link"
      >
        <UsersIcon size={18} />
        Compare with Friends
      </Link>
      
      {/* <div className="leaderboard-stats">
        <span>Total Games: {totalGames}</span>
        <span>Total Players: {players.length}</span>
      </div> */}

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
              {type === 'all' ? 'All Games' : type}
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
              <div className="rank-col"/>
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
              {/* <div 
                className={`games-col ${sortBy === 'totalGames' ? 'sorted' : ''}`}
                onClick={() => handleSort('totalGames')}
              >
                Games {sortBy === 'totalGames' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div> */}
              <div 
                className={`score-col ${sortBy === 'avgScore' ? 'sorted' : ''}`}
                onClick={() => handleSort('avgScore')}
              >
                Ø Score {sortBy === 'avgScore' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
            </div>

            <div className="leaderboard-body">
              {Array.from({ length: playersPerPage }).map((_, index) => {
                const player = paginatedPlayers[index];
                const globalRank = (currentPage - 1) * playersPerPage + index + 1;
                
                return player ? (
                  <div key={player.id} className="leaderboard-row">
                    <div className={`rank-col ${globalRank === 1 ? 'gold' : globalRank === 2 ? 'silver' : globalRank === 3 ? 'bronze' : ''}`}>
                      {globalRank}
                    </div>
                    <div 
                      className="player-col clickable"
                      onClick={() => handlePlayerClick(player)}
                      style={{ 
                        cursor: 'pointer',
                        opacity: 1
                      }}
                      title="View player profile"
                    >
                      {player.name}
                    </div>
                    <div className="wins-col">{player.wins}</div>
                    <div className="winrate-col">{player.winRate}%</div>
                    {/* <div className="games-col">{player.totalGames}</div> */}
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
              {currentPage} of {totalPages || 1}
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