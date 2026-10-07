import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  adminGetGameForEdit,
  adminUpdateGame,
  adminSearchIdentities,
} from '@/shared/api/gameService';
import { WIZARD_FORMULA, calculateScore } from '@/shared/utils/scoringFormulas';
import Icon from '@/components/ui/Icon';
import '@/styles/pages/admin.css';

const SEARCH_DEBOUNCE_MS = 250;

const normalise = (value) => String(value || '').trim().toLowerCase();

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

const toInputValue = (value) => (value === null || value === undefined ? '' : String(value));

const parseNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

/** Build the editable player list from the API response. */
function buildPlayers(data) {
  return (data.gameData?.players || []).map((player, index) => {
    const identityId = player.identityId ? String(player.identityId) : null;
    return {
      key: data.type === 'wizard' ? String(player.id) : String(index),
      id: player.id,
      name: player.name || '',
      originalName: player.name || '',
      originalIdentityId: identityId,
      selectedIdentity: null,
      identity: identityId ? data.identities?.[identityId] || null : null,
    };
  });
}

/** Wizard rounds as string inputs, so half-typed values survive re-renders. */
function buildRounds(gameData) {
  return (gameData?.round_data || []).map(round => ({
    players: (round.players || []).map(player => ({
      id: player.id,
      call: toInputValue(player.call),
      made: toInputValue(player.made),
      score: toInputValue(player.score),
    })),
  }));
}

function buildPoints(gameData) {
  return (gameData?.players || []).map(player =>
    (Array.isArray(player.points) ? player.points : []).map(toInputValue)
  );
}

/** Does this identity match the typed name exactly (name or alias)? */
function matchesName(identity, name) {
  const wanted = normalise(name);
  if (!wanted) return false;
  if (normalise(identity.displayName) === wanted) return true;
  return (identity.aliases || []).some(alias => normalise(alias.name) === wanted);
}

function identityLabel(identity, t) {
  const username = identity.userId?.username || identity.username;
  const isUser = identity.type === 'user' && username;
  return isUser
    ? t('adminGameEditor.identityUser', { name: identity.displayName, username })
    : t('adminGameEditor.identityGuest', { name: identity.displayName });
}

/**
 * Name field with a player-identity search. Typing a name links the player to
 * the identity with that name (or creates one); picking a result links it explicitly.
 */
function PlayerNameField({ player, index, onChange, disabled }) {
  const { t } = useTranslation();
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef(null);

  const query = player.name.trim();
  const nameChanged = query !== player.originalName.trim();

  useEffect(() => {
    if (!query) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const identities = await adminSearchIdentities(query);
        if (!cancelled) setResults(identities);
      } catch (err) {
        console.error('Player search failed:', err);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const exactMatch = useMemo(() => results.find(identity => matchesName(identity, query)), [results, query]);

  let status;
  if (player.selectedIdentity) {
    status = { tone: 'link', icon: 'UserCheck', text: t('adminGameEditor.linkSelected', { label: identityLabel(player.selectedIdentity, t) }) };
  } else if (!nameChanged) {
    status = player.identity
      ? { tone: 'neutral', icon: 'User', text: t('adminGameEditor.linkCurrent', { label: identityLabel(player.identity, t) }) }
      : { tone: 'neutral', icon: 'User', text: t('adminGameEditor.linkNone') };
  } else if (searching) {
    status = { tone: 'neutral', icon: 'Search', text: t('adminGameEditor.linkChecking') };
  } else if (exactMatch) {
    status = { tone: 'link', icon: 'UserCheck', text: t('adminGameEditor.linkExisting', { label: identityLabel(exactMatch, t) }) };
  } else if (query) {
    status = { tone: 'new', icon: 'UserPlus', text: t('adminGameEditor.linkNew', { name: query }) };
  }

  const inputId = `player-name-${index}`;

  return (
    <div className="game-editor-player">
      <label htmlFor={inputId} className="game-editor-player-label">
        {t('adminGameEditor.playerLabel', { index: index + 1 })}
        {player.originalName && nameChanged && (
          <span className="game-editor-was">{t('adminGameEditor.was', { name: player.originalName })}</span>
        )}
      </label>
      <div className="search-container" ref={containerRef}>
        <div className="search-input-group">
          <input
            id={inputId}
            type="text"
            className="form-input"
            value={player.name}
            maxLength={50}
            autoComplete="off"
            disabled={disabled}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              onChange({ name: event.target.value, selectedIdentity: null });
              setOpen(true);
            }}
          />
          {nameChanged && (
            <button
              type="button"
              className="btn-clear"
              onClick={() => onChange({ name: player.originalName, selectedIdentity: null })}
              title={t('adminGameEditor.resetName')}
              aria-label={t('adminGameEditor.resetName')}
              disabled={disabled}
            >
              <Icon name="RotateCcw" size={14} />
            </button>
          )}
        </div>
        {open && query && results.length > 0 && (
          <div className="search-dropdown">
            <div className="search-dropdown-list">
              {results.map(identity => (
                <button
                  key={identity._id}
                  type="button"
                  className={`search-dropdown-item${player.selectedIdentity?._id === identity._id ? ' selected' : ''}`}
                  onClick={() => {
                    onChange({ name: identity.displayName, selectedIdentity: identity });
                    setOpen(false);
                  }}
                >
                  <Icon name={identity.type === 'user' ? 'UserCheck' : 'User'} size={14} />
                  <span>{identity.displayName}</span>
                  {identity.userId?.username && identity.type === 'user' && (
                    <span className="user-email">@{identity.userId.username}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {status && (
        <div className={`game-editor-link-status tone-${status.tone}`}>
          <Icon name={status.icon} size={13} />
          <span>{status.text}</span>
        </div>
      )}
    </div>
  );
}

const GameEditor = () => {
  const { t } = useTranslation();
  const { type, id } = useParams();
  const isWizard = type === 'wizard';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [points, setPoints] = useState([]);
  const [tableName, setTableName] = useState('');

  const [options, setOptions] = useState({ recalculateElo: true, cleanupOrphans: true });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [result, setResult] = useState(null);

  const applyData = useCallback((response) => {
    setData(response);
    setPlayers(buildPlayers(response));
    setRounds(buildRounds(response.gameData));
    setPoints(buildPoints(response.gameData));
    setTableName(response.game?.name || '');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      applyData(await adminGetGameForEdit(type, id));
    } catch (err) {
      console.error('Error loading game:', err);
      setError(err.message || t('adminGameEditor.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [type, id, t, applyData]);

  useEffect(() => {
    load();
  }, [load]);

  const formula = data?.gameData?.templateConfig?.scoringFormula || WIZARD_FORMULA;
  const originalRounds = useMemo(() => (data ? buildRounds(data.gameData) : []), [data]);
  const originalPoints = useMemo(() => (data ? buildPoints(data.gameData) : []), [data]);

  const playerChanges = players.filter(player =>
    player.selectedIdentity
      ? player.selectedIdentity._id !== player.originalIdentityId || player.name.trim() !== player.originalName
      : player.name.trim() !== player.originalName.trim()
  );
  const roundsChanged = isWizard && JSON.stringify(rounds) !== JSON.stringify(originalRounds);
  const pointsChanged = !isWizard && JSON.stringify(points) !== JSON.stringify(originalPoints);
  const nameChanged = !isWizard && tableName.trim() !== (data?.game?.name || '');
  const invalidName = players.some(player => !player.name.trim());
  const hasChanges = playerChanges.length > 0 || roundsChanged || pointsChanged || nameChanged;

  // Live totals so the admin sees the effect before saving
  const totals = useMemo(() => {
    if (isWizard) {
      const sums = {};
      players.forEach(player => { sums[player.key] = 0; });
      rounds.forEach(round => round.players.forEach(cell => {
        const score = parseNumber(cell.score);
        if (score !== null && cell.id in sums) sums[cell.id] += score;
      }));
      return players.map(player => sums[player.key] ?? 0);
    }
    return points.map(column => column.reduce((sum, value) => sum + (parseNumber(value) ?? 0), 0));
  }, [isWizard, players, rounds, points]);

  const leaderIndexes = useMemo(() => {
    if (totals.length === 0) return new Set();
    const best = data?.lowIsBetter ? Math.min(...totals) : Math.max(...totals);
    return new Set(totals.map((total, index) => (total === best ? index : -1)).filter(index => index >= 0));
  }, [totals, data]);

  const updatePlayer = (index, patch) => {
    setPlayers(prev => prev.map((player, i) => (i === index ? { ...player, ...patch } : player)));
  };

  const updateRoundCell = (roundIndex, playerId, field, value) => {
    setRounds(prev => prev.map((round, i) => {
      if (i !== roundIndex) return round;
      return {
        ...round,
        players: round.players.map(cell => {
          if (cell.id !== playerId) return cell;
          const next = { ...cell, [field]: value };
          // Call/made changes re-derive the score; a typed score is an override
          if (field === 'call' || field === 'made') {
            const call = parseNumber(next.call);
            const made = parseNumber(next.made);
            const score = calculateScore(formula, call, made);
            if (score !== null) next.score = String(score);
          }
          return next;
        }),
      };
    }));
  };

  const updatePoint = (playerIndex, rowIndex, value) => {
    setPoints(prev => prev.map((column, i) => {
      if (i !== playerIndex) return column;
      const next = [...column];
      next[rowIndex] = value;
      return next;
    }));
  };

  const closeConfirm = useCallback(() => {
    if (!saving) setConfirmOpen(false);
  }, [saving]);

  useEffect(() => {
    if (!confirmOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeConfirm();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmOpen, closeConfirm]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        players: playerChanges.map(player => ({
          key: player.key,
          name: player.name.trim(),
          identityId: player.selectedIdentity?._id || null,
        })),
        recalculateElo: options.recalculateElo,
        cleanupOrphans: options.cleanupOrphans,
      };
      if (roundsChanged) payload.rounds = rounds;
      if (pointsChanged) payload.points = points.map((column, index) => ({ index, points: column }));
      if (nameChanged) payload.name = tableName.trim();

      const response = await adminUpdateGame(type, id, payload);
      applyData(response);
      setResult(response);
      setConfirmOpen(false);
    } catch (err) {
      console.error('Error saving game:', err);
      setSaveError(err.message || t('adminGameEditor.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const viewPath = isWizard ? `/game/${id}` : `/table-game/${id}`;
  const rowCount = Math.max(0, ...points.map(column => column.length));

  if (type !== 'wizard' && type !== 'table') {
    return (
      <div className="admin-container">
        <div className="alert alert-error">
          <Icon name="AlertTriangle" size={18} />
          <span>{t('adminGameEditor.unknownType')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container game-editor">
      <div className="admin-section-header">
        <div>
          <Link to="/admin/games" className="game-editor-back">
            <Icon name="ArrowLeft" size={14} /> {t('adminGameEditor.back')}
          </Link>
          <h1>{t('adminGameEditor.title')}</h1>
          {data && (
            <p className="subtitle">
              <span className={`game-type-pill type-${type}`}>{type}</span>{' '}
              {formatDateTime(data.gameData?.created_at || data.game?.createdAt)}
              {' · '}
              <code className="game-cell-id">{id}</code>
            </p>
          )}
        </div>
        {data && (
          <Link to={viewPath} target="_blank" rel="noopener noreferrer" className="btn-view">
            {t('adminGames.view')}
          </Link>
        )}
      </div>

      {loading && <div className="loading">{t('adminGameEditor.loading')}</div>}

      {error && (
        <div className="alert alert-error">
          <Icon name="AlertTriangle" size={18} />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="alert alert-success game-editor-result">
          <Icon name="CheckCircle2" size={18} />
          <div>
            <strong>{t('adminGameEditor.saved')}</strong>
            {result.changes?.length > 0 && (
              <ul>
                {result.changes.map(change => (
                  <li key={change.index}>
                    {change.createdIdentity
                      ? t('adminGameEditor.resultCreated', { from: change.fromName, to: change.toName })
                      : t('adminGameEditor.resultMoved', { from: change.fromName, to: change.toIdentityName })}
                  </li>
                ))}
              </ul>
            )}
            {result.retiredIdentities?.length > 0 && (
              <div>
                {t('adminGameEditor.resultRetired', {
                  names: result.retiredIdentities.map(identity => identity.displayName).join(', '),
                })}
              </div>
            )}
            {result.eloRecalculated && (
              <div>{t('adminGames.eloRecalculated', { count: result.eloRecalculated.gamesProcessed })}</div>
            )}
          </div>
        </div>
      )}

      {data && !loading && (
        <>
          <section className="admin-section">
            <div className="section-header">
              <h2><Icon name="Users" size={20} /> {t('adminGameEditor.playersTitle')}</h2>
              <p>{t('adminGameEditor.playersDesc')}</p>
            </div>

            {!isWizard && (
              <div className="form-group game-editor-name">
                <label htmlFor="table-game-name">{t('adminGames.nameLabel')}</label>
                <input
                  id="table-game-name"
                  type="text"
                  className="form-input"
                  value={tableName}
                  maxLength={100}
                  onChange={event => setTableName(event.target.value)}
                  disabled={saving}
                />
              </div>
            )}

            <div className="game-editor-players">
              {players.map((player, index) => (
                <PlayerNameField
                  key={player.key}
                  player={player}
                  index={index}
                  disabled={saving}
                  onChange={(patch) => updatePlayer(index, patch)}
                />
              ))}
            </div>
          </section>

          <section className="admin-section">
            <div className="section-header">
              <h2><Icon name="Table" size={20} /> {t('adminGameEditor.scoresTitle')}</h2>
              <p>{isWizard ? t('adminGameEditor.scoresDescWizard') : t('adminGameEditor.scoresDescTable')}</p>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table game-editor-grid">
                <thead>
                  <tr>
                    <th>{isWizard ? t('adminGameEditor.round') : t('adminGameEditor.row')}</th>
                    {players.map((player, index) => (
                      <th key={player.key} className={leaderIndexes.has(index) ? 'is-leader' : ''}>
                        {player.name || '—'}
                      </th>
                    ))}
                  </tr>
                  {isWizard && (
                    <tr className="game-editor-subhead">
                      <th />
                      {players.map(player => (
                        <th key={player.key}>
                          <span>{t('adminGameEditor.call')}</span>
                          <span>{t('adminGameEditor.made')}</span>
                          <span>{t('adminGameEditor.score')}</span>
                        </th>
                      ))}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {isWizard
                    ? rounds.map((round, roundIndex) => (
                      <tr key={roundIndex}>
                        <td className="game-editor-rownum">{roundIndex + 1}</td>
                        {players.map(player => {
                          const cell = round.players.find(candidate => String(candidate.id) === player.key);
                          if (!cell) return <td key={player.key}>—</td>;
                          const label = t('adminGameEditor.cellLabel', { player: player.name, round: roundIndex + 1 });
                          return (
                            <td key={player.key}>
                              <div className="game-editor-cell">
                                <input
                                  type="number" min="0" inputMode="numeric"
                                  value={cell.call}
                                  aria-label={`${label} – ${t('adminGameEditor.call')}`}
                                  onChange={event => updateRoundCell(roundIndex, cell.id, 'call', event.target.value)}
                                  disabled={saving}
                                />
                                <input
                                  type="number" min="0" inputMode="numeric"
                                  value={cell.made}
                                  aria-label={`${label} – ${t('adminGameEditor.made')}`}
                                  onChange={event => updateRoundCell(roundIndex, cell.id, 'made', event.target.value)}
                                  disabled={saving}
                                />
                                <input
                                  type="number" inputMode="numeric"
                                  className="score-input"
                                  value={cell.score}
                                  aria-label={`${label} – ${t('adminGameEditor.score')}`}
                                  onChange={event => updateRoundCell(roundIndex, cell.id, 'score', event.target.value)}
                                  disabled={saving}
                                />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                    : Array.from({ length: rowCount }, (_, rowIndex) => (
                      <tr key={rowIndex}>
                        <td className="game-editor-rownum">{rowIndex + 1}</td>
                        {players.map((player, playerIndex) => (
                          <td key={player.key}>
                            <div className="game-editor-cell">
                              <input
                                type="number" inputMode="decimal"
                                className="score-input"
                                value={points[playerIndex]?.[rowIndex] ?? ''}
                                aria-label={t('adminGameEditor.cellLabel', { player: player.name, round: rowIndex + 1 })}
                                onChange={event => updatePoint(playerIndex, rowIndex, event.target.value)}
                                disabled={saving}
                              />
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>{t('adminGameEditor.total')}</td>
                    {players.map((player, index) => (
                      <td key={player.key} className={leaderIndexes.has(index) ? 'is-leader' : ''}>
                        {leaderIndexes.has(index) && <Icon name="Trophy" size={12} />} {totals[index]}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="admin-section">
            <div className="dedupe-options">
              <label className="dedupe-option">
                <input
                  type="checkbox"
                  checked={options.recalculateElo}
                  onChange={() => setOptions(prev => ({ ...prev, recalculateElo: !prev.recalculateElo }))}
                  disabled={saving}
                />
                <span>
                  {t('adminGames.optionRecalcElo')}
                  <small>{t('adminGameEditor.optionRecalcEloHint')}</small>
                </span>
              </label>
              <label className="dedupe-option">
                <input
                  type="checkbox"
                  checked={options.cleanupOrphans}
                  onChange={() => setOptions(prev => ({ ...prev, cleanupOrphans: !prev.cleanupOrphans }))}
                  disabled={saving}
                />
                <span>
                  {t('adminGameEditor.optionCleanup')}
                  <small>{t('adminGameEditor.optionCleanupHint')}</small>
                </span>
              </label>
            </div>

            <div className="action-buttons-row">
              <button
                className="btn btn-secondary"
                onClick={() => { applyData(data); setSaveError(''); }}
                disabled={saving || !hasChanges}
              >
                {t('adminGameEditor.discard')}
              </button>
              <button
                className="btn btn-primary btn-with-icon"
                onClick={() => setConfirmOpen(true)}
                disabled={saving || !hasChanges || invalidName}
              >
                <Icon name="Save" size={18} />
                {t('adminGameEditor.save')}
              </button>
            </div>
            {invalidName && <p className="danger-text">{t('adminGameEditor.nameRequired')}</p>}
          </section>
        </>
      )}

      {confirmOpen && (
        <div className="modal-overlay" onClick={closeConfirm}>
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-edit-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="confirm-edit-title">
                <Icon name="Save" size={18} /> {t('adminGameEditor.confirmTitle')}
              </h3>
              <button className="close-btn" onClick={closeConfirm} disabled={saving} aria-label={t('adminGames.cancel')}>
                <Icon name="X" size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-detail-box">
                {playerChanges.map(player => (
                  <div key={player.key}>
                    <strong>{player.originalName || '—'}</strong> → <strong>{player.name.trim()}</strong>
                  </div>
                ))}
                {roundsChanged && <div>{t('adminGameEditor.confirmScores')}</div>}
                {pointsChanged && <div>{t('adminGameEditor.confirmScores')}</div>}
                {nameChanged && <div>{t('adminGameEditor.confirmName', { name: tableName.trim() })}</div>}
              </div>
              {playerChanges.length > 0 && <p className="info-text">{t('adminGameEditor.confirmRelink')}</p>}
              {options.recalculateElo && <p className="info-text">{t('adminGames.confirmRemoveElo')}</p>}
              {saveError && (
                <div className="alert alert-error">
                  <Icon name="AlertTriangle" size={16} />
                  <span>{saveError}</span>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={closeConfirm} disabled={saving}>
                {t('adminGames.cancel')}
              </button>
              <button className="btn-approve" onClick={handleSave} disabled={saving}>
                {saving ? t('adminGameEditor.saving') : t('adminGameEditor.confirmAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameEditor;
