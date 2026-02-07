import React, { useState, useEffect } from 'react';
import eloService from '@/shared/api/eloService';
import { PlayIcon, EyeIcon, CheckCircleIcon, AlertTriangleIcon, RefreshCwIcon, TrophyIcon, CalculatorIcon, ActivityIcon } from 'lucide-react';
import '@/styles/pages/admin.css';

const EloManagement = () => {
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
    const gameTypeText = selectedGameType || 'all game types';
    if (!window.confirm(`This will recalculate ELO ratings for ${gameTypeText}. This operation cannot be undone. Continue?`)) {
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
        <h1>ELO Management</h1>
        <p>Recalculate ELO ratings for all players from historical game data.</p>
      </div>

      {/* Info Section */}
      <div className="admin-section info-card">
        <div className="info-card-header">
          <h3>📊 How ELO Recalculation Works</h3>
        </div>
        <div className="info-card-content">
          <div className="info-columns">
            <div className="info-column">
              <h4>Process</h4>
              <ul>
                <li><strong>Resets all ratings</strong> to {config?.defaultRating || 1200}</li>
                <li><strong>Processes games</strong> in chronological order</li>
                <li><strong>Calculates changes</strong> based on actual results</li>
                <li><strong>Updates stats</strong> (games played, wins, streaks)</li>
              </ul>
            </div>
            <div className="info-column">
              <h4>When to Use</h4>
              <ul>
                <li>After fixing game data issues</li>
                <li>After linking players to identities</li>
                <li>After importing historical games</li>
                <li>To verify rating accuracy</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Config Display */}
      {config && (
        <div className="admin-section">
          <div className="section-header">
            <h2><TrophyIcon size={20} /> Current ELO Settings</h2>
          </div>
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-label">Default Rating</div>
              <div className="stat-value">{config.defaultRating}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Min Rating</div>
              <div className="stat-value">{config.minRating}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Min Games for Ranking</div>
              <div className="stat-value">{config.minGamesForRanking}</div>
            </div>
          </div>
        </div>
      )}

      {/* Actions Section */}
      <div className="admin-section">
        <div className="section-header">
          <h2><CalculatorIcon size={20} /> Recalculate Ratings</h2>
          <p>Preview changes before applying to see how many players and games will be affected.</p>
        </div>

        {/* Game Type Selector */}
        <div className="filter-group" style={{ marginBottom: '1rem' }}>
          <label htmlFor="game-type-select">Game Type:</label>
          <select
            id="game-type-select"
            value={selectedGameType}
            onChange={(e) => setSelectedGameType(e.target.value)}
            className="filter-select"
          >
            <option value="">All Game Types</option>
            <option value="wizard">Wizard</option>
            <option value="flip-7">Flip 7</option>
            <option value="dutch">Dutch</option>
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
                Analyzing...
              </>
            ) : (
              <>
                <EyeIcon size={18} />
                Preview Changes
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
                Recalculating...
              </>
            ) : (
              <>
                <PlayIcon size={18} />
                Recalculate Now
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
            <h2><EyeIcon size={20} /> Preview Results (Dry Run)</h2>
            <span className="badge badge-info">No changes applied</span>
          </div>
          
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-label">Games Processed</div>
              <div className="stat-value">{formatNumber(previewData.gamesProcessed)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Players Updated</div>
              <div className="stat-value">{formatNumber(previewData.playersUpdated)}</div>
            </div>
            {previewData.gameType && (
              <div className="stat-box">
                <div className="stat-label">Game Type</div>
                <div className="stat-value">{previewData.gameType}</div>
              </div>
            )}
          </div>

          {previewData.breakdown && (
            <div className="breakdown-section" style={{ marginTop: '1rem' }}>
              <h4>Breakdown by Game Type</h4>
              <div className="breakdown-grid">
                {Object.entries(previewData.breakdown).map(([type, count]) => (
                  <div key={type} className="breakdown-item">
                    <span className="breakdown-type">{type}</span>
                    <span className="breakdown-count">{formatNumber(count)} games</span>
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
            <h2><CheckCircleIcon size={20} /> Recalculation Complete</h2>
            <span className="badge badge-success">Applied</span>
          </div>
          
          <div className="stats-grid">
            <div className="stat-box success">
              <div className="stat-label">Games Processed</div>
              <div className="stat-value">{formatNumber(results.gamesProcessed)}</div>
            </div>
            <div className="stat-box success">
              <div className="stat-label">Players Updated</div>
              <div className="stat-value">{formatNumber(results.playersUpdated)}</div>
            </div>
            {results.gameType && (
              <div className="stat-box">
                <div className="stat-label">Game Type</div>
                <div className="stat-value">{results.gameType}</div>
              </div>
            )}
          </div>

          <div className="success-message" style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px' }}>
            <ActivityIcon size={18} style={{ color: '#22c55e' }} />
            <span style={{ marginLeft: '0.5rem' }}>
              ELO ratings have been successfully recalculated. Players can now see their updated rankings on the leaderboard.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default EloManagement;
