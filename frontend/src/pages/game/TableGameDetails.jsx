"use client"

import { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { getTableGameById } from "@/shared/api/tableGameService"
import { shareGame as shareGameUtil } from '@/shared/utils/gameSharing'
import StatsChart from "@/components/game/StatsChart"
import "@/styles/components/scorecard.css"
import "@/styles/components/statsChart.css"
import "@/styles/pages/gameDetails.css"
import "@/styles/components/TableGame.css"
import { ArrowLeftIcon, ShareIcon, TrophyIcon } from "@/components/ui/Icon"

const TableGameDetails = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('standings') // 'standings', 'chart', 'table'
  const [message, setMessage] = useState({ text: '', type: '' })
  const [isLandscape] = useState(() => {
    if (typeof window !== 'undefined' && globalThis.screen && globalThis.screen.orientation) {
      return globalThis.screen.orientation.type.startsWith('landscape')
    }
    return typeof window !== 'undefined' ? globalThis.innerWidth > globalThis.innerHeight : true
  })

  useEffect(() => {
    const fetchGameData = async () => {
      try {
        setLoading(true)
        const gameData = await getTableGameById(id)
        
        if (!gameData) {
          throw new Error("Game not found")
        }
        
        setGame(gameData)
        setLoading(false)
      } catch (err) {
        console.error("Error fetching table game details:", err)
        setError("Failed to load game details: " + err.message)
        setLoading(false)
      }
    }

    fetchGameData()
  }, [id])

  const handleShareGame = async () => {
    if (!game) return
    
    try {
      const shareData = {
        id: game.id || id,
        gameType: 'table',
        gameTypeName: game.gameTypeName || game.name || 'Table Game',
        ...game
      }
      
      await shareGameUtil(shareData)
      setMessage({ text: 'Game shared successfully!', type: 'success' })
      setTimeout(() => setMessage({ text: '', type: '' }), 3000)
    } catch (err) {
      console.error('Error sharing game:', err)
      setMessage({ text: 'Failed to share game', type: 'error' })
      setTimeout(() => setMessage({ text: '', type: '' }), 3000)
    }
  }

  if (loading) {
    return (
      <div className="game-details-container">
        <div className="loading-state">Loading game details...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="game-details-container">
        <div className="error-state">{error}</div>
        <button onClick={() => navigate(-1)} className="back-link">
          Go Back
        </button>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="game-details-container">
        <div className="error-state">Game not found</div>
        <button onClick={() => navigate(-1)} className="back-link">
          Go Back
        </button>
      </div>
    )
  }

  // Extract game data
  const gameData = game.gameData?.gameData || game.gameData || game
  const players = gameData.players || []
  const gameName = game.gameTypeName || game.name || gameData.gameName || 'Table Game'
  const lowIsBetter = game.lowIsBetter ?? gameData.lowIsBetter ?? false
  const rows = gameData.rows || 10
  const createdAt = game.createdAt || game.created_at

  // Format date
  const formattedDate = createdAt 
    ? new Date(createdAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Unknown date'

  // Calculate totals and rankings
  const getTotal = (player) => {
    return (player.points || []).reduce((sum, p) => sum + (Number.parseInt(p, 10) || 0), 0)
  }

  const sortedPlayers = [...players]
    .map(player => ({
      ...player,
      totalScore: getTotal(player)
    }))
    .sort((a, b) => lowIsBetter ? a.totalScore - b.totalScore : b.totalScore - a.totalScore)

  // Assign ranks with tie handling
  let currentRank = 1
  const rankedPlayers = sortedPlayers.map((player, index) => {
    if (index > 0 && sortedPlayers[index - 1].totalScore !== player.totalScore) {
      currentRank = index + 1
    }
    return { ...player, rank: currentRank }
  })

  // Prepare chart data
  const prepareChartData = () => {
    const playersData = rankedPlayers.map(player => ({
      id: player.id,
      name: player.name,
      totalScore: player.totalScore
    }))

    const roundData = (players[0]?.points || []).map((_, roundIndex) => ({
      round: roundIndex + 1,
      players: players.map(player => ({
        id: player.id,
        name: player.name,
        totalScore: player.points.slice(0, roundIndex + 1).reduce((sum, p) => sum + (Number.parseInt(p, 10) || 0), 0)
      }))
    }))

    return { playersData, roundData }
  }

  return (
    <div className="game-details-container">
      {message.text && (
        <div className={`settings-message ${message.type}`}>
          {message.text}
        </div>
      )}
      
      <div className="game-details-header">
        <button 
          onClick={() => navigate(-1)} 
          className="back-link"
          aria-label="Go back"
        >
          <ArrowLeftIcon className="back-icon" />
        </button>
        
        <div className="game-title-section">
          <div className="game-name">{gameName}</div>
          <div className="game-date">{formattedDate}</div>
        </div>
        
        <div className="badge-controls-container">
          <button className="settings-button share-button" onClick={handleShareGame}>
            <ShareIcon size={16} />
            Share
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="stats-subtabs">
        <button 
          className={`stats-subtab-btn ${activeTab === 'standings' ? 'active' : ''}`}
          onClick={() => setActiveTab('standings')}
        >
          Standings
        </button>
        <button 
          className={`stats-subtab-btn ${activeTab === 'chart' ? 'active' : ''}`}
          onClick={() => setActiveTab('chart')}
        >
          Chart
        </button>
        <button 
          className={`stats-subtab-btn ${activeTab === 'table' ? 'active' : ''}`}
          onClick={() => setActiveTab('table')}
        >
          Table
        </button>
      </div>

      <div className="game-summary">
        {/* Standings View */}
        {(activeTab === 'standings' || isLandscape) && (
          <div className="results-section">
            {!isLandscape && <h2 className="results-header">Final Results</h2>}
            <div className="results-table">
              {rankedPlayers.map((player) => (
                <div key={player.id || player.name} className="results-row">
                  <div className="top-result-row">
                    <div className={`rank-col ${player.rank === 1 ? 'gold' : player.rank === 2 ? 'silver' : player.rank === 3 ? 'bronze' : ''}`}>
                      {player.rank}
                    </div>
                    <div className="player-col">
                      <div className="player-info">
                        {player.name ? (
                          <Link to={`/user/${player.name}`} className="player-link">
                            {player.name}
                          </Link>
                        ) : (
                          <span>{player.name}</span>
                        )}
                      </div>
                    </div>
                    <div className="score-col">{player.totalScore}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chart View */}
        {(activeTab === 'chart' || isLandscape) && (
          <div className="results-section">
            {!isLandscape && <h2 className="results-header">Score Progression</h2>}
            <div className="chart-view-container">
              {players[0]?.points?.length > 0 ? (
                <StatsChart 
                  playersData={prepareChartData().playersData} 
                  roundData={prepareChartData().roundData} 
                />
              ) : (
                <div className="no-chart-data">No round data available for chart visualization</div>
              )}
            </div>
          </div>
        )}

        {/* Table View */}
        {(activeTab === 'table' || isLandscape) && (
          <div className="results-section">
            {!isLandscape && <h2 className="results-header">Score Table</h2>}
            <div className="rounds-section">
              <div className={`wizard-scorecard ${players.length > 3 ? 'many-players' : ''}`} data-player-count={players.length}>
                <table className="scorecard-table">
                  <thead>
                    <tr>
                      <th className="round-header sticky-cell">Round</th>
                      {players.map((player, idx) => (
                        <th key={idx} className="player-header">
                          <div className="player-header-name">
                            {player.name ? (
                              <Link to={`/user/${player.name}`} className="player-link">
                                {player.name}
                              </Link>
                            ) : (
                              player.name
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...Array(rows)].map((_, rowIdx) => {
                      const hasData = players.some(p => {
                        const point = p.points?.[rowIdx]
                        return point !== "" && point !== undefined && point !== null
                      })
                      
                      if (!hasData && rowIdx > 0) {
                        const hasPreviousData = players.some(p => {
                          const point = p.points?.[rowIdx - 1]
                          return point !== "" && point !== undefined && point !== null
                        })
                        if (!hasPreviousData) return null
                      }
                      
                      // Skip empty rows at the end
                      if (!hasData) return null
                      
                      return (
                        <tr key={rowIdx} className="round-row">
                          <td className="round-number sticky-cell">{rowIdx + 1}</td>
                          {players.map((player, playerIdx) => (
                            <td key={playerIdx} className="player-round-cell">
                              <span className="round-score">
                                {player.points?.[rowIdx] ?? '-'}
                              </span>
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                    <tr className="total-row">
                      <td className="total-label sticky-cell">Total</td>
                      {players.map((player, idx) => (
                        <td key={idx} className="total-score">
                          {getTotal(player)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TableGameDetails
