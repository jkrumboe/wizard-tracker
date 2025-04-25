import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import StatCard from '../components/StatCard'
import { getPlayerById, getEloHistory } from '../services/playerService'
import { getPlayerGameHistory } from '../services/gameService'

const Stats = () => {
  const { id } = useParams()
  const [player, setPlayer] = useState(null)
  const [gameHistory, setGameHistory] = useState([])
  const [eloHistory, setEloHistory] = useState([]);
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
    const fetchEloHistory = async () => {
      try {
        const elodata = await getEloHistory(id);
        console.log("eloHistory", elodata)
        setEloHistory(elodata);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEloHistory();
    fetchData()
  }, [id])

  console.log("eloHistory", eloHistory)

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

    console.log("filteredHistory", history)
    
    const wins = history.map(game => game.winner === player.id).filter(Boolean).length
    const totalGames = history.length
    const winRate = Math.round((wins / totalGames) * 100)
    const avgScore = Math.round(history.reduce((sum, game) => sum + (game.scores[player.id] || 0), 0) / totalGames)
    
    // Calculate ELO change
    const latestGame = eloHistory[0] // History is sorted newest first
    console.log("latestGame", latestGame)
    const eloChange = latestGame.new_elo - latestGame.old_elo
    console.log("eloChange", eloChange)
    // const eloChange = oldestGame && newestGame ? newestGame.elo - oldestGame.elo : 0
    
    return {
      games: totalGames,
      wins,
      winRate,
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

  const chartData = filteredHistory().map((game, index) => ({
    date: new Date(game.date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    elo: eloHistory[index]?.new_elo || 0 // Use ELO history if available, fallback to 0
  }))

  // console.log("eloHistory", eloHistory[index]?.new_elo)
  console.log("filteredHistory scores", filteredHistory().map(game => game.scores[player.id]))

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
          className={`filter-btn ${timeRange === '3m' ? 'active' : ''}`}
          onClick={() => setTimeRange('3m')}
        >
          Last 3 Months
        </button>
        <button 
          className={`filter-btn ${timeRange === '6m' ? 'active' : ''}`}
          onClick={() => setTimeRange('6m')}
        >
          Last 6 Months
        </button>
        <button 
          className={`filter-btn ${timeRange === '1y' ? 'active' : ''}`}
          onClick={() => setTimeRange('1y')}
        >
          Last Year
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
        </div>
        <div className="table-body">
          {filteredHistory().map(game => (
            <div key={game.id} className="table-row">
              <div className="date-col">{
                new Date(game.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div className="position-col">{game.positions}</div>
              <div className="score-col">{game.scores[player.id]}</div>
              <div className="elo-col">{player.elo}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Stats 