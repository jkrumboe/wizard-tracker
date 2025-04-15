import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import GameHistoryItem from '../components/GameHistoryItem'
import StatCard from '../components/StatCard'
import { getPlayerById, getPlayerStats } from '../services/playerService'
import { getPlayerGameHistory } from '../services/gameService'
import defaultAvatar from "../assets/default-avatar.png"; // Assuming the default avatar is stored in assets

const Profile = () => {
  const { id } = useParams()
  const [player, setPlayer] = useState(null)
  const [gameHistory, setGameHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [playerStats, setPlayerStats] = useState(null)
  const [activeTab, setActiveTab] = useState('performance') // State for active tab

  useEffect(() => {
    const fetchData = async () => {
      try {
        const playerData = await getPlayerById(id)
        setPlayer({
          ...playerData,
          avatar: playerData.avatar || defaultAvatar, // Use default avatar if none is provided
        });

        const history = await getPlayerGameHistory(id)
        setGameHistory(history)
        
        setLoading(false)
      } catch (err) {
        console.error('Error fetching profile data:', err)
        setError('Failed to load player profile')
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  useEffect(() => {
    const fetchPlayerStats = async () => {
      try {
        const stats = await getPlayerStats(player.id)
        setPlayerStats(stats)
      } catch (error) {
        console.error("Failed to fetch player stats", error)
      }
    }

    if (player) {
      fetchPlayerStats()
    }
  }, [player])

  if (loading) {
    return <div className="loading">Loading player profile...</div>
  }

  if (error || !player) {
    return <div className="error">{error || 'Player not found'}</div>
  }

  const recentGames = gameHistory.slice(0, 3)
  const winRate = player.winRate
  const lossRate = 100 - winRate

  const data = [
    { name: 'Wins', value: winRate },
    { name: 'Losses', value: lossRate }
  ]
  const COLORS = ['#00C49F', '#FF8042']

  return (
    <div className="profile-container">
      <div className="profile-header">
        <img src={player?.avatar || defaultAvatar} alt={player?.name || "Default Avatar"} className="avatar" />
        <div className="player-info">
          <h1>{player?.name || "Unknown Player"}</h1>
          <div className="tags-container">
            {player.tags.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
          <div className="stats-summary">
            <StatCard 
              title="ELO" 
              value={player.elo}
            />
            <StatCard 
              title="Games" 
              value={player.totalGames}
            />
            <StatCard 
              title="Win Rate" 
              value={`${winRate}%`}
            />
            <StatCard 
              title="Total Points"
              value={playerStats ? playerStats.totalPoints : 0}
            />
          </div>
        </div>
      </div>

      <div className="profile-content">
        <div className="card-tabs">
          <button 
            className={`tab-button ${activeTab === 'performance' ? 'active' : ''}`} 
            onClick={() => setActiveTab('performance')}
          >
            Performance
          </button>
          <button 
            className={`tab-button ${activeTab === 'recentGames' ? 'active' : ''}`} 
            onClick={() => setActiveTab('recentGames')}
          >
            Recent Games
          </button>
        </div>

          {activeTab === 'performance' && (
            <div className="stats-graph">
              <h2>Performance</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={data}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="chart-legend">
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: COLORS[0] }}></span>
                  <span>Wins ({winRate}%)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: COLORS[1] }}></span>
                  <span>Losses ({lossRate}%)</span>
                </div>
              </div>
              {playerStats && (
                <div className="player-stats">
                  <h2>Player Statistics</h2>
                  <p>Total Bids: {playerStats.totalBids}</p>
                  <p>Total Tricks: {playerStats.totalTricks}</p>
                  <p>Correct Bids: {playerStats.correctBids}</p>
                  <p>Bid Accuracy: {playerStats.bidAccuracy}%</p>
                  <p>Overbids: {playerStats.overbids}</p>
                  <p>Underbids: {playerStats.underbids}</p>
                  <p>Average Difference: {playerStats.avgDiff}</p>
                  <p>Total Points: {playerStats.totalPoints}</p>
                  <p>Average Points: {playerStats.avgPoints}</p>
                  <p>Highest Score: {playerStats.highestScore}</p>
                  <p>Lowest Score: {playerStats.lowestScore}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'recentGames' && (
            <div className="recent-games">
              <h2>Recent Games</h2>
              <div className="games-list">
                {recentGames.length > 0 ? (
                  recentGames.map(game => (
                    <GameHistoryItem key={game.id} game={game} />
                  ))
                ) : (
                  <div className="empty-message">No game history found</div>
                )}
              </div>
              <Link to={`/stats/${player.id}`} className="view-all-stats">
                View Complete Stats History
              </Link>
            </div>
          )}
      </div>
    </div>
  )
}

export default Profile