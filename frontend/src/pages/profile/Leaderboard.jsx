import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { getLeaderboard } from '@/shared/api/gameService'
import { UsersIcon } from '@/components/ui/Icon'
import "@/styles/pages/leaderboard.css"

const Leaderboard = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [players, setPlayers] = useState([])
  const [gameTypes, setGameTypes] = useState(['Wizard'])
  const [gameTypeSettings, setGameTypeSettings] = useState({}) // Track lowIsBetter per game type
  const [selectedGameType, setSelectedGameType] = useState('Wizard') // Default to Wizard
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortBy, setSortBy] = useState('elo')
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
      // Navigate using userId if available, otherwise use player name
      // The backend will resolve guest player names to linked user accounts
      const identifier = player.userId || player.name;
      if (!identifier) {
        alert(t('leaderboard.cannotViewProfile'));
        return;
      }
      console.log('✅ Navigating to user profile:', `/user/${identifier}`);
      console.log('📊 Player stats:', {
        wins: player.wins,
        totalGames: player.totalGames,
        winRate: player.winRate,
        avgScore: player.avgScore
      });
      navigate(`/user/${identifier}`)
    } catch (error) {
      console.error('💥 Error navigating to player:', error)
      alert(t('leaderboard.errorLoadingProfile', { error: error.message }))
    }
  }

  const fetchLeaderboard = async (silent = false) => {
    if (!silent) {
      setLoading(true)
    }
    setError(null)
    try {
      const data = await getLeaderboard(selectedGameType)
      console.log('Leaderboard data received:', data.leaderboard) // Log first 3 players for debugging
      setPlayers(data.leaderboard || [])
      setGameTypes(data.gameTypes || ['Wizard'])
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGameType]);

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
  const lowIsBetter = selectedGameType
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
      case 'wins':
        aVal = a.wins;
        bVal = b.wins;
        break;
      case 'elo':
      default:
        // Primary sort by ELO
        if ((a.elo || 1000) !== (b.elo || 1000)) {
          return sortOrder === 'asc' ? (a.elo || 1000) - (b.elo || 1000) : (b.elo || 1000) - (a.elo || 1000);
        }
        // Tiebreaker 1: wins
        if (a.wins !== b.wins) {
          return b.wins - a.wins;
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
        // Tiebreaker 3: win rate
        return b.winRate - a.winRate;
    }
    
    // For non-elo sorting, apply the primary sort
    if (aVal !== bVal) {
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    // Tiebreaker for other sorts: use ELO as secondary sort
    if ((a.elo || 1000) !== (b.elo || 1000)) {
      return (b.elo || 1000) - (a.elo || 1000);
    }
    
    // Final tiebreaker: wins
    return b.wins - a.wins;
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
      <div className="leaderboard-container">
        <h1 style={{marginBottom: '0'}}>{t('leaderboard.title')}</h1>
        
        <div style={{ 
          fontSize: '0.85rem', 
          color: 'var(--text-secondary)', 
          textAlign: 'center',
          marginBottom: '0.5rem' 
        }}>
          {t('common.loading')}
        </div>
        
        <Link 
          to="/friend-leaderboard" 
          className="friend-leaderboard-link"
          style={{ pointerEvents: 'none', opacity: 0.7 }}
        >
          <UsersIcon size={18} />
          {t('leaderboard.compareWithFriends')}
        </Link>

        <div className="filter-container">
          <input
            type="text"
            placeholder={t('leaderboard.searchPlaceholder')}
            className="search-input"
            value=""
            disabled
          />
          <select 
            className="game-type-select"
            disabled
            value={selectedGameType}
          >
            <option>{selectedGameType}</option>
          </select>
        </div>

        <div className="leaderboard-table">
          <div className="leaderboard-header">
            <div className="rank-col"/>
            <div className="player-col">{t('leaderboard.playerHeader')}</div>
            <div className="wins-col">{t('leaderboard.winsHeader')}</div>
            <div className="winrate-col">{t('leaderboard.winPercentHeader')}</div>
            <div className="score-col">{t('leaderboard.eloHeader')}</div>
          </div>

          <div className="leaderboard-body">
            {Array.from({ length: playersPerPage }).map((_, index) => (
              <div key={`skeleton-${index}`} className="leaderboard-row skeleton-row">
                <div className="rank-col">
                  <div className="skeleton skeleton-rank"></div>
                </div>
                <div className="player-col">
                  <div className="skeleton skeleton-name" style={{ width: `${60 + Math.random() * 40}%` }}></div>
                </div>
                <div className="wins-col">
                  <div className="skeleton skeleton-stat"></div>
                </div>
                <div className="winrate-col">
                  <div className="skeleton skeleton-stat"></div>
                </div>
                <div className="score-col">
                  <div className="skeleton skeleton-stat"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pagination-controls">
          <button disabled>{t('common.previous')}</button>
          <span>- of -</span>
          <button disabled>{t('common.next')}</button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>{t('leaderboard.errorLoading')}</h2>
        <p>{error}</p>
        <button onClick={fetchLeaderboard} className="retry-button">
          {t('common.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="leaderboard-container">
      <h1 style={{marginBottom: '0'}}>{t('leaderboard.title')}</h1>
      
      {lastRefresh && (
        <div style={{ 
          fontSize: '0.85rem', 
          color: 'var(--text-secondary)', 
          textAlign: 'center',
          marginBottom: '0.5rem' 
        }}>
          {t('leaderboard.lastUpdated', { date: lastRefresh.toLocaleTimeString() })}
        </div>
      )}
      
      <Link 
        to="/friend-leaderboard" 
        className="friend-leaderboard-link"
      >
        <UsersIcon size={18} />
        {t('leaderboard.compareWithFriends')}
      </Link>
      
      {/* <div className="leaderboard-stats">
        <span>Total Games: {totalGames}</span>
        <span>Total Players: {players.length}</span>
      </div> */}

      <div className="filter-container">
        <input
          type="text"
          placeholder={t('leaderboard.searchPlaceholder')}
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
              {type}
            </option>
          ))}
        </select>
      </div>

      {sortedPlayers.length === 0 ? (
        <div className="no-results">
          <p>{filter ? t('leaderboard.noPlayersMatchSearch') : t('leaderboard.noPlayersFound')}</p>
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
                {t('leaderboard.playerHeader')} {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
              <div
                className={`wins-col ${sortBy === 'wins' ? 'sorted' : ''}`}
                onClick={() => handleSort('wins')}
              >
                {t('leaderboard.winsHeader')} {sortBy === 'wins' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
              <div
                className={`winrate-col ${sortBy === 'winRate' ? 'sorted' : ''}`}
                onClick={() => handleSort('winRate')}
              >
                {t('leaderboard.winPercentHeader')} {sortBy === 'winRate' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
              {/* <div 
                className={`games-col ${sortBy === 'totalGames' ? 'sorted' : ''}`}
                onClick={() => handleSort('totalGames')}
              >
                Games {sortBy === 'totalGames' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div> */}
              <div 
                className={`score-col ${sortBy === 'elo' ? 'sorted' : ''}`}
                onClick={() => handleSort('elo')}
              >
                {t('leaderboard.eloHeader')} {sortBy === 'elo' && (sortOrder === 'asc' ? '↑' : '↓')}
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
                      title={t('leaderboard.viewPlayerProfile')}
                    >
                      {player.name}
                    </div>
                    <div className="wins-col">{player.wins}</div>
                    <div className="winrate-col">{player.winRate}%</div>
                    {/* <div className="games-col">{player.totalGames}</div> */}
                    <div className="score-col">{player.elo || 1000}</div>
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
              {t('common.previous')}
            </button>
            <span>
              {t('leaderboard.pageOf', { current: currentPage, total: totalPages || 1 })}
            </span>
            <button onClick={handleNextPage} disabled={currentPage === totalPages || totalPages === 0}>
              {t('common.next')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default Leaderboard