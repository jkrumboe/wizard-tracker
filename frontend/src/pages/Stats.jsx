import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import StatCard from '../components/StatCard'
import { getPlayerById } from '../services/playerService'
import { getPlayerGameHistory } from '../services/gameService'

const Stats = () => {
  const { id } = useParams()
  const [player, setPlayer] = useState(null)
  const [gameHistory, setGameHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('all')
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const playerData = await getPlayerById(id)
        setPlayer(playerData)
        
        const history = await getPlayerGameHistory(id)
        setGameHistory(history)
        
        setLoading(false)
      } catch (err) {
        console.error('Error fetching stats data:', err)
        setError('Failed to load player statistics')
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  const filteredHistory = () => {
    if (timeRange === 'all' || !gameHistory.length) return gameHistory
    
    const now = new Date()
    const cutoffDate = new Date()
    
    switch(timeRange) {
      case '3m': 
        cutoffDate.setMonth(now.getMonth() - 3)
        break
      case '6m': 
        cutoffDate.setMonth(now.getMonth() - 6)
        break
      case '1y': 
        cutoffDate.setFullYear(now.getFullYear() - 1)
        break
      default: 
        return gameHistory
    }
    
    return gameHistory.filter(game => new Date(game.date) >= cutoffDate)
  }

  const getPerformanceStats = () => {
    const history = filteredHistory()
    if (!history.length) return { games: 0 }
    
    const wins = history.filter(game => game.position === 1).length
    const totalGames = history.length
    const winRate = Math.round((wins / totalGames) * 100)
    const avgScore = Math.round(history.reduce((sum, game) => sum + game.score, 0) / totalGames)
    const avgPosition = parseFloat((history.reduce((sum, game) => sum + game.position, 0) / totalGames).toFixed(2))
    
    // Calculate ELO change
    const oldestGame = history[history.length - 1] // History is sorted newest first
    const newestGame = history[0]
    const eloChange = oldestGame && newestGame ? newestGame.elo - oldestGame.elo : 0
    
    return {
      games: totalGames,
      wins,
      winRate,
      avgPosition,
      avgScore,
      currentElo: player.elo,
      eloChange
    }
  }

  if (loading) {
    return <div className="loading">Loading statistics...</div>
  }

  if (error || !player) {
    return <div className="error">{error || 'Player not found'}</div>
  }

  const stats = getPerformanceStats()
  const chartData = filteredHistory().map(game => ({
    date: game.date,
    elo: player.elo // In a real app, we'd have ELO history
  }))

  return (
    <div className="stats-container">
      <div className="stats-header">
        <Link to={`/profile/${player.id}`} className="back-link">← Back to Profile</Link>
        <h1>{player.name}'s Performance History</h1>
      </div>

      <div className="time-range-filter">
        <button 
          className={`filter-btn ${timeRange === 'all' ? 'active' : ''}`}
          onClick={() => setTimeRange('all')}
        >
          All Time
        </button>
        <button 
          className={`filter-btn ${timeRange === '1y' ? 'active' : ''}`}
          onClick={() => setTimeRange('1y')}
        >
          Last Year
        </button>
        <button 
          className={`filter-btn ${timeRange === '6m' ? 'active' : ''}`}
          onClick={() => setTimeRange('6m')}
        >
          Last 6 Months
        </button>
        <button 
          className={`filter-btn ${timeRange === '3m' ? 'active' : ''}`}
          onClick={() => setTimeRange('3m')}
        >
          Last 3 Months
        </button>
      </div>

      <div className="stats-summary">
        <StatCard
          title="Games Played"
          value={stats.games}
        />
        <StatCard
          title="Win Rate"
          value={`${stats.winRate}%`}
        />
        <StatCard
          title="Current ELO"
          value={stats.currentElo}
          change={stats.eloChange}
        />
        <StatCard
          title="Avg Position"
          value={stats.avgPosition}
        />
        <StatCard
          title="Avg Score"
          value={stats.avgScore}
        />
      </div>

      <div className="chart-container">
        <h2>ELO Progress</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={['dataMin - 20', 'dataMax + 20']} />
            <Tooltip />
            <Line 
              type="monotone" 
              dataKey="elo" 
              stroke="#4A90E2" 
              activeDot={{ r: 8 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="game-history-table">
        <h2>Game History</h2>
        <div className="table-header">
          <div className="date-col">Date</div>
          <div className="position-col">Position</div>
          <div className="score-col">Score</div>
          <div className="elo-col">ELO</div>
          <div className="players-col">Players</div>
        </div>
        <div className="table-body">
          {filteredHistory().map(game => (
            <div key={game.id} className="table-row">
              <div className="date-col">{game.date}</div>
              <div className="position-col">{game.position}</div>
              <div className="score-col">{game.score}</div>
              <div className="elo-col">{player.elo}</div>
              <div className="players-col">{game.players}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Stats 