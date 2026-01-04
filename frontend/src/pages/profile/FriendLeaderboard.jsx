import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFriendLeaderboard } from '@/shared/api/gameService'
import { localFriendsService, userService } from '@/shared/api'
import { useUser } from '@/shared/hooks/useUser'
import { sanitizeImageUrl } from '@/shared/utils/urlSanitizer'
import { ArrowLeftIcon } from '@/components/ui/Icon'
import "@/styles/pages/friend-leaderboard.css"

const FriendLeaderboard = () => {
  const navigate = useNavigate()
  const { user, isLoggedIn } = useUser()
  
  // Friends selection state
  const [friends, setFriends] = useState([])
  const [selectedPlayers, setSelectedPlayers] = useState(() => {
    const saved = sessionStorage.getItem('friendLeaderboard_selectedPlayers')
    return saved ? JSON.parse(saved) : []
  })
  const [loadingFriends, setLoadingFriends] = useState(true)
  
  // Leaderboard data state
  const [leaderboardData, setLeaderboardData] = useState(() => {
    const saved = sessionStorage.getItem('friendLeaderboard_data')
    return saved ? JSON.parse(saved) : null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // UI state - start on compare page if we have saved data
  const [showPlayerSelect, setShowPlayerSelect] = useState(() => {
    const savedData = sessionStorage.getItem('friendLeaderboard_data')
    return !savedData
  })
  
  // Persist selected players to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('friendLeaderboard_selectedPlayers', JSON.stringify(selectedPlayers))
  }, [selectedPlayers])
  
  // Persist leaderboard data to sessionStorage
  useEffect(() => {
    if (leaderboardData) {
      sessionStorage.setItem('friendLeaderboard_data', JSON.stringify(leaderboardData))
    }
  }, [leaderboardData])

  const loadFriends = useCallback(async () => {
    setLoadingFriends(true)
    try {
      let friendsList = []
      
      if (isLoggedIn && user?.id) {
        // Fetch from server if logged in
        try {
          friendsList = await userService.getFriends(user.id)
        } catch (err) {
          console.warn('Failed to fetch friends from server:', err)
          // Fall back to local storage
          friendsList = await localFriendsService.getAllFriends()
        }
      } else {
        // Use local storage for non-logged-in users
        friendsList = await localFriendsService.getAllFriends()
      }
      
      setFriends(friendsList || [])
    } catch (err) {
      console.error('Error loading friends:', err)
      setFriends([])
    } finally {
      setLoadingFriends(false)
    }
  }, [isLoggedIn, user?.id])

  useEffect(() => {
    loadFriends()
  }, [loadFriends])

  const togglePlayerSelection = (player) => {
    setSelectedPlayers(prev => {
      const isSelected = prev.some(p => p.id === player.id)
      if (isSelected) {
        return prev.filter(p => p.id !== player.id)
      } else {
        if (prev.length >= 10) {
          return prev // Max 10 players
        }
        return [...prev, player]
      }
    })
  }

  const addCurrentUser = () => {
    if (!user || !user.username) return
    
    const isAlreadySelected = selectedPlayers.some(
      p => p.username?.toLowerCase() === user.username.toLowerCase()
    )
    
    if (!isAlreadySelected && selectedPlayers.length < 10) {
      setSelectedPlayers(prev => [...prev, {
        id: user.id,
        username: user.username,
        profilePicture: user.profilePicture,
        isCurrentUser: true
      }])
    }
  }

  const fetchLeaderboard = async () => {
    if (selectedPlayers.length < 2) {
      setError('Please select at least 2 players')
      return
    }
    
    setLoading(true)
    setError(null)
    setShowPlayerSelect(false)
    
    try {
      const playerNames = selectedPlayers.map(p => p.username)
      const data = await getFriendLeaderboard(playerNames)
      setLeaderboardData(data)
    } catch (err) {
      console.error('Error fetching friend leaderboard:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const resetSelection = () => {
    setShowPlayerSelect(true)
    setLeaderboardData(null)
    setError(null)
    sessionStorage.removeItem('friendLeaderboard_data')
  }

  const handlePlayerClick = (playerName) => {
    navigate(`/user/${playerName}`)
  }

  if (loadingFriends) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <h2>Loading Friends...</h2>
      </div>
    )
  }

  return (
    <div className="friend-leaderboard-container">
      <h1>Friend Leaderboard</h1>
      <p className="subtitle">Compare stats between you and your friends</p>
      
      {showPlayerSelect ? (
        <div className="player-selection-section">
          <div className="selection-header">
            <h2>Select Players ({selectedPlayers.length}/10)</h2>
            {isLoggedIn && user?.username && (
              <button 
                className="add-me-btn"
                onClick={addCurrentUser}
                disabled={selectedPlayers.some(p => p.isCurrentUser)}
              >
                + Add Me
              </button>
            )}
          </div>
          
          {/* Selected players */}
          {/* {selectedPlayers.length > 0 && (
            <div className="selected-players">
              {selectedPlayers.map(player => (
                <div 
                  key={player.id} 
                  className="selected-player-chip"
                  onClick={() => togglePlayerSelection(player)}
                >
                  {player.profilePicture ? (
                    <img 
                      src={sanitizeImageUrl(player.profilePicture, '')} 
                      alt={player.username}
                      className="chip-avatar"
                    />
                  ) : (
                    <div className="chip-avatar-placeholder">
                      {player.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <span>{player.username}</span>
                  <span className="remove-chip">×</span>
                </div>
              ))}
            </div>
          )} */}
          
          {/* Friends list */}
          <div className="friends-list">
            {friends.length === 0 ? (
              <div className="empty-friends">
                <p>No friends added yet.</p>
                <p>Add friends to compare your game statistics!</p>
              </div>
            ) : (
              friends.map(friend => {
                const isSelected = selectedPlayers.some(p => p.id === friend.id)
                return (
                  <div 
                    key={friend.id}
                    className={`friend-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => togglePlayerSelection(friend)}
                  >
                    {friend.profilePicture ? (
                      <img 
                        src={sanitizeImageUrl(friend.profilePicture, '')} 
                        alt={friend.username}
                        className="friend-avatar"
                      />
                    ) : (
                      <div className="friend-avatar-placeholder">
                        {friend.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="friend-name">{friend.username}</span>
                    <div className={`select-indicator ${isSelected ? 'checked' : ''}`}>
                      {isSelected ? '✓' : ''}
                    </div>
                  </div>
                )
              })
            )}
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button 
            className="compare-btn"
            onClick={fetchLeaderboard}
            disabled={selectedPlayers.length < 2}
          >
            Compare Players ({selectedPlayers.length} selected)
          </button>
        </div>
      ) : (
        <div className="leaderboard-results">
          <button className="back-btn" onClick={resetSelection}>
            <ArrowLeftIcon size={18} /> <span>Change Players</span>
          </button>
          
          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <h2>Calculating stats...</h2>
            </div>
          ) : error ? (
            <div className="error-container">
              <h2>Error</h2>
              <p>{error}</p>
              <button onClick={fetchLeaderboard} className="retry-button">
                Retry
              </button>
            </div>
          ) : leaderboardData ? (
            <>
              {/* Main leaderboard */}
              <div className="leaderboard-table">
                <div className="leaderboard-header">
                  <div className="rank-col"/>
                  <div className="player-col">Player</div>
                  <div className="wins-col">Wins</div>
                  <div className="losses-col">Losses</div>
                  <div className="winrate-col">Win%</div>
                  <div className="score-col">Ø Score</div>
                </div>
                
                <div className="leaderboard-body">
                  {leaderboardData.leaderboard.length === 0 ? (
                    <div className="no-games-message">
                      <p>No games found between these players.</p>
                      <p>Play some games together to see your stats!</p>
                    </div>
                  ) : (
                    leaderboardData.leaderboard.map((player, index) => (
                      <div key={player.name} className="leaderboard-row">
                        <div className={`rank-col ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}`}>
                          {index + 1}
                        </div>
                        <div 
                          className="player-col clickable"
                          onClick={() => handlePlayerClick(player.displayName)}
                        >
                          {player.displayName}
                        </div>
                        <div className="wins-col">{player.wins}</div>
                        <div className="losses-col">{player.losses}</div>
                        <div className="winrate-col">{player.winRate}%</div>
                        <div className="score-col">{player.avgScore}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* Head-to-Head Matrix */}
              {leaderboardData.leaderboard.length > 1 && (
                <div className="head-to-head-section">
                  <h2>Head-to-Head</h2>
                  <div className="h2h-matrix">
                    <table>
                      <thead>
                        <tr>
                          <th></th>
                          {leaderboardData.leaderboard.map(p => (
                            <th key={p.name} className="h2h-header">
                              {p.displayName.slice(0, 8)}{p.displayName.length > 8 ? '...' : ''}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboardData.leaderboard.map(player => (
                          <tr key={player.name}>
                            <td className="h2h-player-name">{player.displayName}</td>
                            {leaderboardData.leaderboard.map(opponent => {
                              if (player.name === opponent.name) {
                                return <td key={opponent.name} className="h2h-self">-</td>
                              }
                              const h2h = leaderboardData.headToHead[player.name]?.[opponent.name]
                              if (!h2h || h2h.games === 0) {
                                return <td key={opponent.name} className="h2h-no-games">-</td>
                              }
                              const winClass = h2h.wins > h2h.losses ? 'positive' : h2h.wins < h2h.losses ? 'negative' : 'neutral'
                              return (
                                <td key={opponent.name} className={`h2h-record ${winClass}`}>
                                  <span className='wins'>{h2h.wins}</span>-<span className="losses">{h2h.losses}</span>
                                  -{h2h.draws > 0 && <span className="draws">{h2h.draws}</span>}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="h2h-legend">Win-Loss record (W-L or W-L-D with draws)</p>
                </div>
              )}
              
              {/* Recent Games */}
              {leaderboardData.recentGames?.length > 0 && (
                <div className="recent-games-section">
                  {/* <h2>Recent Games Together ({leaderboardData.totalSharedGames} total)</h2> */}
                  <div className="recent-games-list">
                    {leaderboardData.recentGames.map((game, index) => (
                      <div key={index} className="recent-game-card">
                        <div className="recent-game-card-top">
                          <div className="game-type-badge">{game.type}</div>
                          <div className="game-date">
                            {new Date(game.date).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="h2h-game-players">
                          {game.players.map((p, i) => (
                            <span 
                              key={i} 
                              className={`game-player ${p.won ? 'winner' : ''}`}
                            >
                              {p.name}: {p.score}
                              {p.won && ' 🏆'}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default FriendLeaderboard
