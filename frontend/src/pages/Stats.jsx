import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import StatCard from '../components/StatCard'
import PageTransition from '../components/PageTransition'
import { getPlayerById } from '../services/playerService'
import { getPlayerGameHistory } from '../services/gameService'

const Stats = () => {
  const { id } = useParams()
  const [player, setPlayer] = useState(null)
  const [gameHistory, setGameHistory] = useState([])
  const [eloHistory] = useState([]);
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


  if (error || !player) {
    return (
      <PageTransition isLoading={false}>
        <div className="error">{error || 'Player not found'}</div>
      </PageTransition>
    )
  }


  const chartData = [...eloHistory]
  .reverse()
  .map((entry) => ({
    date: new Date(entry.timestamp).toLocaleDateString("en-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    elo: entry.new_elo,
  }));

  return (
    <PageTransition isLoading={loading} loadingTitle="Loading Statistics..." loadingSubtitle="Analyzing player performance data">
    <div className="stats-container">
      <div className="stats-header">
        <Link to={`/profile/${player.id}`} className="back-link">← Back to Profile</Link>
        <h1>{player.display_name}'s Performance History</h1>
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
          value={player.total_games}
        />
        <StatCard
          title="Win Rate"
          value={`${player.total_losses === 0 ? '0' : ((player.total_wins / player.total_losses) * 100).toFixed(2)}%`}
        />
        <StatCard
          title="Current ELO"
          value={player.elo}
          // change={}
        />
        <StatCard
          title="Current Streak"
          value={player.current_streak}
        />
      </div>

      <div className="chart-container">
        <h2>ELO Progress</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 40, left: 10, bottom: 25 }}
          >
            <defs>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#4A90E2" />
                <stop offset="100%" stopColor="#50E3C2" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="1 0" stroke="#e0e0e0" />
            <XAxis dataKey="date" />
            <YAxis domain={['dataMin - 20', 'dataMax + 20']} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #ccc',
                borderRadius: '5px',
                padding: '10px',
              }}
              labelStyle={{ fontWeight: 'bold', color: '#333' }}
              cursor={{ stroke: '#ccc', strokeWidth: 1 }}
            />
            <Legend verticalAlign="top" height={36} />
            <Line
              type="monotone"
              dataKey="elo"
              stroke="url(#lineGradient)"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
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
          {filteredHistory().slice(0, 5).map(game => (
            <div key={game.id} className="table-row">              
              <div className="date-col">{
                new Date(game.created_at).toLocaleDateString("en-DE", {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                })}
              </div>
              <div className="position-col">
                {Object.keys(game.final_scores).sort((a, b) => game.final_scores[b] - game.final_scores[a]).indexOf(player.id.toString()) + 1}
              </div>
              <div className="score-col">{game.final_scores[player.id]}</div>
              <div className="elo-col">{Number(player.elo).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
    </PageTransition>
  )
}

export default Stats 