"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useTranslation } from 'react-i18next'
import { LocalScoreboardGameStorage } from "@/shared/api"
import { getTableGameById } from "@/shared/api/tableGameService"
import { shareGame as shareGameUtil } from '@/shared/utils/gameSharing'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import "@/styles/components/scorecard.css"
import "@/styles/components/statsChart.css"
import "@/styles/pages/gameDetails.css"
import "@/styles/pages/account.css"
import "@/styles/components/TableGame.css"
import { ArrowLeftIcon, ShareIcon } from "@/components/ui/Icon"

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
  </div>
)

const ScoreboardGameDetails = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('standings')
  const [selectedChartSet, setSelectedChartSet] = useState(1)
  const [expandedTeamId, setExpandedTeamId] = useState(null)
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

        let gameData = null
        const isLocalScoreboardId = typeof id === 'string' && id.startsWith('scoreboard_game_')

        if (isLocalScoreboardId) {
          const localScoreboardGame = LocalScoreboardGameStorage.getTableGameById(id)
          if (localScoreboardGame) {
            gameData = { ...localScoreboardGame, is_local: true }
          }
        }

        if (!gameData && !isLocalScoreboardId) {
          gameData = await getTableGameById(id)
        }

        if (!gameData) {
          throw new Error('Game not found')
        }

        const normalized = gameData.gameData?.gameData || gameData.gameData || gameData
        const isScoreboardGame =
          (typeof id === 'string' && id.startsWith('scoreboard_game_'))
          || normalized.scoreEntryMode === 'twoSideGesture'
          || normalized.gameType === 'scoreboard'
          || gameData.scoreEntryMode === 'twoSideGesture'
          || gameData.gameType === 'scoreboard'
          || gameData.gameTypeName === 'Volleyball'
          || gameData.name === 'Volleyball'
        if (!isScoreboardGame) {
          navigate(`/table-game/${id}`, { replace: true })
          return
        }

        setGame(gameData)
        setLoading(false)
      } catch (err) {
        console.error('Error fetching scoreboard game details:', err)
        setError(`Failed to load game details: ${err.message}`)
        setLoading(false)
      }
    }

    fetchGameData()
  }, [id, navigate])

  const handleShareGame = async () => {
    if (!game) return

    try {
      const shareData = {
        id: game.id || id,
        gameType: 'scoreboard',
        gameTypeName: game.gameTypeName || game.name || 'Scoreboard Game',
        ...game,
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

  const normalizedGame = game || {}
  const gameData = normalizedGame.gameData?.gameData || normalizedGame.gameData || normalizedGame
  const players = Array.isArray(gameData.players) ? gameData.players : []
  const gameName = normalizedGame.gameTypeName || normalizedGame.name || gameData.gameName || 'Scoreboard Game'
  const rows = gameData.rows || 10
  const timestampCandidates = [
    normalizedGame.createdAt,
    normalizedGame.created_at,
    normalizedGame.savedAt,
    normalizedGame.saved_at,
    normalizedGame.lastPlayed,
    gameData.createdAt,
    gameData.created_at,
    gameData.savedAt,
    gameData.saved_at,
    gameData.lastPlayed,
    gameData.referenceDate,
    gameData._internalState?.referenceDate,
  ]
  const gameTimestamp = timestampCandidates.find((value) => {
    if (!value) return false
    const parsedDate = new Date(value)
    return !Number.isNaN(parsedDate.getTime())
  })
  const pointHistoryBySet = useMemo(() => {
    if (gameData.pointHistoryBySet && typeof gameData.pointHistoryBySet === 'object') {
      return gameData.pointHistoryBySet
    }
    return {}
  }, [gameData.pointHistoryBySet])

  const filledRounds = players.reduce((maxRounds, player) => {
    const roundsForPlayer = (player.points || []).filter((p) => p !== '' && p !== undefined && p !== null).length
    return Math.max(maxRounds, roundsForPlayer)
  }, 0)

  const availableSetNumbers = useMemo(() => {
    const fromRounds = Array.from({ length: Math.max(filledRounds, 0) }, (_, idx) => idx + 1)
    const fromHistory = Object.keys(pointHistoryBySet)
      .map((key) => Number.parseInt(key, 10))
      .filter((value) => Number.isFinite(value) && value > 0)

    const mergedSets = Array.from(new Set([...fromRounds, ...fromHistory])).sort((a, b) => a - b)
    return mergedSets.length > 0 ? mergedSets : [1]
  }, [filledRounds, pointHistoryBySet])

  useEffect(() => {
    setSelectedChartSet((prev) => {
      if (availableSetNumbers.includes(prev)) return prev
      return availableSetNumbers[availableSetNumbers.length - 1]
    })
  }, [availableSetNumbers])

  const formattedDate = gameTimestamp
    ? new Date(gameTimestamp).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unknown date'

  const getTotal = (player) => (player.points || []).reduce((sum, p) => sum + (Number.parseInt(p, 10) || 0), 0)

  const sortedPlayers = [...players]
    .map((player) => ({ ...player, totalScore: getTotal(player) }))
    .sort((a, b) => b.totalScore - a.totalScore)

  const getTeamMembers = (teamPlayer) => {
    const teamIndex = players.findIndex((player) => player.id === teamPlayer.id)
    if (teamIndex < 0) return []

    const members = Array.isArray(gameData.teamMembers?.[teamIndex])
      ? gameData.teamMembers[teamIndex]
      : []

    return members
      .map((member) => {
        if (!member) return null
        if (typeof member === 'string') {
          return { id: member, name: member }
        }
        return {
          id: member.id || member.name,
          name: member.name,
        }
      })
      .filter((member) => member?.name)
  }

  const getTeamMembersLabel = (teamPlayer) => {
    const members = getTeamMembers(teamPlayer)

    return members
      .map((member) => member?.name)
      .filter(Boolean)
      .join(' - ')
  }

  const getProfilePath = (name) => `/user/${encodeURIComponent(name)}`
  const toggleTeamExpanded = (teamId) => {
    setExpandedTeamId((prev) => (prev === teamId ? null : teamId))
  }

  let currentRank = 1
  const rankedPlayers = sortedPlayers.map((player, index) => {
    if (index > 0 && sortedPlayers[index - 1].totalScore !== player.totalScore) {
      currentRank = index + 1
    }
    return { ...player, rank: currentRank }
  })

  const getPointHistoryForSet = (setNumber) => {
    const roundKey = String(setNumber)
    return Array.isArray(pointHistoryBySet[roundKey]) ? pointHistoryBySet[roundKey] : []
  }

  const buildScoreProgressionSeries = (history) => {
    const points = [{ pointNumber: 0, teamOne: 0, teamTwo: 0 }]
    let teamOne = 0
    let teamTwo = 0

    history.forEach((scorer, index) => {
      if (scorer === 0) teamOne += 1
      if (scorer === 1) teamTwo += 1

      points.push({ pointNumber: index + 1, teamOne, teamTwo })
    })

    return points
  }

  const selectedSetPointHistory = getPointHistoryForSet(selectedChartSet)
  const selectedSetProgressionSeries = buildScoreProgressionSeries(selectedSetPointHistory)

  const progressionMaxScore = selectedSetProgressionSeries.reduce((max, point) => Math.max(max, point.teamOne, point.teamTwo), 0)
  const progressionTickStep = progressionMaxScore <= 6 ? 1 : (progressionMaxScore <= 12 ? 2 : 5)
  const progressionAxisTop = Math.max(3, Math.ceil(Math.max(1, progressionMaxScore) / progressionTickStep) * progressionTickStep)
  const progressionYAxisTicks = Array.from(
    { length: Math.floor(progressionAxisTop / progressionTickStep) + 1 },
    (_, idx) => idx * progressionTickStep,
  )

  if (loading) return <GameDetailsSkeleton />

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

  return (
    <div className="game-details-container table-game-container">
      {message.text && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="game-details-header">
        <button onClick={() => navigate(-1)} className="back-link" aria-label="Go back">
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

      <div className="account-tabs">
        <button className={`account-tab ${activeTab === 'standings' ? 'active' : ''}`} onClick={() => setActiveTab('standings')}>
          {t('tableGame.standingsSubTab')}
        </button>
        <button className={`account-tab ${activeTab === 'chart' ? 'active' : ''}`} onClick={() => setActiveTab('chart')}>
          {t('tableGame.chartsSubTab')}
        </button>
        <button className={`account-tab ${activeTab === 'table' ? 'active' : ''}`} onClick={() => setActiveTab('table')}>
          {t('tableGame.setsSubTab')}
        </button>
      </div>

      <div className="game-summary">
        {(activeTab === 'standings' || isLandscape) && (
          <div className="results-section">
            <div className="results-table">
              {rankedPlayers.map((player) => (
                <div
                  key={player.id || player.name}
                  className="results-row team-results-row"
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandedTeamId === player.id}
                  aria-label={`Open ${player.name} players`}
                  onClick={() => toggleTeamExpanded(player.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      toggleTeamExpanded(player.id)
                    }
                  }}
                >
                  <div className="top-result-row">
                    <div className={`rank-col ${player.rank === 1 ? 'gold' : player.rank === 2 ? 'silver' : player.rank === 3 ? 'bronze' : ''}`}>
                      {player.rank}
                    </div>
                    <div className="player-col">
                      <div className="player-info team-standings-info">
                        {player.name ? (
                          <button
                            type="button"
                            className="player-link team-link-toggle"
                            onClick={(event) => {
                              event.stopPropagation()
                              toggleTeamExpanded(player.id)
                            }}
                            aria-expanded={expandedTeamId === player.id}
                            aria-label={`Open ${player.name} players`}
                          >
                            {player.name}
                          </button>
                        ) : (
                          <span>{player.name}</span>
                        )}
                        {expandedTeamId !== player.id && (
                          <span className="team-members-list">{getTeamMembersLabel(player)}</span>
                        )}
                        {expandedTeamId === player.id && (
                          <div className="team-members-links" role="list">
                            {getTeamMembers(player).length > 0 ? (
                              getTeamMembers(player).map((member) => (
                                <Link
                                  key={`${player.id}-${member.id || member.name}`}
                                  to={getProfilePath(member.name)}
                                  className="player-link team-member-link"
                                  role="listitem"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  {member.name}
                                </Link>
                              ))
                            ) : (
                              <Link
                                to={getProfilePath(player.name)}
                                className="player-link team-member-link"
                                role="listitem"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {player.name}
                              </Link>
                            )}
                          </div>
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

        {(activeTab === 'chart' || isLandscape) && (
          <div className="results-section">
            <div className="chart-view-container">
              <div className="score-progression-analytics game-details-score-progression-analytics">
                {availableSetNumbers.length > 1 && (
                  <div className="game-details-set-selector" role="tablist" aria-label={t('tableGame.setsLabel', { n: availableSetNumbers.length })}>
                    {availableSetNumbers.map((setNumber) => (
                      <button
                        key={setNumber}
                        type="button"
                        role="tab"
                        aria-selected={selectedChartSet === setNumber}
                        className={`game-details-set-chip ${selectedChartSet === setNumber ? 'active' : ''}`}
                        onClick={() => setSelectedChartSet(setNumber)}
                      >
                        {t('tableGame.setLabel', { n: setNumber })}
                      </button>
                    ))}
                  </div>
                )}

                <div className="score-progression-chart-wrap">
                  {selectedSetPointHistory.length > 0 ? (
                    <div className="score-progression-chart" role="img" aria-label={t('tableGame.pointProgressionChartAria', { set: selectedChartSet })}>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={selectedSetProgressionSeries} margin={{ top: 8, right: 5, left: -10, bottom: 0 }}>
                          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="pointNumber" axisLine={false} tickLine={false} tick={false} height={0} />
                          <YAxis
                            className="score-progression-y-axis"
                            allowDecimals={false}
                            domain={[0, progressionAxisTop]}
                            ticks={progressionYAxisTicks}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11 }}
                            width={28}
                          />
                          <Tooltip
                            contentStyle={{
                              background: 'var(--card-bg)',
                              border: '1px solid var(--border)',
                              borderRadius: '8px',
                              color: 'var(--text)',
                            }}
                            labelFormatter={(value) => `${t('common.points')} ${value}`}
                          />
                          <Line type="stepAfter" dataKey="teamOne" stroke="#60a5fa" strokeWidth={3} dot={false} isAnimationActive={false} />
                          <Line type="stepAfter" dataKey="teamTwo" stroke="#f87171" strokeWidth={3} dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="score-progression-empty">{t('tableGame.noPointProgression')}</div>
                  )}

                  <div className="score-progression-legend">
                    <div className="legend-item team-one">
                      <span className="legend-dot" />
                      <span>{players[0]?.name || t('startTableGame.teamOne')}</span>
                    </div>
                    <div className="legend-item team-two">
                      <span className="legend-dot" />
                      <span>{players[1]?.name || t('startTableGame.teamTwo')}</span>
                    </div>
                  </div>
                </div>

                <div className="score-progression-timeline-wrap">
                  <h4>{t('tableGame.rallyTimelineTitle')}</h4>
                  {selectedSetPointHistory.length > 0 ? (
                    <div className="score-progression-timeline" aria-label={t('tableGame.rallyTimelineAria', { set: selectedChartSet })}>
                      {selectedSetPointHistory.map((scorer, idx) => (
                        <span
                          key={`rally-${selectedChartSet}-${idx}`}
                          className={`rally-dot ${scorer === 0 ? 'team-one' : 'team-two'}`}
                          title={`${idx + 1}. ${scorer === 0 ? (players[0]?.name || t('startTableGame.teamOne')) : (players[1]?.name || t('startTableGame.teamTwo'))}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="score-progression-empty">{t('tableGame.noPointProgression')}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'table' || isLandscape) && (
          <div className="results-section">
            <div className="rounds-section">
              <div className={`wizard-scorecard ${players.length > 3 ? 'many-players' : ''}`} data-player-count={players.length}>
                <table className="scorecard-table">
                  <thead>
                    <tr>
                      <th className="round-header sticky-cell">{t('tableGame.setHeader')}</th>
                      {players.map((player, idx) => (
                        <th key={idx} className="player-header">
                          <div className="player-header-name">
                            {player.name ? (
                              <Link to={getProfilePath(player.name)} className="player-link">
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
                      const hasData = players.some((p) => {
                        const point = p.points?.[rowIdx]
                        return point !== '' && point !== undefined && point !== null
                      })

                      if (!hasData && rowIdx > 0) {
                        const hasPreviousData = players.some((p) => {
                          const point = p.points?.[rowIdx - 1]
                          return point !== '' && point !== undefined && point !== null
                        })
                        if (!hasPreviousData) return null
                      }

                      if (!hasData) return null

                      return (
                        <tr key={rowIdx} className="round-row">
                          <td className="round-number sticky-cell">{rowIdx + 1}</td>
                          {players.map((player, playerIdx) => (
                            <td key={playerIdx} className="player-round-cell">
                              <span className="round-score">{player.points?.[rowIdx] ?? '-'}</span>
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                    <tr className="total-row">
                      <td className="total-label sticky-cell">{t('common.total')}</td>
                      {players.map((player, idx) => (
                        <td key={idx} className="total-score">{getTotal(player)}</td>
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

export default ScoreboardGameDetails
