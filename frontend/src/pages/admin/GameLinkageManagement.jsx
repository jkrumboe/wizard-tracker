import React, { useState } from 'react';
import userService from '@/shared/api/userService';
import { PlayIcon, EyeIcon, CheckCircleIcon, XCircleIcon, AlertTriangleIcon, ChevronDownIcon, ChevronUpIcon, RefreshCwIcon, UsersIcon, GamepadIcon, LinkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import '@/styles/pages/admin.css';

const GameLinkageManagement = () => {
  const { t } = useTranslation();
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
    if (!window.confirm(t('adminGameLinkage.linkConfirm'))) {
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
        <h1>{t('adminGameLinkage.title')}</h1>
        <p>{t('adminGameLinkage.description')}</p>
      </div>

      {/* How It Works Section */}
      <div className="admin-section info-card">
        <div className="info-card-header">
          <h3>{t('adminGameLinkage.howItWorks')}</h3>
        </div>
        <div className="info-card-content">
          <div className="info-columns">
            <div className="info-column">
              <h4>{t('adminGameLinkage.matchingProcess')}</h4>
              <ul>
                <li><strong>{t('adminGameLinkage.caseInsensitive')}</strong> {t('adminGameLinkage.caseInsensitiveDesc')}</li>
                <li><strong>{t('adminGameLinkage.identitiesIncluded')}</strong> {t('adminGameLinkage.identitiesIncludedDesc')}</li>
                <li><strong>{t('adminGameLinkage.allGameTypes')}</strong> {t('adminGameLinkage.allGameTypesDesc')}</li>
              </ul>
            </div>
            <div className="info-column">
              <h4>{t('adminGameLinkage.whatGetsUpdated')}</h4>
              <ul>
                <li>{t('adminGameLinkage.onlyUserId')}</li>
                <li>{t('adminGameLinkage.dataUnchanged')}</li>
                <li>{t('adminGameLinkage.alreadyLinkedSkipped')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Section */}
      <div className="admin-section">
        <div className="section-header">
          <h2>{t('adminGameLinkage.linkAllTitle')}</h2>
          <p>{t('adminGameLinkage.linkAllDesc')}</p>
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
                {t('adminGameLinkage.analyzing')}
              </>
            ) : (
              <>
                <EyeIcon size={18} />
                {t('adminGameLinkage.previewChanges')}
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
                {t('adminGameLinkage.linkingProgress')}
              </>
            ) : (
              <>
                <PlayIcon size={18} />
                {t('adminGameLinkage.linkAllNow')}
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
              {t('adminGameLinkage.previewTitle')}
            </h2>
            <p>{t('adminGameLinkage.dryRunNote')}</p>
          </div>

          <div className="stats-grid">
            <div className="stat-box">
              <UsersIcon size={24} className="stat-icon" />
              <div className="stat-value">{previewData.totalUsers}</div>
              <div className="stat-label">{t('adminGameLinkage.totalUsers')}</div>
            </div>
            <div className="stat-box highlight">
              <UsersIcon size={24} className="stat-icon" />
              <div className="stat-value">{previewData.usersWithGames}</div>
              <div className="stat-label">{t('adminGameLinkage.usersWithLinkable')}</div>
            </div>
            <div className="stat-box success">
              <GamepadIcon size={24} className="stat-icon" />
              <div className="stat-value">{previewData.totalGamesToLink}</div>
              <div className="stat-label">{t('adminGameLinkage.gamesToLink')}</div>
            </div>
          </div>

          {previewData.userDetails && previewData.userDetails.length > 0 && (
            <div className="details-section">
              <div className="details-header">
                <h4>{t('adminGameLinkage.usersWithGames', { count: previewData.userDetails.length })}</h4>
                <button 
                  className="btn btn-sm btn-ghost"
                  onClick={() => setShowAllDetails(!showAllDetails)}
                >
                  {showAllDetails ? t('adminGameLinkage.collapseAll') : t('adminGameLinkage.expandAll')}
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
                          {t('adminGameLinkage.gamesCount', { count: user.gamesToLink })}
                        </span>
                        {user.identities && user.identities.length > 1 && (
                          <span className="aliases-badge">
                            {t('adminGameLinkage.identitiesCount', { count: user.identities.length })}
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
                              <span className="breakdown-label">{t('adminGameLinkage.regularGames')}</span>
                              <span className="breakdown-value">{user.gameBreakdown.games}</span>
                            </div>
                          )}
                          {user.gameBreakdown.wizardGames > 0 && (
                            <div className="breakdown-item">
                              <span className="breakdown-label">{t('adminGameLinkage.wizardGames')}</span>
                              <span className="breakdown-value">{user.gameBreakdown.wizardGames}</span>
                            </div>
                          )}
                          {user.gameBreakdown.tableGames > 0 && (
                            <div className="breakdown-item">
                              <span className="breakdown-label">{t('adminGameLinkage.tableGames')}</span>
                              <span className="breakdown-value">{user.gameBreakdown.tableGames}</span>
                            </div>
                          )}
                        </div>
                        {user.identities && user.identities.length > 0 && (
                          <div className="aliases-list">
                            <span className="aliases-label">{t('adminGameLinkage.identitiesLabel')}</span>
                            {user.identities.map((identity, i) => (
                              <span key={i} className="alias-tag">{identity.displayName || identity.name}</span>
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
              <h4>{t('adminGameLinkage.allLinked')}</h4>
              <p>{t('adminGameLinkage.allLinkedDesc')}</p>
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
                    {t('adminGameLinkage.linkingProgress')}
                  </>
                ) : (
                  <>
                    <PlayIcon size={18} />
                    {t('adminGameLinkage.applyChanges', { count: previewData.totalGamesToLink })}
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
              {t('adminGameLinkage.claimingComplete')}
            </h2>
          </div>

          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-value">{results.totalUsers}</div>
              <div className="stat-label">{t('adminGameLinkage.totalUsers')}</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{results.processed}</div>
              <div className="stat-label">{t('adminGameLinkage.processed')}</div>
            </div>
            <div className="stat-box success">
              <div className="stat-value">{results.successful}</div>
              <div className="stat-label">{t('adminGameLinkage.successful')}</div>
            </div>
            <div className="stat-box highlight">
              <div className="stat-value">{results.totalIdentitiesClaimed || 0}</div>
              <div className="stat-label">{t('adminGameLinkage.identitiesClaimed')}</div>
            </div>
            {results.failed > 0 && (
              <div className="stat-box error">
                <div className="stat-value">{results.failed}</div>
                <div className="stat-label">{t('adminGameLinkage.failed')}</div>
              </div>
            )}
          </div>

          {results.details && results.details.length > 0 && (
            <div className="details-section">
              <h4>{t('adminGameLinkage.changesMade')}</h4>
              <div className="details-list">
                {results.details.map((detail, idx) => (
                  <div key={idx} className={`detail-item ${detail.success ? 'success' : 'error'}`}>
                    {renderStatusIcon(detail.success, (detail.identitiesClaimed || 0) > 0 || detail.identityCreated)}
                    <div className="detail-content">
                      <div className="detail-username">{detail.username}</div>
                      {detail.success ? (
                        <div className="detail-games">
                          {t('adminGameLinkage.identitiesClaimedCount', { count: detail.identitiesClaimed || 0 })}{detail.identityCreated ? ', ' + t('adminGameLinkage.newIdentityCreated') : ''}
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

          {(results.totalIdentitiesClaimed || 0) === 0 && (
            <div className="empty-state">
              <CheckCircleIcon size={48} className="empty-icon" />
              <h4>{t('adminGameLinkage.noNewIdentities')}</h4>
              <p>{t('adminGameLinkage.noNewIdentitiesDesc')}</p>
            </div>
          )}
        </div>
      )}

      {/* When to Use Section */}
      <div className="admin-section info-section">
        <h3>{t('adminGameLinkage.whenToUse')}</h3>
        <div className="use-cases">
          <div className="use-case">
            <strong>{t('adminGameLinkage.useCase1')}</strong>
            <span>{t('adminGameLinkage.useCase1Desc')}</span>
          </div>
          <div className="use-case">
            <strong>{t('adminGameLinkage.useCase2')}</strong>
            <span>{t('adminGameLinkage.useCase2Desc')}</span>
          </div>
          <div className="use-case">
            <strong>{t('adminGameLinkage.useCase3')}</strong>
            <span>{t('adminGameLinkage.useCase3Desc')}</span>
          </div>
        </div>

        <div className="info-box">
          <strong>{t('adminGameLinkage.safeOperation')}</strong> {t('adminGameLinkage.safeOperationDesc')}
        </div>
      </div>
    </div>
  );
};

export default GameLinkageManagement;
