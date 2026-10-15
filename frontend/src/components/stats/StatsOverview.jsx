import React from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Link } from 'react-router-dom';
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
  const { t } = useTranslation();
  const overviewStats = useGameStats(games, user);
  const { eloByGameType, loading: _eloLoading } = useAllUserElo(identityId || null);

  if (!user) {
    return (
      <div className="settings-section">
        <p style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Trans i18nKey="account.loginToViewStats" components={{ loginLink: <Link to="/login" /> }} />
        </p>
      </div>
    );
  }

  if (overviewStats.gameTypes.length === 0) {
    return (
      <div className="settings-section">
        <p style={{ textAlign: 'center', padding: '40px 20px' }}>
          {t('profile.noGamesYet')}
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
              <h3 className="game-type-name" title={gameType.name}>{gameType.name}</h3>
              {currentElo && (
                <span className="game-type-elo" title={t('profile.eloRating')}>
                  <TrendingUp size={14} aria-hidden="true" />
                  {currentElo}
                </span>
              )}
            </div>
            <div className="game-type-stats">
              <div className="stat-item">
                <span className="stat-label">{t('account.winRateLabel')}</span>
                <span className="stat-value win-rate">
                  {Math.round((gameType.wins / gameType.matches) * 100)}%
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">{t('account.matchesLabel')}</span>
                <span className="stat-value">{gameType.matches}</span>
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
