import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import eloService from '@/shared/api/eloService';
import Icon from '@/components/ui/Icon';
import {
  AdminExplainer,
  AdminNotice,
  AdminPageHeader,
  AdminPill,
  AdminSection,
  AdminStat,
  AdminStats,
  AdminTabs,
} from '@/components/admin/AdminUI';
import {
  useAdminConfirm,
} from '@/components/admin/adminUtils';
import '@/styles/pages/admin.css';

const formatNumber = (num) => (num === undefined || num === null ? '0' : num.toLocaleString());

function RunResult({ data, applied }) {
  const { t } = useTranslation();
  return (
    <AdminSection
      icon={applied ? 'CheckCircle2' : 'Eye'}
      title={applied ? t('adminElo.recalculationComplete') : t('adminElo.previewResults')}
      tone={applied ? 'success' : undefined}
      actions={applied
        ? <AdminPill tone="success">{t('adminElo.applied')}</AdminPill>
        : <AdminPill tone="accent">{t('adminElo.noChangesApplied')}</AdminPill>}
    >
      <AdminStats>
        <AdminStat label={t('adminElo.gamesProcessed')} value={formatNumber(data.gamesProcessed)} tone={applied ? 'success' : undefined} />
        <AdminStat label={t('adminElo.playersUpdated')} value={formatNumber(data.playersUpdated)} tone={applied ? 'success' : undefined} />
        {data.gameType && <AdminStat label={t('adminElo.gameType')} value={data.gameType} />}
      </AdminStats>

      {!applied && data.breakdown && (
        <div className="adm-review-block">
          <h3>{t('adminElo.breakdownByType')}</h3>
          <dl className="adm-spec">
            {Object.entries(data.breakdown).map(([type, count]) => (
              <div key={type}>
                <dt>{type}</dt>
                <dd>{t('adminElo.gamesCount', { count: formatNumber(count) })}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {applied && <AdminNotice tone="success">{t('adminElo.successMessage')}</AdminNotice>}
    </AdminSection>
  );
}

const EloManagement = () => {
  const { t } = useTranslation();
  const [confirm, confirmDialog] = useAdminConfirm();
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(null);
  const [selectedGameType, setSelectedGameType] = useState('');

  useEffect(() => {
    eloService.getConfig()
      .then(setConfig)
      .catch(err => console.error('Error loading ELO config:', err));
  }, []);

  const getToken = () => localStorage.getItem('auth_token');

  const handlePreview = async () => {
    setPreviewLoading(true);
    setError(null);
    setPreviewData(null);
    setResults(null);

    try {
      const response = await eloService.recalculateAll(getToken(), {
        dryRun: true,
        gameType: selectedGameType || null
      });
      setPreviewData(response);
    } catch (err) {
      console.error('Error previewing ELO recalculation:', err);
      setError(err.message || t('adminElo.previewFailed'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRecalculate = async () => {
    const gameTypeText = selectedGameType || t('adminElo.allGameTypes');
    const ok = await confirm({
      title: t('adminElo.recalculateTitle'),
      message: t('adminElo.recalculateConfirm', { gameType: gameTypeText }),
      confirmLabel: t('adminElo.recalculateNow'),
      tone: 'danger',
    });
    if (!ok) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await eloService.recalculateAll(getToken(), {
        dryRun: false,
        gameType: selectedGameType || null
      });
      setResults(response);
      setPreviewData(null);
    } catch (err) {
      console.error('Error recalculating ELO:', err);
      setError(err.message || t('adminElo.recalculateFailed'));
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || previewLoading;

  return (
    <div className="adm-page">
      <AdminPageHeader title={t('adminElo.title')} subtitle={t('adminElo.description')} />

      <AdminExplainer title={t('adminElo.howItWorks')}>
        <div className="adm-explainer-columns">
          <div>
            <h3>{t('adminElo.process')}</h3>
            <ul className="adm-bullets">
              <li>{t('adminElo.resetRatings', { rating: config?.defaultRating || 1200 })}</li>
              <li>{t('adminElo.chronologicalOrder')}</li>
              <li>{t('adminElo.calculatesChanges')}</li>
              <li>{t('adminElo.updatesStats')}</li>
            </ul>
          </div>
          <div>
            <h3>{t('adminElo.whenToUse')}</h3>
            <ul className="adm-bullets">
              <li>{t('adminElo.useCase1')}</li>
              <li>{t('adminElo.useCase2')}</li>
              <li>{t('adminElo.useCase3')}</li>
              <li>{t('adminElo.useCase4')}</li>
            </ul>
          </div>
        </div>
      </AdminExplainer>

      {config && (
        <AdminStats>
          <AdminStat icon="Trophy" tone="accent" label={t('adminElo.defaultRating')} value={config.defaultRating} />
          <AdminStat label={t('adminElo.minRating')} value={config.minRating} />
          <AdminStat label={t('adminElo.minGamesForRanking')} value={config.minGamesForRanking} />
        </AdminStats>
      )}

      <AdminSection icon="Calculator" title={t('adminElo.recalculateTitle')} description={t('adminElo.recalculateDesc')}>
        <div className="adm-field">
          <span className="adm-field-label">{t('adminElo.gameTypeFilter')}</span>
          <AdminTabs
            value={selectedGameType}
            onChange={setSelectedGameType}
            label={t('adminElo.gameTypeFilter')}
            options={[
              { value: '', label: t('adminElo.allGameTypes') },
              { value: 'wizard', label: t('adminElo.wizard') },
              { value: 'flip-7', label: t('adminElo.flip7') },
              { value: 'dutch', label: t('adminElo.dutch') },
            ]}
          />
        </div>

        <div className="adm-actions">
          <button type="button" className="adm-btn adm-btn--secondary" onClick={handlePreview} disabled={busy}>
            <Icon name={previewLoading ? 'RefreshCw' : 'Eye'} size={16} className={previewLoading ? 'adm-spin' : ''} />
            {previewLoading ? t('adminElo.analyzing') : t('adminElo.previewChanges')}
          </button>
          <button type="button" className="adm-btn adm-btn--primary" onClick={handleRecalculate} disabled={busy}>
            <Icon name={loading ? 'RefreshCw' : 'Play'} size={16} className={loading ? 'adm-spin' : ''} />
            {loading ? t('adminElo.recalculating') : t('adminElo.recalculateNow')}
          </button>
        </div>

        {error && <AdminNotice tone="error">{error}</AdminNotice>}
      </AdminSection>

      {previewData && <RunResult data={previewData} applied={false} />}
      {results && <RunResult data={results} applied />}

      {confirmDialog}
    </div>
  );
};

export default EloManagement;
