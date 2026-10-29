import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import userService from '@/shared/api/userService';
import Icon from '@/components/ui/Icon';
import {
  AdminEmpty,
  AdminExplainer,
  AdminNotice,
  AdminPageHeader,
  AdminPill,
  AdminSection,
  AdminStat,
  AdminStats,
} from '@/components/admin/AdminUI';
import {
  useAdminConfirm,
} from '@/components/admin/adminUtils';
import '@/styles/pages/admin.css';

const GameLinkageManagement = () => {
  const { t } = useTranslation();
  const [confirm, confirmDialog] = useAdminConfirm();
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState(null);
  const [expandedUsers, setExpandedUsers] = useState({});
  const [showAllDetails, setShowAllDetails] = useState(false);

  const toggleUserExpanded = (userId) => {
    setExpandedUsers(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setError(null);
    setPreviewData(null);
    setResults(null);

    try {
      setPreviewData(await userService.previewLinkAllGames());
    } catch (err) {
      console.error('Error previewing linkage:', err);
      setError(err.message || t('adminGameLinkage.previewFailed'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleLinkAllGames = async () => {
    const ok = await confirm({
      title: t('adminGameLinkage.linkAllTitle'),
      message: t('adminGameLinkage.linkConfirm'),
      confirmLabel: t('adminGameLinkage.linkAllNow'),
    });
    if (!ok) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await userService.linkAllUserGames();
      setResults(response.results);
      setPreviewData(null);
    } catch (err) {
      console.error('Error linking games:', err);
      setError(err.message || t('adminGameLinkage.linkFailed'));
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || previewLoading;

  return (
    <div className="adm-page">
      <AdminPageHeader title={t('adminGameLinkage.title')} subtitle={t('adminGameLinkage.description')} />

      <AdminExplainer title={t('adminGameLinkage.howItWorks')}>
        <div className="adm-explainer-columns">
          <div>
            <h3>{t('adminGameLinkage.matchingProcess')}</h3>
            <ul className="adm-bullets">
              <li><strong>{t('adminGameLinkage.caseInsensitive')}</strong> {t('adminGameLinkage.caseInsensitiveDesc')}</li>
              <li><strong>{t('adminGameLinkage.identitiesIncluded')}</strong> {t('adminGameLinkage.identitiesIncludedDesc')}</li>
              <li><strong>{t('adminGameLinkage.allGameTypes')}</strong> {t('adminGameLinkage.allGameTypesDesc')}</li>
            </ul>
          </div>
          <div>
            <h3>{t('adminGameLinkage.whatGetsUpdated')}</h3>
            <ul className="adm-bullets">
              <li>{t('adminGameLinkage.onlyUserId')}</li>
              <li>{t('adminGameLinkage.dataUnchanged')}</li>
              <li>{t('adminGameLinkage.alreadyLinkedSkipped')}</li>
            </ul>
          </div>
          <div>
            <h3>{t('adminGameLinkage.whenToUse')}</h3>
            <ul className="adm-bullets">
              <li><strong>{t('adminGameLinkage.useCase1')}</strong> {t('adminGameLinkage.useCase1Desc')}</li>
              <li><strong>{t('adminGameLinkage.useCase2')}</strong> {t('adminGameLinkage.useCase2Desc')}</li>
              <li><strong>{t('adminGameLinkage.useCase3')}</strong> {t('adminGameLinkage.useCase3Desc')}</li>
            </ul>
          </div>
        </div>
        <p className="adm-muted">
          <strong>{t('adminGameLinkage.safeOperation')}</strong> {t('adminGameLinkage.safeOperationDesc')}
        </p>
      </AdminExplainer>

      <AdminSection icon="Link" title={t('adminGameLinkage.linkAllTitle')} description={t('adminGameLinkage.linkAllDesc')}>
        <div className="adm-actions">
          <button type="button" className="adm-btn adm-btn--secondary" onClick={handlePreview} disabled={busy}>
            <Icon name={previewLoading ? 'RefreshCw' : 'Eye'} size={16} className={previewLoading ? 'adm-spin' : ''} />
            {previewLoading ? t('adminGameLinkage.analyzing') : t('adminGameLinkage.previewChanges')}
          </button>
          <button type="button" className="adm-btn adm-btn--primary" onClick={handleLinkAllGames} disabled={busy}>
            <Icon name={loading ? 'RefreshCw' : 'Play'} size={16} className={loading ? 'adm-spin' : ''} />
            {loading ? t('adminGameLinkage.linkingProgress') : t('adminGameLinkage.linkAllNow')}
          </button>
        </div>

        {error && <AdminNotice tone="error">{error}</AdminNotice>}
      </AdminSection>

      {previewData && (
        <AdminSection
          icon="Eye"
          title={t('adminGameLinkage.previewTitle')}
          description={t('adminGameLinkage.dryRunNote')}
          actions={<AdminPill tone="accent">{t('adminElo.noChangesApplied')}</AdminPill>}
        >
          <AdminStats>
            <AdminStat icon="Users" label={t('adminGameLinkage.totalUsers')} value={previewData.totalUsers} />
            <AdminStat icon="Users" tone="accent" label={t('adminGameLinkage.usersWithLinkable')} value={previewData.usersWithGames} />
            <AdminStat icon="Gamepad2" tone="success" label={t('adminGameLinkage.gamesToLink')} value={previewData.totalGamesToLink} />
          </AdminStats>

          {previewData.userDetails?.length > 0 && (
            <div className="adm-review-block">
              <div className="adm-block-head">
                <h3>{t('adminGameLinkage.usersWithGames', { count: previewData.userDetails.length })}</h3>
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setShowAllDetails(!showAllDetails)}>
                  {showAllDetails ? t('adminGameLinkage.collapseAll') : t('adminGameLinkage.expandAll')}
                </button>
              </div>
              <ul className="adm-list">
                {previewData.userDetails.map(user => {
                  const open = showAllDetails || expandedUsers[user.userId];
                  return (
                    <li key={user.userId} className={open ? 'is-open' : undefined}>
                      <button type="button" className="adm-list-row" onClick={() => toggleUserExpanded(user.userId)} aria-expanded={Boolean(open)}>
                        <Icon name="Link" size={16} className="adm-muted" />
                        <span className="adm-list-main">
                          <strong>{user.username}</strong>
                          {user.identities?.length > 1 && (
                            <span>{t('adminGameLinkage.identitiesCount', { count: user.identities.length })}</span>
                          )}
                        </span>
                        <AdminPill tone="success">{t('adminGameLinkage.gamesCount', { count: user.gamesToLink })}</AdminPill>
                        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={16} className="adm-list-chevron" />
                      </button>
                      {open && user.gameBreakdown && (
                        <div className="adm-list-detail">
                          <dl className="adm-spec">
                            {user.gameBreakdown.games > 0 && (
                              <div><dt>{t('adminGameLinkage.regularGames')}</dt><dd>{user.gameBreakdown.games}</dd></div>
                            )}
                            {user.gameBreakdown.wizardGames > 0 && (
                              <div><dt>{t('adminGameLinkage.wizardGames')}</dt><dd>{user.gameBreakdown.wizardGames}</dd></div>
                            )}
                            {user.gameBreakdown.tableGames > 0 && (
                              <div><dt>{t('adminGameLinkage.tableGames')}</dt><dd>{user.gameBreakdown.tableGames}</dd></div>
                            )}
                          </dl>
                          {user.identities?.length > 0 && (
                            <div className="adm-chips">
                              <span className="adm-muted">{t('adminGameLinkage.identitiesLabel')}</span>
                              {user.identities.map((identity, index) => (
                                <span key={identity._id || index} className="adm-chip">{identity.displayName || identity.name}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {previewData.totalGamesToLink === 0 ? (
            <AdminEmpty icon="CheckCircle2" tone="success" title={t('adminGameLinkage.allLinked')}>
              {t('adminGameLinkage.allLinkedDesc')}
            </AdminEmpty>
          ) : (
            <div className="adm-actions adm-actions--end">
              <button type="button" className="adm-btn adm-btn--primary" onClick={handleLinkAllGames} disabled={loading}>
                <Icon name={loading ? 'RefreshCw' : 'Play'} size={16} className={loading ? 'adm-spin' : ''} />
                {loading
                  ? t('adminGameLinkage.linkingProgress')
                  : t('adminGameLinkage.applyChanges', { count: previewData.totalGamesToLink })}
              </button>
            </div>
          )}
        </AdminSection>
      )}

      {results && (
        <AdminSection icon="CheckCircle2" title={t('adminGameLinkage.claimingComplete')} tone="success">
          <AdminStats>
            <AdminStat label={t('adminGameLinkage.totalUsers')} value={results.totalUsers} />
            <AdminStat label={t('adminGameLinkage.processed')} value={results.processed} />
            <AdminStat label={t('adminGameLinkage.successful')} value={results.successful} tone="success" />
            <AdminStat label={t('adminGameLinkage.identitiesClaimed')} value={results.totalIdentitiesClaimed || 0} tone="accent" />
            {results.failed > 0 && <AdminStat label={t('adminGameLinkage.failed')} value={results.failed} tone="danger" />}
          </AdminStats>

          {results.details?.length > 0 && (
            <div className="adm-review-block">
              <h3>{t('adminGameLinkage.changesMade')}</h3>
              <ul className="adm-list">
                {results.details.map((detail, index) => {
                  const claimed = (detail.identitiesClaimed || 0) > 0 || detail.identityCreated;
                  return (
                    <li key={detail.userId || index}>
                      <div className="adm-list-row is-static">
                        <Icon
                          name={!detail.success ? 'XCircle' : claimed ? 'CheckCircle2' : 'Minus'}
                          size={18}
                          className={!detail.success ? 'adm-text-danger' : claimed ? 'adm-text-success' : 'adm-muted'}
                        />
                        <span className="adm-list-main">
                          <strong>{detail.username}</strong>
                          <span className={detail.success ? undefined : 'adm-text-danger'}>
                            {detail.success
                              ? `${t('adminGameLinkage.identitiesClaimedCount', { count: detail.identitiesClaimed || 0 })}${detail.identityCreated ? `, ${t('adminGameLinkage.newIdentityCreated')}` : ''}`
                              : detail.error || t('adminGameLinkage.failed')}
                          </span>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {(results.totalIdentitiesClaimed || 0) === 0 && (
            <AdminEmpty icon="CheckCircle2" title={t('adminGameLinkage.noNewIdentities')}>
              {t('adminGameLinkage.noNewIdentitiesDesc')}
            </AdminEmpty>
          )}
        </AdminSection>
      )}

      {confirmDialog}
    </div>
  );
};

export default GameLinkageManagement;
