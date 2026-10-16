import { useTranslation } from 'react-i18next'
import { BarChartIcon, ClockIcon, StarIcon, TrophyIcon } from "@/components/ui/Icon"
import "@/styles/components/gameHighlights.css"

/**
 * Strip of headline facts shown above the stats on wide screens.
 * Hidden below 1024px (see gameHighlights.css).
 */
export function GameHighlights({ highlights, inProgress = false }) {
  const { t } = useTranslation()
  const { leaders, margin, roundCount, playerCount, bestRound, bestBidder } = highlights
  const leaderScore = leaders[0]?.score

  return (
    <div className="game-highlights">
      <div className="highlight-card">
        <TrophyIcon size={20} className="highlight-icon" />
        <div className="highlight-body">
          <span className="highlight-label">
            {inProgress ? t('gameDetails.highlightLeader') : t('gameDetails.highlightWinner')}
          </span>
          <span className="highlight-value">{leaders.map(p => p.name).join(', ') || '–'}</span>
          <span className="highlight-detail">
            {margin !== null
              ? t('gameDetails.highlightWinnerMargin', { score: leaderScore, margin })
              : t('gameDetails.highlightWinnerScore', { score: leaderScore ?? 0 })}
          </span>
        </div>
      </div>
      <div className="highlight-card">
        <ClockIcon size={20} className="highlight-icon" />
        <div className="highlight-body">
          <span className="highlight-label">{t('gameDetails.highlightRounds')}</span>
          <span className="highlight-value">{roundCount}</span>
          <span className="highlight-detail">{t('gameDetails.highlightPlayers', { count: playerCount })}</span>
        </div>
      </div>
      {bestRound && (
        <div className="highlight-card">
          <StarIcon size={20} className="highlight-icon" />
          <div className="highlight-body">
            <span className="highlight-label">{t('gameDetails.highlightBestRound')}</span>
            <span className="highlight-value">{bestRound.score > 0 ? '+' : ''}{bestRound.score}</span>
            <span className="highlight-detail">{t('gameDetails.highlightBestRoundDetail', { name: bestRound.name, n: bestRound.round })}</span>
          </div>
        </div>
      )}
      {bestBidder && (
        <div className="highlight-card">
          <BarChartIcon size={20} className="highlight-icon" />
          <div className="highlight-body">
            <span className="highlight-label">{t('gameDetails.highlightBidAccuracy')}</span>
            <span className="highlight-value">{bestBidder.accuracy}%</span>
            <span className="highlight-detail">{t('gameDetails.highlightBidAccuracyDetail', { name: bestBidder.name, correct: bestBidder.correct, total: bestBidder.total })}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default GameHighlights
