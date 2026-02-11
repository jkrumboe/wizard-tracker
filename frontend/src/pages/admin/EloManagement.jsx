import React, { useState, useEffect } from 'react';
import eloService from '@/shared/api/eloService';
import { PlayIcon, EyeIcon, CheckCircleIcon, AlertTriangleIcon, RefreshCwIcon, TrophyIcon, CalculatorIcon, ActivityIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import '@/styles/pages/admin.css';

const EloManagement = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(null);
  const [selectedGameType, setSelectedGameType] = useState('');

  // Load ELO config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const configData = await eloService.getConfig();
      setConfig(configData);
    } catch (err) {
      console.error('Error loading ELO config:', err);
    }
  };

  const getToken = () => localStorage.getItem('auth_token');

  const handlePreview = async () => {
    setPreviewLoading(true);
    setError(null);
    setPreviewData(null);
    setResults(null);

    try {
      const token = getToken();
      const response = await eloService.recalculateAll(token, { 
        dryRun: true, 
        gameType: selectedGameType || null 
      });
      setPreviewData(response);
    } catch (err) {
      console.error('Error previewing ELO recalculation:', err);
      setError(err.message || 'Failed to preview ELO recalculation');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRecalculate = async () => {
    const gameTypeText = selectedGameType || t('adminElo.allGameTypes');
    if (!window.confirm(t('adminElo.recalculateConfirm', { gameType: gameTypeText }))) {
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const token = getToken();
      const response = await eloService.recalculateAll(token, { 
        dryRun: false, 
        gameType: selectedGameType || null 
      });
      setResults(response);
      setPreviewData(null);
    } catch (err) {
      console.error('Error recalculating ELO:', err);
      setError(err.message || 'Failed to recalculate ELO ratings');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString();
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>{t('adminElo.title')}</h1>
        <p>{t('adminElo.description')}</p>
      </div>

      {/* Info Section */}
      <div className="admin-section info-card">
        <div className="info-card-header">
          <h3>{t('adminElo.howItWorks')}</h3>
        </div>
        <div className="info-card-content">
          <div className="info-columns">
            <div className="info-column">
              <h4>{t('adminElo.process')}</h4>
              <ul>
                <li>{t('adminElo.resetRatings', { rating: config?.defaultRating || 1200 })}</li>
                <li>{t('adminElo.chronologicalOrder')}</li>
                <li>{t('adminElo.calculatesChanges')}</li>
                <li>{t('adminElo.updatesStats')}</li>
              </ul>
            </div>
            <div className="info-column">
              <h4>{t('adminElo.whenToUse')}</h4>
              <ul>
                <li>{t('adminElo.useCase1')}</li>
                <li>{t('adminElo.useCase2')}</li>
                <li>{t('adminElo.useCase3')}</li>
                <li>{t('adminElo.useCase4')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Config Display */}
      {config && (
        <div className="admin-section">
          <div className="section-header">
            <h2><TrophyIcon size={20} /> {t('adminElo.currentSettings')}</h2>
          </div>
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-label">{t('adminElo.defaultRating')}</div>
              <div className="stat-value">{config.defaultRating}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">{t('adminElo.minRating')}</div>
              <div className="stat-value">{config.minRating}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">{t('adminElo.minGamesForRanking')}</div>
              <div className="stat-value">{config.minGamesForRanking}</div>
            </div>
          </div>
        </div>
      )}

      {/* Actions Section */}
      <div className="admin-section">
        <div className="section-header">
          <h2><CalculatorIcon size={20} /> {t('adminElo.recalculateTitle')}</h2>
          <p>{t('adminElo.recalculateDesc')}</p>
        </div>

        {/* Game Type Selector */}
        <div className="filter-group" style={{ marginBottom: '1rem' }}>
          <label htmlFor="game-type-select">{t('adminElo.gameTypeFilter')}</label>
          <select
            id="game-type-select"
            value={selectedGameType}
            onChange={(e) => setSelectedGameType(e.target.value)}
            className="filter-select"
          >
            <option value="">{t('adminElo.allGameTypes')}</option>
            <option value="wizard">{t('adminElo.wizard')}</option>
            <option value="flip-7">{t('adminElo.flip7')}</option>
            <option value="dutch">{t('adminElo.dutch')}</option>
          </select>
        </div>

        <div className="action-buttons-row">
          <button
            className="btn btn-secondary btn-with-icon"
            onClick={handlePreview}
            disabled={loading || previewLoading}
          >
            {previewLoading ? (
              <>
                <RefreshCwIcon size={18} className="spinning" />
                {t('adminElo.analyzing')}
              </>
            ) : (
              <>
                <EyeIcon size={18} />
                {t('adminElo.previewChanges')}
              </>
            )}
          </button>
          <button
            className="btn btn-primary btn-with-icon"
            onClick={handleRecalculate}
            disabled={loading || previewLoading}
          >
            {loading ? (
              <>
                <RefreshCwIcon size={18} className="spinning" />
                {t('adminElo.recalculating')}
              </>
            ) : (
              <>
                <PlayIcon size={18} />
                {t('adminElo.recalculateNow')}
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertTriangleIcon size={18} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Preview Results */}
      {previewData && (
        <div className="admin-section results-section">
          <div className="section-header">
            <h2><EyeIcon size={20} /> {t('adminElo.previewResults')}</h2>
            <span className="badge badge-info">{t('adminElo.noChangesApplied')}</span>
          </div>
          
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-label">{t('adminElo.gamesProcessed')}</div>
              <div className="stat-value">{formatNumber(previewData.gamesProcessed)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">{t('adminElo.playersUpdated')}</div>
              <div className="stat-value">{formatNumber(previewData.playersUpdated)}</div>
            </div>
            {previewData.gameType && (
              <div className="stat-box">
              <div className="stat-label">{t('adminElo.gameType')}</div>
                <div className="stat-value">{previewData.gameType}</div>
              </div>
            )}
          </div>

          {previewData.breakdown && (
            <div className="breakdown-section" style={{ marginTop: '1rem' }}>
              <h4>{t('adminElo.breakdownByType')}</h4>
              <div className="breakdown-grid">
                {Object.entries(previewData.breakdown).map(([type, count]) => (
                  <div key={type} className="breakdown-item">
                    <span className="breakdown-type">{type}</span>
                    <span className="breakdown-count">{t('adminElo.gamesCount', { count: formatNumber(count) })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actual Results */}
      {results && (
        <div className="admin-section results-section success-section">
          <div className="section-header">
            <h2><CheckCircleIcon size={20} /> {t('adminElo.recalculationComplete')}</h2>
            <span className="badge badge-success">{t('adminElo.applied')}</span>
          </div>
          
          <div className="stats-grid">
            <div className="stat-box success">
              <div className="stat-label">{t('adminElo.gamesProcessed')}</div>
              <div className="stat-value">{formatNumber(results.gamesProcessed)}</div>
            </div>
            <div className="stat-box success">
              <div className="stat-label">{t('adminElo.playersUpdated')}</div>
              <div className="stat-value">{formatNumber(results.playersUpdated)}</div>
            </div>
            {results.gameType && (
              <div className="stat-box">
              <div className="stat-label">{t('adminElo.gameType')}</div>
                <div className="stat-value">{results.gameType}</div>
              </div>
            )}
          </div>

          <div className="success-message" style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px' }}>
            <ActivityIcon size={18} style={{ color: '#22c55e' }} />
            <span style={{ marginLeft: '0.5rem' }}>
              {t('adminElo.successMessage')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default EloManagement;
