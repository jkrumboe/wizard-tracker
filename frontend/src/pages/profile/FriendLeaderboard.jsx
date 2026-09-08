import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getFriendLeaderboard } from '@/shared/api/gameService'
import { userService } from '@/shared/api'
import { useUser } from '@/shared/hooks/useUser'
import { sanitizeImageUrl } from '@/shared/utils/urlSanitizer'
import {
  ArrowLeftIcon,
  ArrowLeftCircleIcon,
  ExternalLinkIcon,
  SearchIcon,
  TrophyIcon,
  UsersIcon,
  GamepadIcon,
  TrendingUpIcon,
} from '@/components/ui/Icon'
import "@/styles/pages/friend-leaderboard.css"

const STORAGE_KEYS = {
  players: 'friendLeaderboard_selectedPlayers',
  data: 'friendLeaderboard_data',
  gameType: 'friendLeaderboard_gameType',
  tab: 'friendLeaderboard_tab',
  scroll: 'friendLeaderboard_scroll',
  visibleGames: 'friendLeaderboard_visibleGames',
}

// The backend rejects a comparison with fewer than two names.
const MIN_PLAYERS = 2
const MAX_PLAYERS = 10
const GAMES_PAGE_SIZE = 10

// sessionStorage can throw (private mode, quota) and can hold corrupt JSON left
// by an older build. Restoring cached state must never take the page down.
const readSession = (key, fallback = null) => {
  try {
    const raw = sessionStorage.getItem(key)
    if (raw === null) return fallback
    const parsed = JSON.parse(raw)
    return parsed === null ? fallback : parsed
  } catch {
    try { sessionStorage.removeItem(key) } catch { /* nothing else to do */ }
    return fallback
  }
}

const readSessionRaw = (key, fallback = null) => {
  try {
    const raw = sessionStorage.getItem(key)
    return raw === null ? fallback : raw
  } catch {
    return fallback
  }
}

const writeSession = (key, value) => {
  try {
    sessionStorage.setItem(key, value)
  } catch { /* storage unavailable - state just will not persist */ }
}

const removeSession = (key) => {
  try {
    sessionStorage.removeItem(key)
  } catch { /* nothing else to do */ }
}

const FriendLeaderboard = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useUser()

  // Friends selection state
  const [friends, setFriends] = useState([])
  const [selectedPlayers, setSelectedPlayers] = useState(() => {
    const saved = readSession(STORAGE_KEYS.players, [])
    return Array.isArray(saved) ? saved : []
  })
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [friendSearch, setFriendSearch] = useState('')

  // Leaderboard data state
  const [leaderboardData, setLeaderboardData] = useState(() => {
    const saved = readSession(STORAGE_KEYS.data, null)
    return saved && Array.isArray(saved.leaderboard) ? saved : null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Game type state
  const [selectedGameType, setSelectedGameType] = useState(
    () => readSessionRaw(STORAGE_KEYS.gameType, 'all') || 'all'
  )
  const [gameTypes, setGameTypes] = useState(() => {
    const saved = readSession(STORAGE_KEYS.data, null)
    return Array.isArray(saved?.gameTypes) ? saved.gameTypes : []
  })

  // UI state - start on the results view if we restored usable data
  const [showPlayerSelect, setShowPlayerSelect] = useState(() => {
    const saved = readSession(STORAGE_KEYS.data, null)
    return !(saved && Array.isArray(saved.leaderboard))
  })

  // Tab and list position survive navigating to a game and coming back
  const [activeTab, setActiveTab] = useState(
    () => readSessionRaw(STORAGE_KEYS.tab, 'ranking') || 'ranking'
  )
  const [visibleGames, setVisibleGames] = useState(() => {
    const saved = Number(readSessionRaw(STORAGE_KEYS.visibleGames, ''))
    return Number.isFinite(saved) && saved >= GAMES_PAGE_SIZE ? saved : GAMES_PAGE_SIZE
  })

  const panelRef = useRef(null)
  const scrollFrame = useRef(0)
  const didRestoreScroll = useRef(false)

  // Persist selected players to sessionStorage
  useEffect(() => {
    writeSession(STORAGE_KEYS.players, JSON.stringify(selectedPlayers))
  }, [selectedPlayers])

  // Persist leaderboard data to sessionStorage
  useEffect(() => {
    if (leaderboardData) {
      writeSession(STORAGE_KEYS.data, JSON.stringify(leaderboardData))
    }
  }, [leaderboardData])

  // Persist game type to sessionStorage
  useEffect(() => {
    writeSession(STORAGE_KEYS.gameType, selectedGameType)
  }, [selectedGameType])

  useEffect(() => {
    writeSession(STORAGE_KEYS.tab, activeTab)
  }, [activeTab])

  useEffect(() => {
    writeSession(STORAGE_KEYS.visibleGames, String(visibleGames))
  }, [visibleGames])

  useEffect(() => () => {
    if (scrollFrame.current) cancelAnimationFrame(scrollFrame.current)
  }, [])

  // Flush the current offset immediately - the throttled handler may not have
  // fired for the last scroll before the user navigated away.
  const persistScroll = () => {
    const el = panelRef.current
    if (el) writeSession(STORAGE_KEYS.scroll, String(el.scrollTop))
  }

  // Remember where the user was in the list, throttled to one write per frame
  const handlePanelScroll = () => {
    if (scrollFrame.current) return
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0
      const el = panelRef.current
      if (el) writeSession(STORAGE_KEYS.scroll, String(el.scrollTop))
    })
  }

  // Restore the saved scroll offset once, on the first render that has content
  useLayoutEffect(() => {
    if (didRestoreScroll.current) return
    if (showPlayerSelect || !leaderboardData) return
    const el = panelRef.current
    if (!el) return

    didRestoreScroll.current = true
    const saved = Number(readSessionRaw(STORAGE_KEYS.scroll, '0'))
    if (Number.isFinite(saved) && saved > 0) {
      el.scrollTop = saved
    }
  }, [showPlayerSelect, leaderboardData])

  const loadFriends = useCallback(async () => {
    setLoadingFriends(true)
    try {
      let friendsList = []

      if (user?.id) {
        // Fetch from server if logged in
        try {
          friendsList = await userService.getFriends(user.id)
        } catch (err) {
          console.warn('Failed to fetch friends from server:', err)
          friendsList = []
        }
      } else {
        // Not logged in - don't show any friends
        friendsList = []
      }

      setFriends(Array.isArray(friendsList) ? friendsList : [])
    } catch (err) {
      console.error('Error loading friends:', err)
      setFriends([])
    } finally {
      setLoadingFriends(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadFriends()
  }, [loadFriends])

  const filteredFriends = useMemo(() => {
    const term = friendSearch.trim().toLowerCase()
    if (!term) return friends
    return friends.filter(f => f.username?.toLowerCase().includes(term))
  }, [friends, friendSearch])

  const togglePlayerSelection = (player) => {
    setSelectedPlayers(prev => {
      const isSelected = prev.some(p => p.id === player.id)
      if (isSelected) {
        return prev.filter(p => p.id !== player.id)
      }
      if (prev.length >= MAX_PLAYERS - 1) {
        return prev // the signed-in user always occupies one slot
      }
      return [...prev, player]
    })
  }

  const clearSelection = () => setSelectedPlayers([])

  // Names sent to the API: the signed-in user is always part of the comparison.
  const buildPlayerNames = useCallback(() => {
    const names = selectedPlayers.map(p => p.username).filter(Boolean)
    if (user?.username && !names.includes(user.username)) {
      names.unshift(user.username)
    }
    return names
  }, [selectedPlayers, user?.username])

  // A fresh comparison starts at the top of the list again
  const resetListPosition = () => {
    setVisibleGames(GAMES_PAGE_SIZE)
    writeSession(STORAGE_KEYS.scroll, '0')
    if (panelRef.current) panelRef.current.scrollTop = 0
  }

  const fetchLeaderboard = async (gameTypeOverride) => {
    // Ignore event objects passed by onClick handlers
    const effectiveGameType = (typeof gameTypeOverride === 'string') ? gameTypeOverride : undefined

    const playerNames = buildPlayerNames()

    if (playerNames.length < MIN_PLAYERS) {
      // Happens when signed out, or when the only pick is the user themselves.
      setError(t('leaderboard.needTwoPlayers'))
      setShowPlayerSelect(true)
      return
    }

    setLoading(true)
    setError(null)
    setShowPlayerSelect(false)

    try {
      const gt = effectiveGameType !== undefined ? effectiveGameType : selectedGameType
      const data = await getFriendLeaderboard(playerNames, gt)
      const shared = Array.isArray(data?.gameTypes) ? data.gameTypes : []

      // A game type restored from a previous comparison may not be shared by
      // this player set. Fall back to all types rather than showing nothing.
      if (gt !== 'all' && !shared.includes(gt)) {
        setSelectedGameType('all')
        const fallback = await getFriendLeaderboard(playerNames, 'all')
        setLeaderboardData(fallback)
        setGameTypes(Array.isArray(fallback?.gameTypes) ? fallback.gameTypes : [])
        resetListPosition()
        return
      }

      setLeaderboardData(data)
      setGameTypes(shared)
      resetListPosition()
    } catch (err) {
      console.error('Error fetching friend leaderboard:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGameTypeChange = (e) => {
    const newType = e.target.value
    setSelectedGameType(newType)
    fetchLeaderboard(newType)
  }

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    // Each tab is a different list, so start it at the top
    writeSession(STORAGE_KEYS.scroll, '0')
    if (panelRef.current) panelRef.current.scrollTop = 0
  }

  const navigateToGame = (game) => {
    if (!game?.id) return
    persistScroll()
    const gameType = String(game.type || '').toLowerCase()
    const isScoreboardGame = gameType.includes('scoreboard') || gameType.includes('volleyball') || String(game.id).startsWith('scoreboard_game_')
    const route = game.type === 'Wizard'
      ? `/game/${game.id}`
      : (isScoreboardGame ? `/scoreboard-game/${game.id}` : `/table-game/${game.id}`)
    navigate(route)
  }

  const resetSelection = () => {
    setShowPlayerSelect(true)
    setLeaderboardData(null)
    setError(null)
    setSelectedGameType('all')
    setGameTypes([])
    setActiveTab('ranking')
    setVisibleGames(GAMES_PAGE_SIZE)
    didRestoreScroll.current = false
    removeSession(STORAGE_KEYS.data)
    removeSession(STORAGE_KEYS.gameType)
    removeSession(STORAGE_KEYS.scroll)
  }

  const handlePlayerClick = (playerName) => {
    persistScroll()
    navigate(`/user/${playerName}`)
  }

  const handleSelectionPageBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate('/account')
  }

  const board = useMemo(
    () => (Array.isArray(leaderboardData?.leaderboard) ? leaderboardData.leaderboard : []),
    [leaderboardData]
  )

  const recentGames = useMemo(
    () => (Array.isArray(leaderboardData?.recentGames) ? leaderboardData.recentGames : []),
    [leaderboardData]
  )

  const summary = useMemo(() => {
    if (!board.length) return null
    const myName = user?.username?.toLowerCase()
    const meIndex = myName ? board.findIndex(p => p.name === myName) : -1
    return {
      sharedGames: leaderboardData?.totalSharedGames ?? 0,
      players: board.length,
      leader: board[0],
      myRank: meIndex >= 0 ? meIndex + 1 : null,
    }
  }, [board, leaderboardData?.totalSharedGames, user?.username])

  const lowIsBetter = useMemo(() => {
    if (!selectedGameType || selectedGameType === 'all') return false
    return Boolean(leaderboardData?.gameTypeSettings?.[selectedGameType]?.lowIsBetter)
  }, [leaderboardData?.gameTypeSettings, selectedGameType])

  const tabs = useMemo(() => {
    const list = [{ id: 'ranking', label: t('leaderboard.tabRanking') }]
    if (board.length > 1) list.push({ id: 'h2h', label: t('leaderboard.headToHead') })
    if (recentGames.length > 0) list.push({ id: 'games', label: t('leaderboard.gamesHeader') })
    return list
  }, [board.length, recentGames.length, t])

  // Fall back to the ranking tab when the active one is not available for this
  // comparison (e.g. a single player has no head-to-head).
  const currentTab = tabs.some(tab => tab.id === activeTab) ? activeTab : 'ranking'

  const isCurrentUser = (player) =>
    Boolean(user?.username) && player.name === user.username.toLowerCase()

  const renderPlayerCard = (player, index) => {
    const wins = player.wins || 0
    const losses = player.losses || 0
    const draws = player.draws || 0
    const decided = wins + losses + draws
    const streak = player.streak

    return (
      <article
        key={player.name}
        className={`flb-player-card ${isCurrentUser(player) ? 'is-me' : ''}`}
      >
        <header className="flb-player-head">
          <span className={`flb-rank rank-${index + 1}`}>{index + 1}</span>

          <button
            type="button"
            className="flb-player-name-btn"
            onClick={() => handlePlayerClick(player.displayName)}
            title={t('leaderboard.viewPlayerProfile')}
          >
            <span className="flb-player-name">{player.displayName}</span>
            {isCurrentUser(player) && (
              <span className="flb-you-badge">{t('leaderboard.you')}</span>
            )}
          </button>

          <span className="flb-elo-chip">
            <span className="flb-elo-value">{player.elo ?? '-'}</span>
            <span className="flb-elo-caption">
              {player.eloPeak
                ? `${t('leaderboard.peakShort')} ${player.eloPeak}`
                : t('leaderboard.eloHeader')}
            </span>
          </span>
        </header>

        {decided > 0 && (
          <div className="flb-record">
            <div className="flb-record-bar" aria-hidden="true">
              {wins > 0 && <span className="seg win" style={{ flexGrow: wins }} />}
              {draws > 0 && <span className="seg draw" style={{ flexGrow: draws }} />}
              {losses > 0 && <span className="seg loss" style={{ flexGrow: losses }} />}
            </div>
            <div className="flb-record-legend">
              <span className="win">{wins} {t('leaderboard.winsHeader')}</span>
              {draws > 0 && <span className="draw">{draws} {t('leaderboard.drawsHeader')}</span>}
              <span className="loss">{losses} {t('leaderboard.lossesHeader')}</span>
            </div>
          </div>
        )}

        <div className="flb-stat-row">
          <div className="flb-stat">
            <span className="flb-stat-value">{player.totalGames ?? 0}</span>
            <span className="flb-stat-label">{t('leaderboard.gamesHeader')}</span>
          </div>
          <div className="flb-stat">
            <span className="flb-stat-value">{player.winRate}%</span>
            <span className="flb-stat-label">{t('leaderboard.winPercentHeader')}</span>
          </div>
          <div className="flb-stat">
            <span className="flb-stat-value">{player.avgScore}</span>
            <span className="flb-stat-label">
              {t('leaderboard.avgScoreHeader')}
              {lowIsBetter && ` (${t('leaderboard.lowIsBetter')})`}
            </span>
          </div>
          <div className="flb-stat">
            <span
              className={`flb-stat-value ${streak?.count
                ? (streak.type === 'W' ? 'streak-positive' : 'streak-negative')
                : ''}`}
            >
              {streak?.count ? `${streak.type === 'W' ? 'W' : 'L'}${streak.count}` : '-'}
            </span>
            <span className="flb-stat-label">{t('leaderboard.streakHeader')}</span>
          </div>
        </div>
      </article>
    )
  }

  if (loadingFriends) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <h2>{t('leaderboard.loadingFriends')}</h2>
      </div>
    )
  }

  return (
    <div className={`friend-leaderboard-container ${showPlayerSelect ? 'is-selecting' : 'is-results'}`}>
      {showPlayerSelect ? (
        <div className="friend-leaderboard-top-header">
          <button
            className="friend-page-back-button"
            onClick={handleSelectionPageBack}
            title={t('common.back')}
            aria-label={t('common.back')}
          >
            <ArrowLeftCircleIcon size={24} />
          </button>

          <div className="friend-leaderboard-header-text">
            <h1>{t('leaderboard.friendTitle')}</h1>
          </div>
        </div>
      ) : (
        <h1>{t('leaderboard.friendTitle')}</h1>
      )}

      {showPlayerSelect ? (
        <>
          <div className="player-selection-section">
            <div className="selection-header">
              <h2>
                {t('leaderboard.selectFriendsCount', {
                  count: selectedPlayers.length,
                  max: MAX_PLAYERS - 1,
                })}
              </h2>
              {selectedPlayers.length > 0 && (
                <button className="flb-text-button" onClick={clearSelection}>
                  {t('leaderboard.clearSelection')}
                </button>
              )}
            </div>

            {user?.username && (
              <p className="flb-selection-hint">
                {t('leaderboard.youAreAlwaysIncluded', { name: user.username })}
              </p>
            )}

            {friends.length > 6 && (
              <div className="flb-search">
                <SearchIcon size={16} />
                <input
                  type="text"
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  placeholder={t('leaderboard.searchPlaceholder')}
                  aria-label={t('leaderboard.searchPlaceholder')}
                />
              </div>
            )}

            {/* Friends list */}
            <div className="friends-list">
              {friends.length === 0 ? (
                <div className="empty-friends">
                  <p>{t('leaderboard.noFriendsYet')}</p>
                  <p>{t('leaderboard.addFriendsToCompare')}</p>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="empty-friends">
                  <p>{t('leaderboard.noFriendsMatchSearch')}</p>
                </div>
              ) : (
                filteredFriends.map(friend => {
                  const isSelected = selectedPlayers.some(p => p.id === friend.id)
                  const atLimit = !isSelected && selectedPlayers.length >= MAX_PLAYERS - 1
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      className={`friend-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => togglePlayerSelection(friend)}
                      disabled={atLimit}
                      aria-pressed={isSelected}
                    >
                      {friend.profilePicture ? (
                        <img
                          src={sanitizeImageUrl(friend.profilePicture, '')}
                          alt=""
                          className="friend-avatar"
                        />
                      ) : (
                        <span className="friend-avatar-placeholder">
                          {friend.username?.[0]?.toUpperCase()}
                        </span>
                      )}
                      <span className="friend-name">{friend.username}</span>
                      <span className={`select-indicator ${isSelected ? 'checked' : ''}`}>
                        {isSelected ? '✓' : ''}
                      </span>
                    </button>
                  )
                })
              )}
            </div>

            {error && <div className="error-message">{error}</div>}
          </div>

          <button
            className="compare-btn"
            onClick={fetchLeaderboard}
            disabled={selectedPlayers.length < 1}
          >
            {t('leaderboard.compare')}
          </button>
        </>
      ) : (
        <div className="leaderboard-results">
          <div className="flb-results-toolbar">
            <button className="back-btn" onClick={resetSelection}>
              <ArrowLeftIcon size={18} />
              <span>{t('leaderboard.changePlayers')}</span>
            </button>

            {/* Only game types these players actually share are offered */}
            {gameTypes.length > 1 && (
              <select
                value={selectedGameType}
                onChange={handleGameTypeChange}
                className="game-type-selector"
                disabled={loading}
                aria-label={t('leaderboard.allGameTypes')}
              >
                <option value="all">{t('leaderboard.allGameTypes')}</option>
                {gameTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            )}
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <h2>{t('leaderboard.calculatingStats')}</h2>
            </div>
          ) : error ? (
            <div className="error-container">
              <h2>{t('common.error')}</h2>
              <p>{error}</p>
              <button onClick={() => fetchLeaderboard()} className="retry-button">
                {t('common.retry')}
              </button>
            </div>
          ) : leaderboardData ? (
            <>
              {/* Summary strip */}
              {summary && (
                <div className="flb-summary">
                  <div className="flb-summary-tile">
                    <span className="flb-summary-value">{summary.sharedGames}</span>
                    <span className="flb-summary-label">{t('leaderboard.summarySharedGames')}</span>
                  </div>
                  <div className="flb-summary-tile">
                    <span className="flb-summary-value">{summary.players}</span>
                    <span className="flb-summary-label">{t('leaderboard.summaryPlayers')}</span>
                  </div>
                  <div className="flb-summary-tile">
                    <span
                      className="flb-summary-value flb-summary-name"
                      title={summary.leader.displayName}
                    >
                      {summary.leader.displayName}
                    </span>
                    <span className="flb-summary-label">{t('leaderboard.summaryLeader')}</span>
                  </div>
                  {summary.myRank && (
                    <div className="flb-summary-tile">
                      <span className="flb-summary-value">#{summary.myRank}</span>
                      <span className="flb-summary-label">{t('leaderboard.summaryYourRank')}</span>
                    </div>
                  )}
                </div>
              )}

              {board.length === 0 ? (
                <div className="flb-panel no-games-message">
                  <p>{t('leaderboard.noGamesBetweenPlayers')}</p>
                  <p>{t('leaderboard.playGamesTogether')}</p>
                </div>
              ) : (
                <>
                  {tabs.length > 1 && (
                    <div className="flb-tabs" role="tablist">
                      {tabs.map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={currentTab === tab.id}
                          className={`flb-tab ${currentTab === tab.id ? 'active' : ''}`}
                          onClick={() => handleTabChange(tab.id)}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div
                    className="flb-tab-panel"
                    ref={panelRef}
                    onScroll={handlePanelScroll}
                  >
                    {currentTab === 'ranking' && (
                      <div className="flb-player-list">
                        {board.map(renderPlayerCard)}
                      </div>
                    )}

                    {currentTab === 'h2h' && (
                      <div className="flb-panel">
                        <div className="h2h-matrix">
                          <table>
                            <thead>
                              <tr>
                                <th className="h2h-corner"></th>
                                {board.map(p => (
                                  <th key={p.name} className="h2h-header" title={p.displayName}>
                                    {p.displayName.slice(0, 8)}{p.displayName.length > 8 ? '…' : ''}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {board.map(player => (
                                <tr key={player.name}>
                                  <td className="h2h-player-name" title={player.displayName}>
                                    {player.displayName}
                                  </td>
                                  {board.map(opponent => {
                                    if (player.name === opponent.name) {
                                      return <td key={opponent.name} className="h2h-self">—</td>
                                    }
                                    const h2h = leaderboardData.headToHead?.[player.name]?.[opponent.name]
                                    if (!h2h || h2h.games === 0) {
                                      return <td key={opponent.name} className="h2h-no-games">-</td>
                                    }
                                    const winClass = h2h.wins > h2h.losses
                                      ? 'positive'
                                      : h2h.wins < h2h.losses ? 'negative' : 'neutral'
                                    return (
                                      <td
                                        key={opponent.name}
                                        className={`h2h-record ${winClass}`}
                                        title={t('leaderboard.h2hCellTitle', {
                                          player: player.displayName,
                                          opponent: opponent.displayName,
                                          games: h2h.games,
                                        })}
                                      >
                                        <span className="wins">{h2h.wins}</span>
                                        <span className="sep">-</span>
                                        <span className="losses">{h2h.losses}</span>
                                        {h2h.draws > 0 && <span className="draws">-{h2h.draws}</span>}
                                      </td>
                                    )
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="h2h-legend">{t('leaderboard.h2hLegend')}</p>
                      </div>
                    )}

                    {currentTab === 'games' && (
                      <div className="flb-games-list">
                        {recentGames.slice(0, visibleGames).map((game, index) => (
                          <article key={game.id ?? index} className="flb-game-card">
                            <header className="flb-game-head">
                              <span className="flb-game-type">{game.type}</span>
                              <span className="flb-game-meta">
                                <span className="flb-game-date">
                                  {new Date(game.date).toLocaleDateString()}
                                </span>
                                <button
                                  type="button"
                                  className="flb-game-open"
                                  onClick={() => navigateToGame(game)}
                                  title={t('leaderboard.viewGameDetails')}
                                  aria-label={t('leaderboard.viewGameDetails')}
                                >
                                  <ExternalLinkIcon size={14} />
                                </button>
                              </span>
                            </header>

                            <ul className="flb-game-players">
                              {game.players.map((p, i) => (
                                <li key={i} className={`flb-game-player ${p.won ? 'winner' : ''}`}>
                                  <span className="flb-gp-name">
                                    {p.won && <TrophyIcon size={13} />}
                                    {p.name}
                                  </span>
                                  <span className="flb-gp-right">
                                    {p.eloChange != null && (
                                      <span
                                        className={`elo-badge ${p.eloChange > 0
                                          ? 'positive'
                                          : p.eloChange < 0 ? 'negative' : ''}`}
                                      >
                                        {p.eloChange > 0 ? '+' : ''}{p.eloChange}
                                      </span>
                                    )}
                                    <span className="flb-gp-score">{p.score}</span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </article>
                        ))}

                        {recentGames.length > visibleGames && (
                          <button
                            type="button"
                            className="flb-show-more"
                            onClick={() => setVisibleGames(v => v + GAMES_PAGE_SIZE)}
                          >
                            {t('leaderboard.showMoreGames', {
                              count: recentGames.length - visibleGames,
                            })}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default FriendLeaderboard
