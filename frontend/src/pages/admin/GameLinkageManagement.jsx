import React, { useState } from 'react';
import userService from '@/shared/api/userService';
import '@/styles/pages/admin.css';

const GameLinkageManagement = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleLinkAllGames = async () => {
    if (!window.confirm('This will scan all users and link their games. This may take a while. Continue?')) {
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await userService.linkAllUserGames();
      setResults(response.results);
      alert(`Success! Linked ${response.results.totalGamesLinked} games for ${response.results.successful} users.`);
    } catch (err) {
      console.error('Error linking games:', err);
      setError(err.message || 'Failed to link games');
      alert('Error: ' + (err.message || 'Failed to link games'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Game Linkage Management</h1>
        <p>Retroactively link games to user accounts for users who registered before this feature was added.</p>
      </div>

      <div className="admin-section">
        <div className="section-header">
          <h2>Link All User Games</h2>
          <p>
            This will scan all user accounts and link any games where the username appears as a player.
            Games are matched by exact username (case-sensitive) and player aliases.
          </p>
        </div>

        <div className="action-card">
          <div className="action-info">
            <h3>How it works:</h3>
            <ul>
              <li>Scans all registered users</li>
              <li>Finds games where username appears as a player</li>
              <li>Updates game userId to link to user account</li>
              <li>Skips games already linked to the user</li>
              <li>Safe operation - won't break existing data</li>
            </ul>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleLinkAllGames}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Link All User Games'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {results && (
          <div className="results-section">
            <h3>Linkage Results</h3>
            <div className="stats-grid">
              <div className="stat-box">
                <div className="stat-value">{results.totalUsers}</div>
                <div className="stat-label">Total Users</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{results.processed}</div>
                <div className="stat-label">Processed</div>
              </div>
              <div className="stat-box success">
                <div className="stat-value">{results.successful}</div>
                <div className="stat-label">Successful</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{results.totalGamesLinked}</div>
                <div className="stat-label">Games Linked</div>
              </div>
              {results.failed > 0 && (
                <div className="stat-box error">
                  <div className="stat-value">{results.failed}</div>
                  <div className="stat-label">Failed</div>
                </div>
              )}
            </div>

            {results.details && results.details.length > 0 && (
              <div className="details-section">
                <h4>Details</h4>
                <div className="details-list">
                  {results.details.map((detail, idx) => (
                    <div key={idx} className={`detail-item ${detail.success ? 'success' : 'error'}`}>
                      <div className="detail-username">{detail.username}</div>
                      {detail.success ? (
                        <div className="detail-games">
                          {detail.gamesLinked} game{detail.gamesLinked !== 1 ? 's' : ''} linked
                        </div>
                      ) : (
                        <div className="detail-error">
                          {detail.error || 'Failed'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="admin-section info-section">
        <h3>When to use this feature:</h3>
        <ul>
          <li><strong>After initial deployment:</strong> Link games for existing users who registered before this feature</li>
          <li><strong>Data migration:</strong> After importing users or games from another system</li>
          <li><strong>Troubleshooting:</strong> If automatic linking failed during registration</li>
        </ul>

        <h3>What happens to games:</h3>
        <ul>
          <li>Only updates the <code>userId</code> field on matching games</li>
          <li>Doesn't modify game data, scores, or player names</li>
          <li>Games already linked to the user are skipped</li>
          <li>Safe to run multiple times (idempotent)</li>
        </ul>

        <div className="warning-box">
          <strong>⚠️ Note:</strong> This operation may take several seconds to minutes depending on the number of users and games in your database.
        </div>
      </div>
    </div>
  );
};

export default GameLinkageManagement;
