import React from "react";
import { useTranslation } from "react-i18next";
import StatTile from "@/components/stats/StatTile";
import "@/styles/components/advancedStats.css";

/** Rate a bid accuracy (0-100) - the label key and the colour it shows in. */
const getBiddingLevel = (accuracy) => {
  if (accuracy > 75) return { key: 'biddingExcellent', tone: 'good' };
  if (accuracy >= 60) return { key: 'biddingGood', tone: 'good' };
  if (accuracy >= 45) return { key: 'biddingOkay', tone: 'warn' };
  if (accuracy >= 30) return { key: 'biddingPoor', tone: 'bad' };
  return { key: 'biddingBad', tone: 'bad' };
};

/**
 * Overbids or underbids dominate once they pass a quarter of all bids;
 * an even split of a meaningful size reads as mixed errors.
 */
const getBiddingTendency = (overPercent, underPercent) => {
  if (overPercent > 25 && overPercent > underPercent) return 'tendsToOverbid';
  if (underPercent > 25 && underPercent > overPercent) return 'tendsToUnderbid';
  if (overPercent === underPercent && overPercent > 15) return 'mixedErrors';
  return null;
};

const AdvancedStats = ({ playerStats, isVisible }) => {
  const { t } = useTranslation();
  if (!isVisible) return null;

  // Normalize data structure to handle different property names from different pages
  const bestRound = playerStats.bestRound || playerStats.highestScore || 0;
  const worstRound = playerStats.worstRound || 0;
  const correctBids = playerStats.correctBids || 0;
  const overBids = playerStats.overBids || playerStats.overbids || 0;
  const underBids = playerStats.underBids || playerStats.underbids || 0;
  const totalBids = correctBids + overBids + underBids;

  const percentOf = (count) => (totalBids > 0 ? (count / totalBids) * 100 : 0);
  const accuracy = totalBids > 0
    ? percentOf(correctBids)
    : parseFloat(playerStats.bidAccuracy) || 0;
  const level = getBiddingLevel(accuracy);
  const tendency = getBiddingTendency(percentOf(overBids), percentOf(underBids));

  const segments = [
    { key: 'correct', count: correctBids, label: t('statsChart.correctCount', { count: correctBids }) },
    { key: 'over', count: overBids, label: t('statsChart.overCount', { count: overBids }) },
    { key: 'under', count: underBids, label: t('statsChart.underCount', { count: underBids }) },
  ];

  return (
    <div className="advanced-stats player-game-stats">
      <div className="stats-tiles">
        <StatTile label={t('statsChart.highestRound')} value={Math.round(bestRound)} tone={bestRound > 0 ? 'good' : undefined} />
        <StatTile label={t('statsChart.worstRound')} value={worstRound} tone={worstRound < 0 ? 'bad' : undefined} />
        <StatTile
          label={t('statsChart.bidAccuracyShort')}
          value={`${Math.round(accuracy)}%`}
          tone={totalBids > 0 ? level.tone : undefined}
        />
      </div>

      {totalBids > 0 ? (
        <div className="bidding-summary">
          <div className="bidding-summary-header">
            <span className="bidding-summary-title">{t('statsChart.bidding')}</span>
            <span className={`bidding-quality is-${level.tone}`}>{t(`statsChart.${level.key}`)}</span>
          </div>
          <div className="bid-split-bar" role="img" aria-label={segments.map((s) => s.label).join(', ')}>
            {segments.map((segment) => (
              <span
                key={segment.key}
                className={`bid-split-segment is-${segment.key}`}
                style={{ width: `${percentOf(segment.count)}%` }}
              />
            ))}
          </div>
          <div className="bid-split-legend">
            {segments.map((segment) => (
              <span key={segment.key} className="bid-split-legend-item">
                <span className={`bid-split-dot is-${segment.key}`} aria-hidden="true" />
                {segment.label}
              </span>
            ))}
          </div>
          {tendency && <p className="bidding-tendency-note">{t(`statsChart.${tendency}`)}</p>}
        </div>
      ) : (
        <p className="bidding-summary-empty">{t('statsChart.playMoreForBidding')}</p>
      )}
    </div>
  );
};

export default AdvancedStats;
