import React from "react";
import PerformanceMetric from "@/components/common/PerformanceMetric";

const AdvancedStats = ({ playerStats, isVisible }) => {
  if (!isVisible) return null;

  // Normalize data structure to handle different property names from different pages
  const normalizedStats = {
    bestRound: playerStats.bestRound || playerStats.highestScore || 0,
    correctBids: playerStats.correctBids || 0,
    totalTricks: playerStats.totalTricks || (playerStats.avgTricks * playerStats.roundsPlayed) || 0,
    maxConsecutiveCorrect: playerStats.maxConsecutiveCorrect || 0,
    worstRound: playerStats.worstRound || 0,
    avgPoints: playerStats.avgPoints || 0,
    bidAccuracy: playerStats.bidAccuracy || 0,
    overBids: playerStats.overBids || playerStats.overbids || 0,
    underBids: playerStats.underBids || playerStats.underbids || 0,
    totalPoints: playerStats.totalPoints || 0,
    avgTricks: playerStats.avgTricks || 0,
    roundsPlayed: playerStats.roundsPlayed || 0
  };

  const calculateBiddingStats = () => {
    const overbids = normalizedStats.overBids;
    const underbids = normalizedStats.underBids;
    const correctBids = normalizedStats.correctBids;
    const totalBids = overbids + underbids + correctBids;
    
    if (totalBids === 0) return null;
    
    // Calculate percentages
    const correctBidPercent = totalBids > 0 ? (correctBids / totalBids) * 100 : 0;
    const overBidPercent = totalBids > 0 ? (overbids / totalBids) * 100 : 0;
    const underBidPercent = totalBids > 0 ? (underbids / totalBids) * 100 : 0;
    
    // Determine bidding quality based on correct bid percentage
    let biddingQuality = '';
    let biddingClass = '';
    
    if (correctBidPercent > 75) {
      biddingQuality = 'Bidding: Excellent';
      biddingClass = 'excellent-bidding';
    } else if (correctBidPercent >= 60) {
      biddingQuality = 'Bidding: Good';
      biddingClass = 'good-bidding';
    } else if (correctBidPercent >= 45) {
      biddingQuality = 'Bidding: Okay';
      biddingClass = 'okay-bidding';
    } else if (correctBidPercent >= 30) {
      biddingQuality = 'Bidding: Poorly';
      biddingClass = 'poor-bidding';
    } else {
      biddingQuality = 'Bidding: Badly';
      biddingClass = 'bad-bidding';
    }
    
    // Add bidding tendency descriptor
    let biddingTendency = '';
    if (overBidPercent > 25 && overBidPercent > underBidPercent) {
      biddingTendency = ' (Tends to Overbid)';
    } else if (underBidPercent > 25 && underBidPercent > overBidPercent) {
      biddingTendency = ' (Tends to Underbid)';
    } else if (overBidPercent === underBidPercent && overBidPercent > 15) {
      biddingTendency = ' (Mixed Errors)';
    }
    
    return {
      biddingQuality,
      biddingClass,
      biddingTendency,
      correctBidPercent: Math.round(correctBidPercent),
      overBidPercent: Math.round(overBidPercent),
      underBidPercent: Math.round(underBidPercent),
      totalBids
    };
  };

  const biddingStats = calculateBiddingStats();

  return (
    <div className="advanced-stats">
      <div className="stats-section">
        <div className="stats-cards">
          <div className="additional-stats">
            <div className="stat-row">
                <span className="stat-label">Highest Round:</span>
                <span className="stat-value">{Math.round(normalizedStats.bestRound)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Worst Round:</span>
              <span className="stat-value negative">{normalizedStats.worstRound}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="stats-section">
          <div className="stats-cards">
            <div className="bidding-style-card">
            <div className="bidding-style-value">
              {biddingStats ? (
                <div>
                  <span className={biddingStats.biddingClass}>
                    {biddingStats.biddingQuality}
                  </span>
                  {biddingStats.biddingTendency && (
                    <span className="bidding-tendency">{biddingStats.biddingTendency}</span>
                  )}
                </div>
              ) : (
                <span className="no-data">Play more to see bidding stats</span>
              )}
            </div>
            
            {biddingStats && (
              <>
                <div className="bid-distribution-bar">
                  <div className="bid-segment correct-segment" style={{ width: `${biddingStats.correctBidPercent}%` }}></div>
                  <div className="bid-segment over-segment" style={{ width: `${biddingStats.overBidPercent}%` }}></div>
                  <div className="bid-segment under-segment" style={{ width: `${biddingStats.underBidPercent}%` }}></div>
                </div>
                
                <div className="bidding-stats">
                  <span className="bid-stat correct">{normalizedStats.correctBids} correct</span> •
                  <span className="bid-stat over">{normalizedStats.overBids} over</span> •
                  <span className="bid-stat under">{normalizedStats.underBids} under</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="stats-section">
        <div className="stats-cards">
          <PerformanceMetric 
            label="Bid Accuracy" 
            value={parseFloat(normalizedStats.bidAccuracy || 0)} 
            targetMin={40} 
            targetMax={75}
            isPercentage={true}
            isBadWhenAboveMax={false} 
          />
        </div>
      </div>
    </div>
  );
};

export default AdvancedStats;
