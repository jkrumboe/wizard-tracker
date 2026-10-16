import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import { XIcon } from '@/components/ui/Icon';
import DeleteIconButton from '@/components/ui/DeleteIconButton';
import { Minus, Plus, UserPlus } from 'lucide-react';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from '@dnd-kit/modifiers';
import { useVisualViewportRect } from '@/shared/hooks/useVisualViewportRect';
import { useSortableRow, useSortableRowSensors } from '@/shared/hooks/useSortableRow';
import '@/styles/modals/gameSettingsModal.css';
import { useModalDismiss } from '@/shared/hooks/useModalDismiss';

const MIN_PLAYERS = 2;

// Sortable seat row, styled like the Wizard settings: drag the row, seat number, editable name
const SortablePlayerItem = ({ player, index, onNameChange, onRemove, canRemove, disabled }) => {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, style, className } = useSortableRow({
    id: player.id || `player-${index}`,
    disabled: disabled,
  });

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`gs-seat ${className}`}
      {...attributes}
      {...listeners}
      aria-label={t('settings.dragToReorder', { name: player.name })}
    >
      <div className="gs-seat-main">
        <span className="gs-seat-number">{index + 1}</span>
        <input
          type="text"
          className="gs-seat-name-input"
          value={player.name}
          onChange={(e) => onNameChange(index, e.target.value)}
          aria-label={`${t('common.player')} ${index + 1}`}
          maxLength={40}
          disabled={disabled}
        />
      </div>

      {canRemove && (
        <DeleteIconButton
          label={t('settings.removeNewPlayer', { name: player.name })}
          onClick={() => onRemove(index)}
          disabled={disabled}
        />
      )}
    </li>
  );
};

SortablePlayerItem.propTypes = {
  player: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  onNameChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  canRemove: PropTypes.bool.isRequired,
  disabled: PropTypes.bool
};

const TableGameSettingsModal = ({
  isOpen,
  onClose,
  players,
  rows,
  currentRound,
  targetNumber,
  lowIsBetter,
  allowEmptyAsZero,
  scoreEntryMode,
  teamMembers,
  currentRoundScores,
  onUpdateRoundScore,
  onAdjustRoundScore,
  onUpdateTeamMembers,
  onUpdateSettings,
  gameFinished
}) => {
  const { t } = useTranslation();
  const [localPlayers, setLocalPlayers] = useState([]);
  const [localRows, setLocalRows] = useState(10);
  const [localTargetNumber, setLocalTargetNumber] = useState(null);
  const [localLowIsBetter, setLocalLowIsBetter] = useState(false);
  const [localAllowEmptyAsZero, setLocalAllowEmptyAsZero] = useState(true);
  const [localTeamMembers, setLocalTeamMembers] = useState([[], []]);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState(null);
  const viewportRect = useVisualViewportRect(isOpen);

  const sensors = useSortableRowSensors();

  useEffect(() => {
    if (isOpen) {
      setLocalPlayers(players.map((p, idx) => ({
        ...p,
        id: p.id || `player-${idx}`,
        originalIndex: idx
      })));
      setLocalRows(rows);
      setLocalTargetNumber(targetNumber);
      setLocalLowIsBetter(lowIsBetter);
      setLocalAllowEmptyAsZero(allowEmptyAsZero !== false);
      setLocalTeamMembers(Array.isArray(teamMembers) ? teamMembers : [[], []]);
      setNewName('');
      setNameError('');
    }
  }, [isOpen, players, rows, targetNumber, lowIsBetter, allowEmptyAsZero, teamMembers]);

  // Escape closes; a confirmation opened on top closes first
  useModalDismiss(isOpen, onClose);

  if (!isOpen) return null;

  const isTwoSideScoreboard = scoreEntryMode === 'twoSideGesture';

  const handleSave = () => {
    onUpdateSettings({
      players: localPlayers,
      rows: localRows,
      targetNumber: localTargetNumber,
      lowIsBetter: localLowIsBetter,
      allowEmptyAsZero: localAllowEmptyAsZero
    });
  };

  const handlePlayerNameChange = (index, newPlayerName) => {
    const updated = [...localPlayers];
    updated[index] = { ...updated[index], name: newPlayerName };
    setLocalPlayers(updated);
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const ids = localPlayers.map((p, idx) => p.id || `player-${idx}`);
    const from = ids.indexOf(active.id);
    const to = ids.indexOf(over.id);
    if (from === -1 || to === -1) return;
    const next = [...localPlayers];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setLocalPlayers(next);
  };

  const handleAddPlayer = (e) => {
    e.preventDefault();
    if (isTwoSideScoreboard) return;
    const name = newName.trim();
    if (!name) return;
    if (localPlayers.some((p) => p.name?.trim().toLowerCase() === name.toLowerCase())) {
      setNameError(t('settings.duplicatePlayerName'));
      return;
    }
    setLocalPlayers([...localPlayers, {
      id: `player-${Date.now()}`,
      name,
      points: [],
      originalIndex: localPlayers.length
    }]);
    setNewName('');
    setNameError('');
  };

  const handleRemovePlayer = (index) => {
    if (isTwoSideScoreboard) return;
    if (localPlayers.length > MIN_PLAYERS) {
      setPlayerToDelete(index);
      setShowDeleteConfirm(true);
    }
  };

  const confirmDeletePlayer = () => {
    if (playerToDelete !== null) {
      setLocalPlayers(localPlayers.filter((_, idx) => idx !== playerToDelete));
    }
    setShowDeleteConfirm(false);
    setPlayerToDelete(null);
  };

  const cancelDeletePlayer = () => {
    setShowDeleteConfirm(false);
    setPlayerToDelete(null);
  };

  return (
    <div
      className="modal-overlay gs-overlay"
      style={viewportRect ? { top: viewportRect.top, height: viewportRect.height, bottom: 'auto' } : undefined}
      onClick={onClose}
    >
      <div
        className="modal-content gs-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tgs-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gs-header">
          <h2 id="tgs-title">{t('tableGameSettings.title')}</h2>
          <button type="button" className="gs-close" onClick={onClose} aria-label={t('common.close')}>
            <XIcon size={20} />
          </button>
        </div>

        <div className="gs-body">
          {/* Players & order */}
          <section className="gs-card" aria-labelledby="tgs-players-title">
            <div className="gs-card-head">
              <h3 id="tgs-players-title">{t('tableGameSettings.players')}</h3>
              <span className="gs-count">{localPlayers.length}</span>
            </div>
            <p className="gs-hint">{t('tableGameSettings.playersHint')}</p>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            >
              <SortableContext
                items={localPlayers.map((p, idx) => p.id || `player-${idx}`)}
                strategy={verticalListSortingStrategy}
              >
                <ol className="gs-seats">
                  {localPlayers.map((player, index) => (
                    <SortablePlayerItem
                      key={player.id || index}
                      player={player}
                      index={index}
                      onNameChange={handlePlayerNameChange}
                      onRemove={handleRemovePlayer}
                      canRemove={!isTwoSideScoreboard && localPlayers.length > MIN_PLAYERS}
                      disabled={gameFinished}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>

            {!isTwoSideScoreboard && !gameFinished && (
              <form className="gs-add-player" onSubmit={handleAddPlayer}>
                <input
                  type="text"
                  value={newName}
                  enterKeyHint="done"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="words"
                  onFocus={(e) => {
                    const field = e.currentTarget;
                    setTimeout(() => field.scrollIntoView({ block: 'nearest' }), 300);
                  }}
                  onChange={(e) => { setNewName(e.target.value); setNameError(''); }}
                  placeholder={t('settings.addPlayerPlaceholder')}
                  aria-label={t('settings.addPlayerPlaceholder')}
                  aria-invalid={nameError ? 'true' : undefined}
                  maxLength={40}
                />
                <button type="submit" className="gs-add-btn" disabled={!newName.trim()}>
                  <UserPlus size={16} />
                  {t('settings.addPlayer')}
                </button>
              </form>
            )}
            {nameError && <p className="gs-error" role="alert">{nameError}</p>}
          </section>

          {/* Scoring */}
          <section className="gs-card" aria-labelledby="tgs-scoring-title">
            <h3 id="tgs-scoring-title">{t('tableGameSettings.scoring')}</h3>

            <div className="gs-row">
              <label htmlFor="tgs-target" className="gs-row-label">
                {t('tableGameSettings.targetNumberLabel')}
              </label>
              <input
                id="tgs-target"
                type="number"
                inputMode="numeric"
                className="gs-field-input"
                value={localTargetNumber || ''}
                onChange={(e) => setLocalTargetNumber(e.target.value ? Number.parseInt(e.target.value, 10) : null)}
                placeholder="200"
                disabled={gameFinished}
              />
            </div>

            <div className="gs-row">
              <span className="gs-row-label" id="tgs-pref-label">
                {t('tableGameSettings.scoringPreference').replace(/:\s*$/, '')}
              </span>
              <div className="gs-segmented" role="radiogroup" aria-labelledby="tgs-pref-label">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!localLowIsBetter}
                  className={!localLowIsBetter ? 'is-active' : ''}
                  onClick={() => setLocalLowIsBetter(false)}
                  disabled={gameFinished}
                >
                  {t('tableGameSettings.highScore')}
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={localLowIsBetter}
                  className={localLowIsBetter ? 'is-active' : ''}
                  onClick={() => setLocalLowIsBetter(true)}
                  disabled={gameFinished}
                >
                  {t('tableGameSettings.lowScore')}
                </button>
              </div>
            </div>

            {!isTwoSideScoreboard && (
              <label className="gs-row gs-toggle-row" htmlFor="tgs-allow-empty">
                <span className="gs-row-text">
                  <span className="gs-row-label">{t('tableGameSettings.allowEmptyAsZero')}</span>
                  <span className="gs-hint">{t('tableGameSettings.allowEmptyAsZeroHint')}</span>
                </span>
                <input
                  id="tgs-allow-empty"
                  type="checkbox"
                  role="switch"
                  className="gs-switch"
                  checked={localAllowEmptyAsZero}
                  onChange={(e) => setLocalAllowEmptyAsZero(e.target.checked)}
                  disabled={gameFinished}
                />
              </label>
            )}
          </section>

          {isTwoSideScoreboard && Array.isArray(currentRoundScores) && (
            <section className="gs-card" aria-labelledby="tgs-score-title">
              <h3 id="tgs-score-title">{t('tableGameSettings.currentScoreEditor', { round: currentRound })}</h3>
              {localPlayers.map((player, index) => (
                <div className="gs-row" key={player.id || index}>
                  <span className="gs-row-label">{player.name || `${t('common.player')} ${index + 1}`}</span>
                  <div className="gs-stepper">
                    <button
                      type="button"
                      className="gs-step-btn"
                      onClick={() => onAdjustRoundScore(index, -1)}
                      disabled={gameFinished}
                      aria-label="-1"
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      className="gs-step-input"
                      value={currentRoundScores[index] ?? 0}
                      onChange={(e) => onUpdateRoundScore(index, e.target.value)}
                      disabled={gameFinished}
                    />
                    <button
                      type="button"
                      className="gs-step-btn"
                      onClick={() => onAdjustRoundScore(index, 1)}
                      disabled={gameFinished}
                      aria-label="+1"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {isTwoSideScoreboard && (
            <section className="gs-card" aria-labelledby="tgs-teams-title">
              <h3 id="tgs-teams-title">{t('tableGameSettings.teamMembers')}</h3>
              {[0, 1].map((teamIndex) => (
                <label className="gs-field" key={teamIndex}>
                  <span className="gs-row-label">{localPlayers[teamIndex]?.name || `Team ${teamIndex + 1}`}</span>
                  <textarea
                    className="gs-field-input gs-textarea"
                    value={(localTeamMembers[teamIndex] || []).map((member) => member.name).join('\n')}
                    onChange={(e) => {
                      const lines = e.target.value
                        .split('\n')
                        .map((name) => name.trim())
                        .filter(Boolean);
                      const updated = [...localTeamMembers];
                      updated[teamIndex] = lines.map((name, idx) => ({
                        id: `${teamIndex}-${idx}-${Date.now()}`,
                        name,
                      }));
                      setLocalTeamMembers(updated);
                      onUpdateTeamMembers?.(updated);
                    }}
                    rows={4}
                    disabled={gameFinished}
                  />
                </label>
              ))}
            </section>
          )}
        </div>

        <div className="gs-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={gameFinished}>
            {t('common.save')}
          </button>
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={cancelDeletePlayer}
        onConfirm={confirmDeletePlayer}
        title={t('tableGame.deletePlayerTitle')}
        message={
          playerToDelete === null
            ? t('tableGame.deletePlayerDefault')
            : t('tableGame.deletePlayerMessage', { name: localPlayers[playerToDelete]?.name })
        }
        confirmText={t('tableGame.deletePlayerConfirm')}
      />
    </div>
  );
};

TableGameSettingsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  players: PropTypes.array.isRequired,
  rows: PropTypes.number.isRequired,
  currentRound: PropTypes.number.isRequired,
  targetNumber: PropTypes.number,
  lowIsBetter: PropTypes.bool.isRequired,
  allowEmptyAsZero: PropTypes.bool,
  scoreEntryMode: PropTypes.string,
  teamMembers: PropTypes.array,
  currentRoundScores: PropTypes.array,
  onUpdateRoundScore: PropTypes.func,
  onAdjustRoundScore: PropTypes.func,
  onUpdateTeamMembers: PropTypes.func,
  onUpdateSettings: PropTypes.func.isRequired,
  gameFinished: PropTypes.bool.isRequired
};

export default TableGameSettingsModal;
