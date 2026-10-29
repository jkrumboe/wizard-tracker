import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  adminGetAllWizardGames,
  adminGetAllTableGames,
  adminDeleteWizardGame,
  adminDeleteTableGame,
  adminScanDuplicateGames,
  adminRemoveDuplicateGames,
  } from '@/shared/api/gameService';
import Icon from '@/components/ui/Icon';
import {
  AdminDialog,
  AdminEmpty,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminSearch,
  AdminSection,
  AdminStat,
  AdminStats,
  AdminTabs,
  AdminToggle,
} from '@/components/admin/AdminUI';
import {
  formatDate,
  formatDateTime,
} from '@/components/admin/adminUtils';
import '@/styles/pages/admin.css';

const PAGE_SIZE = 25;
// The wizard list endpoint caps a page at 200 documents, so it has to be walked
const WIZARD_PAGE_SIZE = 200;
const MAX_WIZARD_PAGES = 50;

function TypePill({ type }) {
  return <span className={`adm-type adm-type--${type}`}>{type}</span>;
}

function getPlayerNames(game) {
  const players = game.gameData?.players;
  if (!Array.isArray(players) || players.length === 0) return '—';
  return players.map(player => player.name || player.id || '?').join(', ');
}

function normaliseWizardGame(game) {
  return {
    _id: game._id,
    type: 'wizard',
    players: getPlayerNames(game),
    playerCount: game.gameData?.players?.length ?? '—',
    rounds: game.gameData?.total_rounds ?? '—',
    finished: game.gameData?.gameFinished ?? false,
    name: game.gameData?.name || null,
    createdAt: game.createdAt,
    viewPath: `/game/${game._id}`,
  };
}

function normaliseTableGame(game) {
  return {
    _id: game._id,
    type: 'table',
    players: getPlayerNames(game),
    playerCount: game.playerCount ?? game.gameData?.players?.length ?? '—',
    rounds: game.totalRounds ?? '—',
    finished: game.gameFinished ?? false,
    name: game.name || game.gameTypeName || null,
    createdAt: game.createdAt,
    viewPath: `/table-game/${game._id}`,
  };
}

/** Walk every page of the wizard list so nothing is silently cut off. */
async function fetchAllWizardGames() {
  const games = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage && page <= MAX_WIZARD_PAGES) {
    const response = await adminGetAllWizardGames({ page, limit: WIZARD_PAGE_SIZE });
    games.push(...(response.games || []));
    hasNextPage = Boolean(response.pagination?.hasNextPage);
    page += 1;
  }

  return games;
}

const GameManagement = () => {
  const { t, i18n } = useTranslation();

  const [allGames, setAllGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Duplicate detection
  const [dedupeOptions, setDedupeOptions] = useState({
    includeDate: true,
    sameUserOnly: false,
    recalculateElo: true,
  });
  const [scan, setScan] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [dedupeError, setDedupeError] = useState('');
  const [removeResult, setRemoveResult] = useState(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const loadGames = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [wizardGames, tableResponse] = await Promise.all([
        fetchAllWizardGames(),
        adminGetAllTableGames({ limit: 1000 }),
      ]);
      const combined = [
        ...wizardGames.map(normaliseWizardGame),
        ...(tableResponse.games || []).map(normaliseTableGame),
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAllGames(combined);
    } catch (err) {
      console.error('Error loading games:', err);
      setError(err.message || t('adminGames.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter]);

  const filteredGames = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allGames.filter(game => {
      if (typeFilter !== 'all' && game.type !== typeFilter) return false;
      if (!query) return true;
      return (
        game.players.toLowerCase().includes(query)
        || (game.name && game.name.toLowerCase().includes(query))
        || game._id.toLowerCase().includes(query)
      );
    });
  }, [allGames, typeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredGames.length / PAGE_SIZE));
  // Deleting the last row of the last page must not leave an empty view
  const currentPage = Math.min(page, totalPages);
  const paginated = filteredGames.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const closeDeleteModal = useCallback(() => {
    setDeleteTarget(null);
    setDeleteError('');
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      if (deleteTarget.type === 'wizard') {
        await adminDeleteWizardGame(deleteTarget._id);
      } else {
        await adminDeleteTableGame(deleteTarget._id);
      }
      setAllGames(prev => prev.filter(game => game._id !== deleteTarget._id));
      // A deleted game may have been part of the last scan
      setScan(null);
      closeDeleteModal();
    } catch (err) {
      console.error('Error deleting game:', err);
      setDeleteError(err.message || t('adminGames.deleteFailed'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const duplicateGroups = useMemo(() => {
    if (!scan) return [];
    return [...(scan.wizard?.groups || []), ...(scan.table?.groups || [])];
  }, [scan]);

  const duplicateIds = useMemo(
    () => duplicateGroups.flatMap(group => group.remove.map(copy => copy.id)),
    [duplicateGroups]
  );

  const handleScan = async () => {
    setScanLoading(true);
    setDedupeError('');
    setRemoveResult(null);
    try {
      const result = await adminScanDuplicateGames({
        includeDate: dedupeOptions.includeDate,
        sameUserOnly: dedupeOptions.sameUserOnly,
      });
      setScan(result);
    } catch (err) {
      console.error('Error scanning for duplicates:', err);
      setDedupeError(err.message || t('adminGames.scanFailed'));
    } finally {
      setScanLoading(false);
    }
  };

  const handleRemoveDuplicates = async () => {
    setRemoveLoading(true);
    setDedupeError('');
    try {
      const result = await adminRemoveDuplicateGames({
        ids: duplicateIds,
        includeDate: dedupeOptions.includeDate,
        sameUserOnly: dedupeOptions.sameUserOnly,
        recalculateElo: dedupeOptions.recalculateElo,
      });
      setRemoveResult(result);
      setScan(null);
      setConfirmRemove(false);
      await loadGames();
    } catch (err) {
      console.error('Error removing duplicates:', err);
      setDedupeError(err.message || t('adminGames.removeFailed'));
      setConfirmRemove(false);
    } finally {
      setRemoveLoading(false);
    }
  };

  const toggleOption = (key) => setDedupeOptions(prev => ({ ...prev, [key]: !prev[key] }));
  const dedupeBusy = scanLoading || removeLoading;

  const renderDuplicateCopy = (copy, role) => (
    <div key={copy.id} className={`adm-dupe adm-dupe--${role}`}>
      <span className="adm-dupe-role">
        {t(role === 'keep' ? 'adminGames.keepLabel' : 'adminGames.removeLabel')}
      </span>
      <div className="adm-dupe-body">
        <strong>{copy.name || copy.players.join(', ') || t('adminGames.unnamedGame')}</strong>
        <span className="adm-dupe-meta">
          {copy.name && copy.players.length > 0 && <span>{copy.players.join(', ')}</span>}
          <span>{t('adminGames.roundsShort', { count: copy.rounds })}</span>
          <span>{formatDateTime(copy.playedAt, i18n.language)}</span>
        </span>
        <span className="adm-dupe-ids">
          <code>{copy.id}</code>
          {copy.localId && <code>{copy.localId}</code>}
        </span>
      </div>
    </div>
  );

  return (
    <div className="adm-page">
      <AdminPageHeader
        title={t('adminGames.title')}
        subtitle={loading ? t('adminGames.loading') : t('adminGames.gamesFound', { count: filteredGames.length })}
        actions={(
          <button type="button" className="adm-icon-btn" onClick={loadGames} disabled={loading} title={t('adminGames.refresh')} aria-label={t('adminGames.refresh')}>
            <Icon name="RefreshCw" size={16} className={loading ? 'adm-spin' : ''} />
          </button>
        )}
      />

      <AdminSection icon="Gamepad2" title={t('adminGames.allGamesTitle')}>
        <div className="adm-toolbar">
          <AdminSearch value={search} onChange={setSearch} placeholder={t('adminGames.searchPlaceholder')} />
          <AdminTabs
            value={typeFilter}
            onChange={setTypeFilter}
            label={t('adminGames.typeFilter')}
            options={[
              { value: 'all', label: t('adminGames.allTypes') },
              { value: 'wizard', label: t('adminGames.wizard') },
              { value: 'table', label: t('adminGames.table') },
            ]}
          />
        </div>

        {error && <AdminNotice tone="error">{error}</AdminNotice>}

        {loading ? (
          <AdminLoading label={t('adminGames.loadingGames')} />
        ) : filteredGames.length === 0 ? (
          <AdminEmpty icon="Gamepad2">{t('adminGames.noGames')}</AdminEmpty>
        ) : (
          <>
            {/* Rows stack into cards on phones (see .adm-table--stack) */}
            <table className="adm-table adm-table--stack">
              <thead>
                <tr>
                  <th>{t('adminGames.colGame')}</th>
                  <th>{t('adminGames.colRounds')}</th>
                  <th>{t('adminGames.colPlayers')}</th>
                  <th>{t('adminGames.colStatus')}</th>
                  <th>{t('adminGames.colDate')}</th>
                  <th><span className="sr-only">{t('adminGames.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(game => (
                  <tr key={game._id}>
                    <td className="adm-table-primary">
                      <div className="adm-game-cell">
                        <TypePill type={game.type} />
                        <strong>{game.name || game.players}</strong>
                      </div>
                      {game.name && <span className="adm-muted">{game.players}</span>}
                      <code className="adm-id">{game._id}</code>
                    </td>
                    <td data-label={t('adminGames.colRounds')}>{game.rounds}</td>
                    <td data-label={t('adminGames.colPlayers')}>{game.playerCount}</td>
                    <td data-label={t('adminGames.colStatus')}>
                      <span className={`adm-status ${game.finished ? 'is-done' : 'is-open'}`}>
                        {game.finished ? t('adminGames.finished') : t('adminGames.inProgress')}
                      </span>
                    </td>
                    <td data-label={t('adminGames.colDate')}>{formatDate(game.createdAt, i18n.language)}</td>
                    <td className="adm-table-actions">
                      <Link to={game.viewPath} target="_blank" rel="noopener noreferrer" className="adm-icon-btn" title={t('adminGames.viewGame')} aria-label={t('adminGames.viewGame')}>
                        <Icon name="ExternalLink" size={15} />
                      </Link>
                      <Link to={`/admin/games/${game.type}/${game._id}/edit`} className="adm-icon-btn" title={t('adminGames.editGame')} aria-label={t('adminGames.editGame')}>
                        <Icon name="Edit" size={15} />
                      </Link>
                      <button type="button" className="adm-icon-btn adm-icon-btn--danger" onClick={() => setDeleteTarget(game)} title={t('adminGames.deleteGame')} aria-label={t('adminGames.deleteGame')}>
                        <Icon name="Trash2" size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <nav className="adm-pagination" aria-label={t('adminGames.pagination')}>
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={currentPage === 1}>
                  <Icon name="ChevronLeft" size={16} /> {t('adminGames.previous')}
                </button>
                <span>{t('adminGames.pageOf', { page: currentPage, total: totalPages })}</span>
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages}>
                  {t('adminGames.next')} <Icon name="ChevronRight" size={16} />
                </button>
              </nav>
            )}
          </>
        )}
      </AdminSection>

      {/* Duplicate detection is a maintenance tool, so it follows the list */}
      <AdminSection icon="CopyCheck" title={t('adminGames.duplicatesTitle')} description={t('adminGames.duplicatesDesc')} tone="accent">
        <div className="adm-toggles">
          <AdminToggle checked={dedupeOptions.includeDate} onChange={() => toggleOption('includeDate')} disabled={dedupeBusy} label={t('adminGames.optionMatchDate')} hint={t('adminGames.optionMatchDateHint')} />
          <AdminToggle checked={dedupeOptions.sameUserOnly} onChange={() => toggleOption('sameUserOnly')} disabled={dedupeBusy} label={t('adminGames.optionSameUser')} hint={t('adminGames.optionSameUserHint')} />
          <AdminToggle checked={dedupeOptions.recalculateElo} onChange={() => toggleOption('recalculateElo')} disabled={dedupeBusy} label={t('adminGames.optionRecalcElo')} hint={t('adminGames.optionRecalcEloHint')} />
        </div>

        <div className="adm-actions">
          <button type="button" className="adm-btn adm-btn--secondary" onClick={handleScan} disabled={dedupeBusy}>
            <Icon name={scanLoading ? 'RefreshCw' : 'ScanSearch'} size={16} className={scanLoading ? 'adm-spin' : ''} />
            {scanLoading ? t('adminGames.scanning') : t('adminGames.scanButton')}
          </button>
          <button type="button" className="adm-btn adm-btn--danger" onClick={() => setConfirmRemove(true)} disabled={dedupeBusy || duplicateIds.length === 0}>
            <Icon name={removeLoading ? 'RefreshCw' : 'Trash2'} size={16} className={removeLoading ? 'adm-spin' : ''} />
            {removeLoading ? t('adminGames.removing') : t('adminGames.removeButton', { count: duplicateIds.length })}
          </button>
        </div>

        {dedupeError && <AdminNotice tone="error">{dedupeError}</AdminNotice>}

        {removeResult && (
          <AdminNotice tone="success">
            {t('adminGames.removeSuccess', {
              count: removeResult.removed.total,
              wizard: removeResult.removed.wizard,
              table: removeResult.removed.table,
            })}
            {removeResult.eloRecalculated
              ? ` ${t('adminGames.eloRecalculated', { count: removeResult.eloRecalculated.gamesProcessed })}`
              : ''}
          </AdminNotice>
        )}

        {scan && (
          <>
            <AdminStats>
              <AdminStat label={t('adminGames.statScanned')} value={scan.wizard.scanned + scan.table.scanned} />
              <AdminStat label={t('adminGames.statDuplicates')} value={scan.totalDuplicates} tone={scan.totalDuplicates > 0 ? 'danger' : 'success'} />
              <AdminStat label={t('adminGames.statGroups')} value={scan.totalGroups} />
              <AdminStat label={t('adminGames.statNotComparable')} value={scan.wizard.skipped + scan.table.skipped} />
            </AdminStats>

            {scan.totalDuplicates === 0 ? (
              <AdminEmpty icon="CheckCircle2" tone="success" title={t('adminGames.noDuplicatesTitle')}>
                {t('adminGames.noDuplicatesDesc')}
              </AdminEmpty>
            ) : (
              <div className="adm-dupe-groups">
                {duplicateGroups.map((group, index) => (
                  <div key={group.keep.id} className="adm-dupe-group">
                    <div className="adm-dupe-group-head">
                      <TypePill type={group.keep.type} />
                      <span>{t('adminGames.groupLabel', { index: index + 1, count: group.remove.length + 1 })}</span>
                    </div>
                    {renderDuplicateCopy(group.keep, 'keep')}
                    {group.remove.map(copy => renderDuplicateCopy(copy, 'remove'))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </AdminSection>

      {deleteTarget && (
        <AdminDialog
          title={t('adminGames.deleteTitle')}
          icon="Trash2"
          tone="danger"
          size="sm"
          onClose={closeDeleteModal}
          busy={deleteLoading}
          footer={(
            <>
              <button type="button" className="adm-btn adm-btn--ghost" onClick={closeDeleteModal} disabled={deleteLoading}>
                {t('adminGames.cancel')}
              </button>
              <button type="button" className="adm-btn adm-btn--danger" onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? t('adminGames.deleting') : t('adminGames.delete')}
              </button>
            </>
          )}
        >
          <p className="adm-dialog-text">{t('adminGames.deleteWarning')}</p>
          <dl className="adm-spec">
            <div><dt>{t('adminGames.colType')}</dt><dd><TypePill type={deleteTarget.type} /></dd></div>
            <div><dt>{t('adminGames.colPlayers')}</dt><dd>{deleteTarget.players}</dd></div>
            {deleteTarget.name && <div><dt>{t('adminGames.nameLabel')}</dt><dd>{deleteTarget.name}</dd></div>}
          </dl>
          <code className="adm-id">{deleteTarget._id}</code>
          {deleteError && <AdminNotice tone="error">{deleteError}</AdminNotice>}
        </AdminDialog>
      )}

      {confirmRemove && (
        <AdminDialog
          title={t('adminGames.confirmRemoveTitle')}
          icon="CopyCheck"
          tone="danger"
          size="sm"
          onClose={() => setConfirmRemove(false)}
          busy={removeLoading}
          footer={(
            <>
              <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setConfirmRemove(false)} disabled={removeLoading}>
                {t('adminGames.cancel')}
              </button>
              <button type="button" className="adm-btn adm-btn--danger" onClick={handleRemoveDuplicates} disabled={removeLoading}>
                {removeLoading ? t('adminGames.removing') : t('adminGames.confirmRemoveAction')}
              </button>
            </>
          )}
        >
          <p className="adm-dialog-text"><strong>{t('adminGames.confirmRemoveWarning', { count: duplicateIds.length })}</strong></p>
          <p className="adm-dialog-text">{t('adminGames.confirmRemoveKeeps')}</p>
          {dedupeOptions.recalculateElo && <p className="adm-dialog-text">{t('adminGames.confirmRemoveElo')}</p>}
        </AdminDialog>
      )}
    </div>
  );
};

export default GameManagement;
