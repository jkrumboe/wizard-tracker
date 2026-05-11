import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  adminGetAllWizardGames,
  adminGetAllTableGames,
  adminDeleteWizardGame,
  adminDeleteTableGame,
} from '@/shared/api/gameService';
import { Trash2Icon, SearchIcon, XIcon } from '@/components/ui/Icon';
import Icon from '@/components/ui/Icon';
import '@/styles/pages/admin.css';

const TYPE_LABELS = {
  wizard: 'Wizard',
  table: 'Table',
};

const TYPE_COLORS = {
  wizard: { color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  table: { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
};

function TypePill({ type }) {
  const { color, bg } = TYPE_COLORS[type] || { color: '#888', bg: 'rgba(136,136,136,0.12)' };
  return (
    <span style={{
      display: 'inline-block',
      fontSize: '0.65rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      padding: '0.15rem 0.5rem',
      borderRadius: 4,
      color,
      background: bg,
    }}>
      {TYPE_LABELS[type] || type}
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getWizardPlayers(game) {
  const players = game.gameData?.players;
  if (!Array.isArray(players) || players.length === 0) return '—';
  return players.map(p => p.name || p.id || '?').join(', ');
}

function getTablePlayers(game) {
  const players = game.gameData?.players;
  if (!Array.isArray(players) || players.length === 0) return '—';
  return players.map(p => p.name || '?').join(', ');
}

function normaliseWizardGame(g) {
  return {
    _id: g._id,
    type: 'wizard',
    players: getWizardPlayers(g),
    playerCount: g.gameData?.players?.length ?? '—',
    rounds: g.gameData?.total_rounds ?? '—',
    finished: g.gameData?.gameFinished ?? false,
    name: g.gameData?.name || null,
    createdAt: g.createdAt,
    viewPath: `/game/${g._id}`,
  };
}

function normaliseTableGame(g) {
  return {
    _id: g._id,
    type: 'table',
    players: getTablePlayers(g),
    playerCount: g.playerCount ?? g.gameData?.players?.length ?? '—',
    rounds: g.totalRounds ?? '—',
    finished: g.gameFinished ?? false,
    name: g.name || g.gameTypeName || '—',
    createdAt: g.createdAt,
    viewPath: `/table-game/${g._id}`,
  };
}

const PAGE_SIZE = 25;

const GameManagement = () => {
  const [allGames, setAllGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [deleteTarget, setDeleteTarget] = useState(null); // { _id, type, players }
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadGames = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [wizardRes, tableRes] = await Promise.all([
        adminGetAllWizardGames({ limit: 500 }),
        adminGetAllTableGames({ limit: 500 }),
      ]);
      const wizardGames = (wizardRes.games || []).map(normaliseWizardGame);
      const tableGames = (tableRes.games || []).map(normaliseTableGame);
      const combined = [...wizardGames, ...tableGames].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setAllGames(combined);
    } catch (err) {
      console.error('Error loading games:', err);
      setError(err.message || 'Failed to load games');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, typeFilter]);

  const filteredGames = allGames.filter(g => {
    if (typeFilter !== 'all' && g.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        g.players.toLowerCase().includes(q) ||
        (g.name && g.name.toLowerCase().includes(q)) ||
        g._id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredGames.length / PAGE_SIZE));
  const paginated = filteredGames.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openDeleteModal = (game) => {
    setDeleteTarget(game);
    setDeleteError('');
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteError('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      if (deleteTarget.type === 'wizard') {
        await adminDeleteWizardGame(deleteTarget._id);
      } else if (deleteTarget.type === 'table') {
        await adminDeleteTableGame(deleteTarget._id);
      }
      setAllGames(prev => prev.filter(g => g._id !== deleteTarget._id));
      closeDeleteModal();
    } catch (err) {
      console.error('Error deleting game:', err);
      setDeleteError(err.message || 'Failed to delete game');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Game Management</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {loading ? 'Loading…' : `${filteredGames.length} game${filteredGames.length !== 1 ? 's' : ''} found`}
          </p>
        </div>
        <button
          className="btn-refresh"
          onClick={loadGames}
          disabled={loading}
          title="Refresh"
        >
          <Icon name="RefreshCw" size={16} />
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: 200 }}>
          <Icon name="Search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search by player, game name, or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem 0.5rem 2rem',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--card-bg)',
              color: 'var(--text)',
              fontSize: '0.875rem',
              boxSizing: 'border-box',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
            >
              <Icon name="X" size={14} />
            </button>
          )}
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--card-bg)',
            color: 'var(--text)',
            fontSize: '0.875rem',
          }}
        >
          <option value="all">All Types</option>
          <option value="wizard">Wizard</option>
          <option value="table">Table</option>
        </select>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading games…</div>
      ) : filteredGames.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No games found.</div>
      ) : (
        <>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name / Players</th>
                  <th>Rounds</th>
                  <th>Players</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(game => (
                  <tr key={game._id}>
                    <td><TypePill type={game.type} /></td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                        {game.name && game.name !== '—' ? game.name : game.players}
                      </div>
                      {game.name && game.name !== '—' && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{game.players}</div>
                      )}
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                        {game._id}
                      </div>
                    </td>
                    <td>{game.rounds}</td>
                    <td>{game.playerCount}</td>
                    <td>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '0.1rem 0.4rem',
                        borderRadius: 4,
                        background: game.finished ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                        color: game.finished ? '#10b981' : '#f59e0b',
                      }}>
                        {game.finished ? 'Finished' : 'In Progress'}
                      </span>
                    </td>
                    <td className="cell-date">{formatDate(game.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <Link
                          to={game.viewPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--primary)',
                            textDecoration: 'none',
                            padding: '0.25rem 0.5rem',
                            borderRadius: 6,
                            border: '1px solid var(--primary)',
                            whiteSpace: 'nowrap',
                          }}
                          title="View game"
                        >
                          View
                        </Link>
                        <button
                          className="btn-reject"
                          onClick={() => openDeleteModal(game)}
                          title="Delete game"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                className="btn-cancel"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem' }}
              >
                Previous
              </button>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Page {page} / {totalPages}
              </span>
              <button
                className="btn-cancel"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem' }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="mobile-menu-overlay"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
          onClick={closeDeleteModal}
        >
          <div
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '1.5rem',
              maxWidth: 440,
              width: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <Icon name="Trash2" size={20} style={{ color: '#ef4444' }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Delete Game</h3>
            </div>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              This will permanently delete this game. This action cannot be undone.
            </p>
            <div style={{
              background: 'var(--bg-color)',
              borderRadius: 8,
              padding: '0.75rem',
              marginBottom: '1.25rem',
              fontSize: '0.8125rem',
            }}>
              <div><strong>Type:</strong> <TypePill type={deleteTarget.type} /></div>
              <div style={{ marginTop: '0.4rem' }}><strong>Players:</strong> {deleteTarget.players}</div>
              {deleteTarget.name && deleteTarget.name !== '—' && (
                <div style={{ marginTop: '0.4rem' }}><strong>Name:</strong> {deleteTarget.name}</div>
              )}
              <div style={{ marginTop: '0.4rem', fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                ID: {deleteTarget._id}
              </div>
            </div>
            {deleteError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '0.5rem 0.75rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.8125rem' }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-cancel" onClick={closeDeleteModal} disabled={deleteLoading} style={{ padding: '0.5rem 1rem' }}>
                Cancel
              </button>
              <button className="btn-reject" onClick={handleDelete} disabled={deleteLoading} style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {deleteLoading ? 'Deleting…' : (
                  <>
                    <Icon name="Trash2" size={14} />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameManagement;
