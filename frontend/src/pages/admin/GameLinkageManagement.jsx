import React, { useState } from 'react';
import userService from '@/shared/api/userService';
import { PlayIcon, EyeIcon, CheckCircleIcon, XCircleIcon, AlertTriangleIcon, ChevronDownIcon, ChevronUpIcon, RefreshCwIcon, UsersIcon, GamepadIcon, LinkIcon } from 'lucide-react';
import '@/styles/pages/admin.css';

const GameLinkageManagement = () => {
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState(null);
  const [expandedUsers, setExpandedUsers] = useState({});
  const [showAllDetails, setShowAllDetails] = useState(false);

  const toggleUserExpanded = (userId) => {
    setExpandedUsers(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setError(null);
    setPreviewData(null);
    setResults(null);

    try {
      const response = await userService.previewLinkAllGames();
      setPreviewData(response);
    } catch (err) {
      console.error('Error previewing linkage:', err);
      setError(err.message || 'Failed to preview game linkage');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleLinkAllGames = async () => {
    if (!window.confirm('This will link all identified games to their respective user accounts. Continue?')) {
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await userService.linkAllUserGames();
      setResults(response.results);
      setPreviewData(null); // Clear preview after successful execution
    } catch (err) {
      console.error('Error linking games:', err);
      setError(err.message || 'Failed to link games');
    } finally {
      setLoading(false);
    }
  };

  const renderStatusIcon = (success, hasGames) => {
    if (success && hasGames) {
      return <CheckCircleIcon size={18} className="status-icon success" />;
    } else if (success) {
      return <span className="status-icon neutral">—</span>;
    } else {
      return <XCircleIcon size={18} className="status-icon error" />;
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Game Linkage Management</h1>
        <p>Retroactively link games to user accounts based on player names.</p>
      </div>

      {/* How It Works Section */}
      <div className="admin-section info-card">
        <div className="info-card-header">
          <h3>🔗 How Game Linking Works</h3>
        </div>
        <div className="info-card-content">
          <div className="info-columns">
            <div className="info-column">
              <h4>Matching Process</h4>
              <ul>
                <li><strong>Case-insensitive:</strong> "John" matches "john", "JOHN", etc.</li>
                <li><strong>Aliases included:</strong> Player aliases are also checked</li>
                <li><strong>All game types:</strong> Regular games, Wizard games, and Table games</li>
              </ul>
            </div>
            <div className="info-column">
              <h4>What Gets Updated</h4>
              <ul>
                <li>Only the <code>userId</code> field is modified</li>
                <li>Game data, scores, and player names remain unchanged</li>
                <li>Already-linked games are automatically skipped</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Section */}
      <div className="admin-section">
        <div className="section-header">
          <h2>Link All User Games</h2>
          <p>Scan all registered users and link games where their username (or alias) appears as a player.</p>
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
            onClick={handleLinkAllGames}
            disabled={loading || previewLoading}
          >
            {loading ? (
              <>
                <RefreshCwIcon size={18} className="spinning" />
                Linking...
              </>
            ) : (
              <>
                <PlayIcon size={18} />
                Link All Games Now
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
        <div className="admin-section results-section preview-section">
          <div className="section-header">
            <h2>
              <EyeIcon size={20} />
              Preview: What Will Be Linked
            </h2>
            <p>This is a dry-run preview. No changes have been made yet.</p>
          </div>

          <div className="stats-grid">
            <div className="stat-box">
              <UsersIcon size={24} className="stat-icon" />
              <div className="stat-value">{previewData.totalUsers}</div>
              <div className="stat-label">Total Users</div>
            </div>
            <div className="stat-box highlight">
              <UsersIcon size={24} className="stat-icon" />
              <div className="stat-value">{previewData.usersWithGames}</div>
              <div className="stat-label">Users with Linkable Games</div>
            </div>
            <div className="stat-box success">
              <GamepadIcon size={24} className="stat-icon" />
              <div className="stat-value">{previewData.totalGamesToLink}</div>
              <div className="stat-label">Games to Link</div>
            </div>
          </div>

          {previewData.userDetails && previewData.userDetails.length > 0 && (
            <div className="details-section">
              <div className="details-header">
                <h4>Users with Games to Link ({previewData.userDetails.length})</h4>
                <button 
                  className="btn btn-sm btn-ghost"
                  onClick={() => setShowAllDetails(!showAllDetails)}
                >
                  {showAllDetails ? 'Collapse All' : 'Expand All'}
                </button>
              </div>
              <div className="user-list">
                {previewData.userDetails.map((user, idx) => (
                  <div key={idx} className="user-item">
                    <div 
                      className="user-item-header"
                      onClick={() => toggleUserExpanded(user.userId)}
                    >
                      <div className="user-info">
                        <LinkIcon size={16} className="link-icon" />
                        <span className="username">{user.username}</span>
                        <span className="game-count badge">
                          {user.gamesToLink} game{user.gamesToLink !== 1 ? 's' : ''}
                        </span>
                        {user.aliases && user.aliases.length > 0 && (
                          <span className="aliases-badge">
                            + {user.aliases.length} alias{user.aliases.length !== 1 ? 'es' : ''}
                          </span>
                        )}
                      </div>
                      {expandedUsers[user.userId] || showAllDetails ? (
                        <ChevronUpIcon size={18} />
                      ) : (
                        <ChevronDownIcon size={18} />
                      )}
                    </div>
                    {(expandedUsers[user.userId] || showAllDetails) && user.gameBreakdown && (
                      <div className="user-item-details">
                        <div className="breakdown-grid">
                          {user.gameBreakdown.games > 0 && (
                            <div className="breakdown-item">
                              <span className="breakdown-label">Regular Games:</span>
                              <span className="breakdown-value">{user.gameBreakdown.games}</span>
                            </div>
                          )}
                          {user.gameBreakdown.wizardGames > 0 && (
                            <div className="breakdown-item">
                              <span className="breakdown-label">Wizard Games:</span>
                              <span className="breakdown-value">{user.gameBreakdown.wizardGames}</span>
                            </div>
                          )}
                          {user.gameBreakdown.tableGames > 0 && (
                            <div className="breakdown-item">
                              <span className="breakdown-label">Table Games:</span>
                              <span className="breakdown-value">{user.gameBreakdown.tableGames}</span>
                            </div>
                          )}
                        </div>
                        {user.aliases && user.aliases.length > 0 && (
                          <div className="aliases-list">
                            <span className="aliases-label">Aliases:</span>
                            {user.aliases.map((alias, i) => (
                              <span key={i} className="alias-tag">{alias}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {previewData.totalGamesToLink === 0 && (
            <div className="empty-state">
              <CheckCircleIcon size={48} className="empty-icon success" />
              <h4>All Games Already Linked</h4>
              <p>No unlinked games were found for any users. Everything is up to date!</p>
            </div>
          )}

          {previewData.totalGamesToLink > 0 && (
            <div className="preview-action">
              <button
                className="btn btn-primary btn-lg btn-with-icon"
                onClick={handleLinkAllGames}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <RefreshCwIcon size={18} className="spinning" />
                    Linking...
                  </>
                ) : (
                  <>
                    <PlayIcon size={18} />
                    Apply Changes: Link {previewData.totalGamesToLink} Games
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Execution Results */}
      {results && (
        <div className="admin-section results-section execution-section">
          <div className="section-header success-header">
            <h2>
              <CheckCircleIcon size={20} />
              Linkage Complete
            </h2>
          </div>

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
            <div className="stat-box highlight">
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
              <h4>Changes Made</h4>
              <div className="details-list">
                {results.details.map((detail, idx) => (
                  <div key={idx} className={`detail-item ${detail.success ? 'success' : 'error'}`}>
                    {renderStatusIcon(detail.success, detail.gamesLinked > 0)}
                    <div className="detail-content">
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
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.totalGamesLinked === 0 && (
            <div className="empty-state">
              <CheckCircleIcon size={48} className="empty-icon" />
              <h4>No New Games to Link</h4>
              <p>All games were already linked to their respective users.</p>
            </div>
          )}
        </div>
      )}

      {/* When to Use Section */}
      <div className="admin-section info-section">
        <h3>When to use this feature:</h3>
        <div className="use-cases">
          <div className="use-case">
            <strong>🚀 After initial deployment:</strong>
            <span>Link games for existing users who registered before this feature</span>
          </div>
          <div className="use-case">
            <strong>📦 Data migration:</strong>
            <span>After importing users or games from another system</span>
          </div>
          <div className="use-case">
            <strong>🔧 Troubleshooting:</strong>
            <span>If automatic linking failed during registration</span>
          </div>
        </div>

        <div className="info-box">
          <strong>ℹ️ Safe Operation:</strong> This is idempotent - you can run it multiple times safely. 
          Games already linked to users will be skipped.
        </div>
      </div>
    </div>
  );
};

export default GameLinkageManagement;
