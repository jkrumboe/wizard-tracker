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
import '@/styles/pages/admin.css';

const PAGE_SIZE = 25;
// The wizard list endpoint caps a page at 200 documents, so it has to be walked
const WIZARD_PAGE_SIZE = 200;
const MAX_WIZARD_PAGES = 50;

function TypePill({ type }) {
  return <span className={`game-type-pill type-${type}`}>{type}</span>;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
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
  const { t } = useTranslation();

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

  // Escape closes whichever modal is open
  useEffect(() => {
    if (!deleteTarget && !confirmRemove) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (deleteLoading || removeLoading) return;
      closeDeleteModal();
      setConfirmRemove(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteTarget, confirmRemove, deleteLoading, removeLoading, closeDeleteModal]);

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

  const renderDuplicateCopy = (copy, role) => (
    <div key={copy.id} className={`dedupe-copy dedupe-copy-${role}`}>
      <span className={`dedupe-role dedupe-role-${role}`}>
        {t(role === 'keep' ? 'adminGames.keepLabel' : 'adminGames.removeLabel')}
      </span>
      <div className="dedupe-copy-body">
        <div className="dedupe-copy-title">
          {copy.name || copy.players.join(', ') || t('adminGames.unnamedGame')}
        </div>
        <div className="dedupe-copy-meta">
          {copy.name && copy.players.length > 0 && <span>{copy.players.join(', ')}</span>}
          <span>{t('adminGames.roundsShort', { count: copy.rounds })}</span>
          <span>{formatDateTime(copy.playedAt)}</span>
        </div>
        <div className="dedupe-copy-ids">
          <code>{copy.id}</code>
          {copy.localId && <code>{copy.localId}</code>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-container">
      <div className="admin-section-header">
        <div>
          <h1>{t('adminGames.title')}</h1>
          <p className="subtitle">
            {loading ? t('adminGames.loading') : t('adminGames.gamesFound', { count: filteredGames.length })}
          </p>
        </div>
        <button
          className="btn-refresh"
          onClick={loadGames}
          disabled={loading}
          title={t('adminGames.refresh')}
          aria-label={t('adminGames.refresh')}
        >
          <Icon name="RefreshCw" size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Duplicate detection */}
      <section className="admin-section dedupe-section">
        <div className="section-header">
          <h2><Icon name="CopyCheck" size={20} /> {t('adminGames.duplicatesTitle')}</h2>
          <p>{t('adminGames.duplicatesDesc')}</p>
        </div>

        <div className="dedupe-options">
          <label className="dedupe-option">
            <input
              type="checkbox"
              checked={dedupeOptions.includeDate}
              onChange={() => toggleOption('includeDate')}
              disabled={scanLoading || removeLoading}
            />
            <span>
              {t('adminGames.optionMatchDate')}
              <small>{t('adminGames.optionMatchDateHint')}</small>
            </span>
          </label>
          <label className="dedupe-option">
            <input
              type="checkbox"
              checked={dedupeOptions.sameUserOnly}
              onChange={() => toggleOption('sameUserOnly')}
              disabled={scanLoading || removeLoading}
            />
            <span>
              {t('adminGames.optionSameUser')}
              <small>{t('adminGames.optionSameUserHint')}</small>
            </span>
          </label>
          <label className="dedupe-option">
            <input
              type="checkbox"
              checked={dedupeOptions.recalculateElo}
              onChange={() => toggleOption('recalculateElo')}
              disabled={scanLoading || removeLoading}
            />
            <span>
              {t('adminGames.optionRecalcElo')}
              <small>{t('adminGames.optionRecalcEloHint')}</small>
            </span>
          </label>
        </div>

        <div className="action-buttons-row">
          <button
            className="btn btn-secondary btn-with-icon"
            onClick={handleScan}
            disabled={scanLoading || removeLoading}
          >
            <Icon name={scanLoading ? 'RefreshCw' : 'ScanSearch'} size={18} className={scanLoading ? 'spinning' : ''} />
            {scanLoading ? t('adminGames.scanning') : t('adminGames.scanButton')}
          </button>
          <button
            className="btn btn-primary btn-with-icon"
            onClick={() => setConfirmRemove(true)}
            disabled={scanLoading || removeLoading || duplicateIds.length === 0}
          >
            <Icon name={removeLoading ? 'RefreshCw' : 'Trash2'} size={18} className={removeLoading ? 'spinning' : ''} />
            {removeLoading
              ? t('adminGames.removing')
              : t('adminGames.removeButton', { count: duplicateIds.length })}
          </button>
        </div>

        {dedupeError && (
          <div className="alert alert-error">
            <Icon name="AlertTriangle" size={18} />
            <span>{dedupeError}</span>
          </div>
        )}

        {removeResult && (
          <div className="alert alert-success">
            <Icon name="CheckCircle2" size={18} />
            <span>
              {t('adminGames.removeSuccess', {
                count: removeResult.removed.total,
                wizard: removeResult.removed.wizard,
                table: removeResult.removed.table,
              })}
              {removeResult.eloRecalculated
                ? ` ${t('adminGames.eloRecalculated', { count: removeResult.eloRecalculated.gamesProcessed })}`
                : ''}
            </span>
          </div>
        )}

        {scan && (
          <div className="dedupe-results">
            <div className="stats-grid">
              <div className="stat-box">
                <div className="stat-label">{t('adminGames.statScanned')}</div>
                <div className="stat-value">{scan.wizard.scanned + scan.table.scanned}</div>
              </div>
              <div className={`stat-box${scan.totalDuplicates > 0 ? ' error' : ' success'}`}>
                <div className="stat-label">{t('adminGames.statDuplicates')}</div>
                <div className="stat-value">{scan.totalDuplicates}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">{t('adminGames.statGroups')}</div>
                <div className="stat-value">{scan.totalGroups}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">{t('adminGames.statNotComparable')}</div>
                <div className="stat-value">{scan.wizard.skipped + scan.table.skipped}</div>
              </div>
            </div>

            {scan.totalDuplicates === 0 ? (
              <div className="empty-state">
                <Icon name="CheckCircle2" size={32} className="empty-icon success" />
                <h4>{t('adminGames.noDuplicatesTitle')}</h4>
                <p>{t('adminGames.noDuplicatesDesc')}</p>
              </div>
            ) : (
              <div className="dedupe-groups">
                {duplicateGroups.map((group, index) => (
                  <div key={group.keep.id} className="dedupe-group">
                    <div className="dedupe-group-header">
                      <TypePill type={group.keep.type} />
                      <span className="dedupe-group-title">
                        {t('adminGames.groupLabel', { index: index + 1, count: group.remove.length + 1 })}
                      </span>
                    </div>
                    {renderDuplicateCopy(group.keep, 'keep')}
                    {group.remove.map(copy => renderDuplicateCopy(copy, 'remove'))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Game list */}
      <section className="admin-section">
        <div className="section-header">
          <h2><Icon name="Gamepad2" size={20} /> {t('adminGames.allGamesTitle')}</h2>
        </div>

        <div className="admin-filters">
          <div className="search-box">
            <div className="search-input-group">
              <input
                type="text"
                className="form-input"
                placeholder={t('adminGames.searchPlaceholder')}
                value={search}
                onChange={event => setSearch(event.target.value)}
                aria-label={t('adminGames.searchPlaceholder')}
              />
              {search ? (
                <button
                  className="btn-clear"
                  onClick={() => setSearch('')}
                  aria-label={t('adminGames.clearSearch')}
                >
                  <Icon name="X" size={14} />
                </button>
              ) : (
                <Icon name="Search" size={16} className="search-icon-static" />
              )}
            </div>
          </div>
          <div className="filter-group">
            <label htmlFor="game-type-filter">{t('adminGames.typeFilter')}</label>
            <select
              id="game-type-filter"
              className="filter-select"
              value={typeFilter}
              onChange={event => setTypeFilter(event.target.value)}
            >
              <option value="all">{t('adminGames.allTypes')}</option>
              <option value="wizard">{t('adminGames.wizard')}</option>
              <option value="table">{t('adminGames.table')}</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <Icon name="AlertTriangle" size={18} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="loading">{t('adminGames.loadingGames')}</div>
        ) : filteredGames.length === 0 ? (
          <div className="no-data">{t('adminGames.noGames')}</div>
        ) : (
          <>
            <div className="admin-table-wrapper">
              <table className="admin-table games-table">
                <thead>
                  <tr>
                    <th>{t('adminGames.colType')}</th>
                    <th>{t('adminGames.colGame')}</th>
                    <th>{t('adminGames.colRounds')}</th>
                    <th>{t('adminGames.colPlayers')}</th>
                    <th>{t('adminGames.colStatus')}</th>
                    <th>{t('adminGames.colDate')}</th>
                    <th className="col-actions" />
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(game => (
                    <tr key={game._id}>
                      <td><TypePill type={game.type} /></td>
                      <td>
                        <div className="game-cell-title">{game.name || game.players}</div>
                        {game.name && <div className="game-cell-players">{game.players}</div>}
                        <code className="game-cell-id">{game._id}</code>
                      </td>
                      <td>{game.rounds}</td>
                      <td>{game.playerCount}</td>
                      <td>
                        <span className={`status-pill ${game.finished ? 'status-finished' : 'status-progress'}`}>
                          {game.finished ? t('adminGames.finished') : t('adminGames.inProgress')}
                        </span>
                      </td>
                      <td className="cell-date">{formatDate(game.createdAt)}</td>
                      <td>
                        <div className="row-actions">
                          <Link
                            to={game.viewPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-view"
                            title={t('adminGames.viewGame')}
                          >
                            {t('adminGames.view')}
                          </Link>
                          <Link
                            to={`/admin/games/${game.type}/${game._id}/edit`}
                            className="btn-view btn-icon-only"
                            title={t('adminGames.editGame')}
                            aria-label={t('adminGames.editGame')}
                          >
                            <Icon name="Edit" size={13} />
                          </Link>
                          <button
                            className="btn-reject btn-icon-only"
                            onClick={() => setDeleteTarget(game)}
                            title={t('adminGames.deleteGame')}
                            aria-label={t('adminGames.deleteGame')}
                          >
                            <Icon name="Trash2" size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="admin-pagination">
                <button
                  className="btn-cancel"
                  onClick={() => setPage(current => Math.max(1, current - 1))}
                  disabled={currentPage === 1}
                >
                  {t('adminGames.previous')}
                </button>
                <span className="admin-pagination-info">
                  {t('adminGames.pageOf', { page: currentPage, total: totalPages })}
                </span>
                <button
                  className="btn-cancel"
                  onClick={() => setPage(current => Math.min(totalPages, current + 1))}
                  disabled={currentPage === totalPages}
                >
                  {t('adminGames.next')}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-game-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="delete-game-title">
                <Icon name="Trash2" size={18} /> {t('adminGames.deleteTitle')}
              </h3>
              <button className="close-btn" onClick={closeDeleteModal} aria-label={t('adminGames.cancel')}>
                <Icon name="X" size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p className="danger-text">{t('adminGames.deleteWarning')}</p>
              <div className="modal-detail-box">
                <div><strong>{t('adminGames.colType')}:</strong> <TypePill type={deleteTarget.type} /></div>
                <div><strong>{t('adminGames.colPlayers')}:</strong> {deleteTarget.players}</div>
                {deleteTarget.name && <div><strong>{t('adminGames.nameLabel')}:</strong> {deleteTarget.name}</div>}
                <code className="game-cell-id">{deleteTarget._id}</code>
              </div>
              {deleteError && (
                <div className="alert alert-error">
                  <Icon name="AlertTriangle" size={16} />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={closeDeleteModal} disabled={deleteLoading}>
                {t('adminGames.cancel')}
              </button>
              <button className="btn-reject" onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? t('adminGames.deleting') : t('adminGames.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate removal confirmation */}
      {confirmRemove && (
        <div className="modal-overlay" onClick={() => !removeLoading && setConfirmRemove(false)}>
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-duplicates-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="remove-duplicates-title">
                <Icon name="CopyCheck" size={18} /> {t('adminGames.confirmRemoveTitle')}
              </h3>
              <button
                className="close-btn"
                onClick={() => setConfirmRemove(false)}
                disabled={removeLoading}
                aria-label={t('adminGames.cancel')}
              >
                <Icon name="X" size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p className="danger-text">
                {t('adminGames.confirmRemoveWarning', { count: duplicateIds.length })}
              </p>
              <p className="info-text">{t('adminGames.confirmRemoveKeeps')}</p>
              {dedupeOptions.recalculateElo && (
                <p className="info-text">{t('adminGames.confirmRemoveElo')}</p>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setConfirmRemove(false)} disabled={removeLoading}>
                {t('adminGames.cancel')}
              </button>
              <button className="btn-reject" onClick={handleRemoveDuplicates} disabled={removeLoading}>
                {removeLoading ? t('adminGames.removing') : t('adminGames.confirmRemoveAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameManagement;
