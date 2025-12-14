import { useMemo } from 'react';
import { useGameStats } from '@/shared/hooks/useGameStats';
import '@/styles/pages/account.css';

/**
 * Unified stats overview component used by both Account and UserProfile pages
 * Ensures consistent data calculation and display
 */
const StatsOverview = ({ games, user, onGameTypeClick }) => {
  const overviewStats = useGameStats(games, user);

  if (!user) {
    return (
      <div className="settings-section">
        <p style={{ textAlign: 'center', padding: '40px 20px' }}>
          Please login to view game statistics
        </p>
      </div>
    );
  }

  if (overviewStats.gameTypes.length === 0) {
    return (
      <div className="settings-section">
        <p style={{ textAlign: 'center', padding: '40px 20px' }}>
          No games played yet. Start a new game to see your stats!
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Game Types Grid */}
      <div className="overview-grid">
        {overviewStats.gameTypes.map(gameType => (
          <div 
            key={gameType.name} 
            className="game-type-card"
            onClick={() => onGameTypeClick?.(gameType.name)}
            style={{ cursor: onGameTypeClick ? 'pointer' : 'default' }}
          >
            <h3 className="game-type-name">{gameType.name}</h3>
            <div className="game-type-stats">
              <div className="stat-item">
                <span className="stat-label">Win%:</span>
                <span className="stat-value win-rate">
                  {Math.round((gameType.wins / gameType.matches) * 100)}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Matches:</span>
                <span className="stat-value">{gameType.matches}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Overall Recent Results */}
      {overviewStats.recentResults.length > 0 && (
        <div className="settings-section">
          <h3 className="settings-section-title">Recent Performance</h3>
          <div className="overall-recent-results">
            <div className="results-string large">
              {overviewStats.recentResults.map((result, idx) => (
                <span key={idx} className={`result-letter ${result === 'W' ? 'win' : 'loss'}`}>
                  {result}
                </span>
              ))}
            </div>
            <p className="results-description">Last 10 games</p>
          </div>
        </div>
      )}
    </>
  );
};

export default StatsOverview;
