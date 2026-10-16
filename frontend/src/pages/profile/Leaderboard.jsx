import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { getLeaderboard } from '@/shared/api/gameService'
import Icon, { ChevronDownIcon, ChevronUpIcon, SearchIcon, XIcon } from '@/components/ui/Icon'
import BackButton from '@/components/ui/BackButton'
import RankBadge from '@/components/game/RankBadge'
import '@/styles/pages/gamesPage.css'
import '@/styles/pages/leaderboard.css'

const Leaderboard = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [players, setPlayers] = useState([])
  const [gameTypes, setGameTypes] = useState(['Wizard'])
  const [gameTypeSettings, setGameTypeSettings] = useState({}) // Track lowIsBetter per game type
  const [selectedGameType, setSelectedGameType] = useState(
    () => sessionStorage.getItem('leaderboard_gameType') || 'Wizard'
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortBy, setSortBy] = useState('elo')
  const [sortOrder, setSortOrder] = useState('desc')
  const [filter, setFilter] = useState(
    () => sessionStorage.getItem('leaderboard_filter') || ''
  )
  const [currentPage, setCurrentPage] = useState(
    () => parseInt(sessionStorage.getItem('leaderboard_page') || '1', 10)
  )
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

  // Persist filter state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('leaderboard_gameType', selectedGameType)
  }, [selectedGameType])

  useEffect(() => {
    sessionStorage.setItem('leaderboard_filter', filter)
  }, [filter])

  useEffect(() => {
    sessionStorage.setItem('leaderboard_page', String(currentPage))
  }, [currentPage])

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

  const sortColumns = [
    { field: 'name', label: t('leaderboard.playerHeader'), className: 'lb-col-player' },
    { field: 'wins', label: t('leaderboard.winsHeader'), className: 'lb-col-stat' },
    { field: 'winRate', label: t('leaderboard.winPercentHeader'), className: 'lb-col-stat' },
    { field: 'elo', label: t('leaderboard.eloHeader'), className: 'lb-col-stat' },
  ]

  const header = (
    <header className="lb-header">
      <BackButton fallback="/games" />
      <h1 className="games-title lb-title">{t('leaderboard.title')}</h1>
      <Link
        to="/friend-leaderboard"
        className="games-quick-link"
        aria-label={t('leaderboard.compareWithFriends')}
        title={t('leaderboard.compareWithFriends')}
      >
        <Icon name="Swords" size={18} strokeWidth={2} aria-hidden="true" />
        <span className="games-quick-link-label">{t('leaderboard.compareWithFriends')}</span>
      </Link>
    </header>
  )

  const filterBar = (
    <div className="games-filter-bar lb-filter-bar">
      <div className="games-search-wrapper">
        <SearchIcon size={16} className="games-search-icon" />
        <input
          type="text"
          className="games-search-input"
          placeholder={t('leaderboard.searchPlaceholder')}
          aria-label={t('leaderboard.searchPlaceholder')}
          value={loading ? '' : filter}
          onChange={handleFilterChange}
          disabled={loading}
        />
        {filter && !loading && (
          <button
            type="button"
            className="games-search-clear"
            onClick={() => { setFilter(''); setCurrentPage(1) }}
            aria-label="Clear search"
          >
            <XIcon size={14} />
          </button>
        )}
      </div>
      <div className="games-type-select-wrapper">
        <select
          className="games-type-select"
          value={selectedGameType}
          onChange={handleGameTypeChange}
          disabled={loading}
        >
          {(loading ? [selectedGameType] : gameTypes).map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <ChevronDownIcon size={16} className="games-type-select-icon" aria-hidden="true" />
      </div>
    </div>
  )

  const tableHead = (
    <div className="lb-head">
      <span className="lb-col-rank" />
      {sortColumns.map(({ field, label, className }) => {
        const isSorted = sortBy === field
        const SortIcon = sortOrder === 'asc' ? ChevronUpIcon : ChevronDownIcon
        return (
          <button
            key={field}
            type="button"
            className={`lb-sort ${className} ${isSorted ? 'is-sorted' : ''}`}
            onClick={() => handleSort(field)}
            disabled={loading}
            aria-pressed={isSorted}
          >
            <span>{label}</span>
            {isSorted && <SortIcon size={14} aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )

  if (error) {
    return (
      <div className="lb-page">
        {header}
        <div className="lb-message" role="alert">
          <h2>{t('leaderboard.errorLoading')}</h2>
          <p>{error}</p>
          <button type="button" onClick={() => fetchLeaderboard()} className="lb-page-button">
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="lb-page">
      {header}
      {filterBar}

      <div className="lb-meta">
        {loading
          ? t('common.loading')
          : lastRefresh && t('leaderboard.lastUpdated', { date: lastRefresh.toLocaleTimeString() })}
      </div>

      {!loading && sortedPlayers.length === 0 ? (
        <p className="lb-empty">
          {filter ? t('leaderboard.noPlayersMatchSearch') : t('leaderboard.noPlayersFound')}
        </p>
      ) : (
        <>
          <div className="lb-table">
            {tableHead}
            <ol className="lb-list">
              {loading
                ? Array.from({ length: playersPerPage }).map((_, index) => (
                  <li key={`skeleton-${index}`} aria-hidden="true">
                    <div className="lb-row is-skeleton">
                      <span className="lb-col-rank"><span className="lb-skeleton lb-skeleton-rank" /></span>
                      <span className="lb-col-player">
                        <span className="lb-skeleton lb-skeleton-name" style={{ width: `${50 + ((index * 37) % 40)}%` }} />
                      </span>
                      <span className="lb-col-stat"><span className="lb-skeleton lb-skeleton-stat" /></span>
                      <span className="lb-col-stat"><span className="lb-skeleton lb-skeleton-stat" /></span>
                      <span className="lb-col-stat"><span className="lb-skeleton lb-skeleton-stat" /></span>
                    </div>
                  </li>
                ))
                : paginatedPlayers.map((player, index) => {
                  const globalRank = (currentPage - 1) * playersPerPage + index + 1
                  return (
                    <li key={player.id}>
                      <button
                        type="button"
                        className="lb-row"
                        onClick={() => handlePlayerClick(player)}
                        title={t('leaderboard.viewPlayerProfile')}
                      >
                        <span className="lb-col-rank"><RankBadge rank={globalRank} /></span>
                        <span className="lb-col-player">{player.name}</span>
                        <span className="lb-col-stat">{player.wins}</span>
                        <span className="lb-col-stat lb-winrate">{player.winRate}%</span>
                        <span className="lb-col-stat lb-elo">{player.elo || 1000}</span>
                      </button>
                    </li>
                  )
                })}
            </ol>
          </div>

          <nav className="lb-pagination">
            <button
              type="button"
              className="lb-page-button"
              onClick={handlePreviousPage}
              disabled={loading || currentPage === 1}
            >
              {t('common.previous')}
            </button>
            <span className="lb-page-status">
              {loading ? '- / -' : t('leaderboard.pageOf', { current: currentPage, total: totalPages || 1 })}
            </span>
            <button
              type="button"
              className="lb-page-button"
              onClick={handleNextPage}
              disabled={loading || currentPage === totalPages || totalPages === 0}
            >
              {t('common.next')}
            </button>
          </nav>
        </>
      )}
    </div>
  )
}

export default Leaderboard