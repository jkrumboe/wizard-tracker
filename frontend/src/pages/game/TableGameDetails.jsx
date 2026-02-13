"use client"

import { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useTranslation } from 'react-i18next'
import { getTableGameById } from "@/shared/api/tableGameService"
import { shareGame as shareGameUtil } from '@/shared/utils/gameSharing'
import StatsChart from "@/components/game/StatsChart"
import "@/styles/components/scorecard.css"
import "@/styles/components/statsChart.css"
import "@/styles/pages/gameDetails.css"
import "@/styles/pages/account.css"
import "@/styles/components/TableGame.css"
import { ArrowLeftIcon, ShareIcon, TrophyIcon } from "@/components/ui/Icon"

// Skeleton Loading Component
const GameDetailsSkeleton = () => (
  <div className="game-details-container">
    <div className="game-details-header">
      <button className="back-link" disabled>
        <ArrowLeftIcon className="back-icon" />
      </button>
      
      <div className="game-title-section">
        <div className="skeleton skeleton-text" style={{ width: '90px', height: '24px' }}></div>
        <div className="skeleton skeleton-text" style={{ width: '120px', height: '20px', marginTop: '4px' }}></div>
      </div>
      
      <div className="badge-controls-container">
        <div className="skeleton skeleton-text" style={{ width: '70px', height: '16px', borderRadius: 'var(--radius-sm)' }}></div>
      </div>
    </div>

    {/* Skeleton Tabs */}
    <div className="account-tabs">
      <div className="skeleton skeleton-text" style={{ width: '33%', height: '34px', borderRadius: 'var(--radius-md)' }}></div>
      <div className="skeleton skeleton-text" style={{ width: '33%', height: '34px', borderRadius: 'var(--radius-md)' }}></div>
      <div className="skeleton skeleton-text" style={{ width: '33%', height: '34px', borderRadius: 'var(--radius-md)' }}></div>
    </div>

    <div className="game-summary">
      <div className="results-section">
        <div className="skeleton skeleton-text" style={{ width: '120px', height: '24px', marginBottom: '12px' }}></div>
        <div className="results-table">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`skeleton-row-${index}`} className="results-row skeleton-row">
              <div className="top-result-row">
                <div className="rank-col">
                  <div className="skeleton skeleton-rank"></div>
                </div>
                <div className="player-col">
                  <div className="skeleton skeleton-name" style={{ width: `${60 + Math.random() * 30}%` }}></div>
                </div>
                <div className="score-col">
                  <div className="skeleton skeleton-stat"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)

const TableGameDetails = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
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
    return <GameDetailsSkeleton />
  }

  if (error) {
    return (
      <div className="game-details-container">
        <div className="error-state">{error}</div>
        <button onClick={() => navigate(-1)} className="back-link">
          {t('common.goBack')}
        </button>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="game-details-container">
        <div className="error-state">{t('tableGame.gameNotFound')}</div>
        <button onClick={() => navigate(-1)} className="back-link">
          {t('common.goBack')}
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

  // Count rounds that have actual data
  const filledRounds = players.length > 0
    ? (players[0].points || []).filter((p) => p !== "" && p !== undefined && p !== null).length
    : 0
  const hasMultipleRounds = filledRounds > 1

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
    <div className="game-details-container table-game-container">
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
            {t('common.share')}
          </button>
        </div>
      </div>

      {/* Tabs - only show when there are multiple rounds */}
      {hasMultipleRounds && (
        <div className="account-tabs">
          <button 
            className={`account-tab ${activeTab === 'standings' ? 'active' : ''}`}
            onClick={() => setActiveTab('standings')}
          >
            {t('tableGame.standingsSubTab')}
          </button>
          <button 
            className={`account-tab ${activeTab === 'chart' ? 'active' : ''}`}
            onClick={() => setActiveTab('chart')}
          >
            {t('tableGame.chartsSubTab')}
          </button>
          <button 
            className={`account-tab ${activeTab === 'table' ? 'active' : ''}`}
            onClick={() => setActiveTab('table')}
          >
            {t('tableGame.tableSubTab')}
          </button>
        </div>
      )}

      <div className="game-summary">
        {/* Standings View */}
        {(activeTab === 'standings' || isLandscape) && (
          <div className="results-section">
            {/* {!isLandscape && <h2 className="results-header">Final Results</h2>} */}
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
        {hasMultipleRounds && (activeTab === 'chart' || isLandscape) && (
          <div className="results-section">
            {/* {!isLandscape && <h2 className="results-header">Score Progression</h2>} */}
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
        {hasMultipleRounds && (activeTab === 'table' || isLandscape) && (
          <div className="results-section">
            {/* {!isLandscape && <h2 className="results-header">Score Table</h2>} */}
            <div className="rounds-section">
              <div className={`wizard-scorecard ${players.length > 3 ? 'many-players' : ''}`} data-player-count={players.length}>
                <table className="scorecard-table">
                  <thead>
                    <tr>
                      <th className="round-header sticky-cell"/>
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
                      <td className="total-label sticky-cell">{t('common.total')}</td>
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
