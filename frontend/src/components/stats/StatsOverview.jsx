import React from 'react';
import { TrendingUp } from 'lucide-react';
import { useGameStats } from '@/shared/hooks/useGameStats';
import { useAllUserElo } from '@/shared/hooks/useElo';
import '@/styles/pages/account.css';

/**
 * Normalize game type to match ELO keys (e.g., "Flip 7" -> "flip-7")
 */
const normalizeGameType = (gameType) => {
  if (!gameType) return 'unknown';
  return gameType.toLowerCase().replace(/\s+/g, '-');
};

/**
 * Unified stats overview component used by both Account and UserProfile pages
 * Ensures consistent data calculation and display
 */
const StatsOverview = ({ games, user, onGameTypeClick, identityId }) => {
  const overviewStats = useGameStats(games, user);
  const { eloByGameType, loading: _eloLoading } = useAllUserElo(identityId || null);

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
      {/* Game Types Grid with Recent Performance */}
      <div className="overview-grid">
        {overviewStats.gameTypes.map(gameType => {
          const normalizedType = normalizeGameType(gameType.name);
          const eloData = eloByGameType?.[normalizedType];
          const currentElo = eloData?.rating;
          
          return (
          <div 
            key={gameType.name} 
            className="game-type-card"
            onClick={() => onGameTypeClick?.(gameType.name)}
            style={{ cursor: onGameTypeClick ? 'pointer' : 'default' }}
          >
            <div className="game-type-header">
              <div className="game-type-title-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="game-type-name">{gameType.name}</h3>
                {currentElo && (
                  <span 
                    className="elo-badge" 
                    style={{ 
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: 'var(--text)',
                      fontSize: '0.9rem',
                      fontWeight: '600'
                    }}
                    title="ELO Rating"
                  >
                    <TrendingUp size={14} style={{ color: 'var(--primary)'}} />
                    {currentElo}
                  </span>
                )}
              </div>
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
            
            {/* Recent Performance per Game Type */}
            <div className="game-type-recent-results">
              <div className="results-string">
                {(() => {
                  const results = gameType.recentResults || [];
                  const paddedResults = [...results];
                  // Pad with empty placeholders to always show 10 slots
                  while (paddedResults.length < 10) {
                    paddedResults.push(null);
                  }
                  return paddedResults.map((result, idx) => (
                    <span 
                      key={idx} 
                      className={`result-letter ${
                        result === 'W' ? 'win' : 
                        result === 'L' ? 'loss' : 
                        'empty'
                      }`}
                    >
                      {result || ''}
                    </span>
                  ));
                })()}
              </div>
            </div>
          </div>
        );
        })}
      </div>
    </>
  );
};

export default StatsOverview;
