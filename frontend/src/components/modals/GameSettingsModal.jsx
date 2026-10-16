import React, { useState, useEffect } from 'react';
import { XIcon, CrownIcon, RotateCcwIcon } from '@/components/ui/Icon';
import DeleteIconButton from '@/components/ui/DeleteIconButton';
import { Minus, Plus, Megaphone, UserPlus } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from '@dnd-kit/modifiers';
import { useTranslation } from 'react-i18next';
import { useVisualViewportRect } from '@/shared/hooks/useVisualViewportRect';
import { useSortableRow, useSortableRowSensors } from '@/shared/hooks/useSortableRow';
import EditionPicker from '@/components/game/EditionPicker';
import { getTemplateEditions, findEdition, buildEditionConfig } from '@/shared/utils/gameEditions';
import '@/styles/modals/gameSettingsModal.css';
import { useModalDismiss } from '@/shared/hooks/useModalDismiss';

const MAX_ROUNDS_LIMIT = 60;
const DEFAULT_MAX_PLAYERS = 6;

const mod = (value, n) => ((value % n) + n) % n;

const createPlayerId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.floor(Math.random() * 1000)}`;

// Sortable seat row: drag the row to reorder, tap it to pick the dealer
const SeatRow = ({ player, seat, role, showRoles, isNew, onSelectDealer, onRemove }) => {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    style,
    className: sortableClassName,
  } = useSortableRow({ id: player.id });

  const className = [
    'gs-seat',
    sortableClassName,
    role === 'dealer' && 'is-dealer',
  ].filter(Boolean).join(' ');

  // Not a disabled button when there is no dealer to pick: disabled buttons
  // swallow the pointer events the row needs to start a drag
  const Main = showRoles ? 'button' : 'div';

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={className}
      {...attributes}
      {...listeners}
      aria-label={t('settings.dragToReorder', { name: player.name })}
    >
      <Main
        type={showRoles ? 'button' : undefined}
        className="gs-seat-main"
        data-drag-surface
        onClick={showRoles ? onSelectDealer : undefined}
        aria-pressed={showRoles ? role === 'dealer' : undefined}
      >
        <span className="gs-seat-number">{seat + 1}</span>
        <span className="gs-seat-name">{player.name}</span>
        {isNew && <span className="gs-role gs-role-new">{t('settings.newPlayer')}</span>}
        {showRoles && role === 'dealer' && (
          <span className="gs-role gs-role-dealer">
            <CrownIcon size={14} />
            {t('settings.dealer')}
          </span>
        )}
        {showRoles && role === 'caller' && (
          <span className="gs-role gs-role-caller">
            <Megaphone size={14} />
            {t('settings.callsFirst')}
          </span>
        )}
      </Main>

      {isNew && (
        <DeleteIconButton
          label={t('settings.removeNewPlayer', { name: player.name })}
          onClick={onRemove}
        />
      )}
    </li>
  );
};

const GameSettingsModal = ({ isOpen, onClose, gameState, onUpdateSettings }) => {
  const { t } = useTranslation();
  const [maxRounds, setMaxRounds] = useState(1);
  const [roundsInput, setRoundsInput] = useState('1');
  const [newPlayers, setNewPlayers] = useState([]);
  const [order, setOrder] = useState([]); // player ids in seat order
  const [dealerId, setDealerId] = useState(null);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState('');
  const [editionId, setEditionId] = useState(null);
  const viewportRect = useVisualViewportRect(isOpen);

  const sensors = useSortableRowSensors();

  // Reset local state whenever the modal opens
  useEffect(() => {
    if (!isOpen || !gameState) return;
    const initialMax = Number.parseInt(gameState.maxRounds, 10) || 1;
    setMaxRounds(initialMax);
    setRoundsInput(String(initialMax));
    setNewPlayers([]);
    setNewName('');
    setNameError('');
    setEditionId(gameState.templateConfig?.edition ?? null);
    setOrder(gameState.players.map((p) => p.id));
    const n = gameState.players.length;
    const round = (Number.parseInt(gameState.currentRound, 10) || 1) - 1;
    const seat = n > 0 ? mod((gameState.startingDealerIndex || 0) + round, n) : 0;
    setDealerId(gameState.players[seat]?.id ?? null);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape closes; a confirmation opened on top closes first
  useModalDismiss(isOpen, onClose);

  if (!isOpen || !gameState) return null;

  const existingPlayers = gameState.players;
  const allPlayers = [...existingPlayers, ...newPlayers];
  const newIds = new Set(newPlayers.map((p) => p.id));
  const orderedPlayers = order.map((id) => allPlayers.find((p) => p.id === id)).filter(Boolean);
  const playerCount = orderedPlayers.length;

  const currentRound = Number.parseInt(gameState.currentRound, 10) || 1;
  const roundIndex = currentRound - 1;
  const showRoles = gameState.templateConfig?.hasDealerRotation !== false;
  const maxPlayers = gameState.templateConfig?.maxPlayers ?? DEFAULT_MAX_PLAYERS;
  const templateRounds = Number.parseInt(gameState.templateConfig?.maxRounds, 10);
  // Without a template override, the 60-card deck caps the rounds
  const deckRounds = playerCount > 0 ? Math.floor(MAX_ROUNDS_LIMIT / playerCount) : MAX_ROUNDS_LIMIT;
  const standardRounds = Math.min(MAX_ROUNDS_LIMIT, templateRounds || deckRounds);
  const minRounds = Math.max(1, currentRound);
  const exceedsDeck = !templateRounds && maxRounds > deckRounds;
  // Games started before templates were recorded are Wizard games
  const editions = getTemplateEditions(gameState.templateConfig?.templateName || 'Wizard');
  const editionChanged = editionId !== (gameState.templateConfig?.edition ?? null);

  const dealerSeat = Math.max(0, orderedPlayers.findIndex((p) => p.id === dealerId));
  const callerSeat = playerCount > 0 ? (dealerSeat + 1) % playerCount : 0;
  const roleForSeat = (seat) => {
    if (seat === dealerSeat) return 'dealer';
    if (seat === callerSeat) return 'caller';
    return null;
  };

  const initialDealerSeat = existingPlayers.length > 0
    ? mod((gameState.startingDealerIndex || 0) + roundIndex, existingPlayers.length)
    : 0;
  const isDirty =
    newPlayers.length > 0 ||
    editionChanged ||
    maxRounds !== (Number.parseInt(gameState.maxRounds, 10) || 1) ||
    order.some((id, seat) => id !== existingPlayers[seat]?.id) ||
    (showRoles && dealerSeat !== initialDealerSeat);

  const commitRounds = (value) => {
    const clamped = Math.min(MAX_ROUNDS_LIMIT, Math.max(minRounds, value));
    setMaxRounds(clamped);
    setRoundsInput(String(clamped));
  };

  const handleRoundsInputBlur = () => {
    const parsed = Number.parseInt(roundsInput, 10);
    commitRounds(Number.isNaN(parsed) ? maxRounds : parsed);
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = order.indexOf(active.id);
    const to = order.indexOf(over.id);
    if (from === -1 || to === -1) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
  };

  const handleAddPlayer = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (allPlayers.some((p) => p.name?.trim().toLowerCase() === name.toLowerCase())) {
      setNameError(t('settings.duplicatePlayerName'));
      return;
    }
    const player = { id: createPlayerId(), name };
    setNewPlayers((prev) => [...prev, player]);
    setOrder((prev) => [...prev, player.id]);
    setNewName('');
    setNameError('');
  };

  const handleRemoveNewPlayer = (id) => {
    setNewPlayers((prev) => prev.filter((p) => p.id !== id));
    setOrder((prev) => prev.filter((pid) => pid !== id));
    if (dealerId === id) setDealerId(order.find((pid) => pid !== id) ?? null);
  };

  const handleSave = () => {
    const indexById = new Map(allPlayers.map((p, idx) => [p.id, idx]));
    onUpdateSettings({
      maxRounds,
      newPlayers,
      playerOrder: order.map((id) => indexById.get(id)),
      // Store the round-1 dealer so rotation lands on the chosen dealer this round
      startingDealerIndex: playerCount > 0 ? mod(dealerSeat - roundIndex, playerCount) : 0,
      editionConfig: editionChanged ? buildEditionConfig(findEdition(editions, editionId)) : null,
    });
    onClose();
  };

  const canAddPlayer = playerCount < maxPlayers;

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
        aria-labelledby="gs-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gs-header">
          <h2 id="gs-title">{t('settings.gameSettings')}</h2>
          <button type="button" className="gs-close" onClick={onClose} aria-label={t('common.close')}>
            <XIcon size={20} />
          </button>
        </div>

        <div className="gs-body">
          {/* Rounds */}
          <section className="gs-card gs-rounds" aria-labelledby="gs-rounds-title">
            <div className="gs-rounds-text">
              <h3 id="gs-rounds-title">{t('settings.rounds')}</h3>
              <span className="gs-rounds-sub">
                {t('settings.roundProgress', { current: currentRound, max: maxRounds })}
              </span>
            </div>

            {maxRounds !== standardRounds && standardRounds >= minRounds && (
              <button
                type="button"
                className="gs-icon-btn"
                onClick={() => commitRounds(standardRounds)}
                aria-label={t('settings.resetToStandard', { count: standardRounds })}
                title={t('settings.resetToStandard', { count: standardRounds })}
              >
                <RotateCcwIcon size={16} />
              </button>
            )}

            <div className="gs-stepper">
              <button
                type="button"
                className="gs-step-btn"
                onClick={() => commitRounds(maxRounds - 1)}
                disabled={maxRounds <= minRounds}
                aria-label={t('settings.fewerRounds')}
              >
                <Minus size={16} />
              </button>
              <input
                type="number"
                inputMode="numeric"
                className="gs-step-input"
                value={roundsInput}
                min={minRounds}
                max={MAX_ROUNDS_LIMIT}
                onChange={(e) => setRoundsInput(e.target.value)}
                onBlur={handleRoundsInputBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                aria-label={t('settings.totalRounds')}
              />
              <button
                type="button"
                className="gs-step-btn"
                onClick={() => commitRounds(maxRounds + 1)}
                disabled={maxRounds >= MAX_ROUNDS_LIMIT}
                aria-label={t('settings.moreRounds')}
              >
                <Plus size={16} />
              </button>
            </div>

            {exceedsDeck && (
              <p className="gs-warning">
                {t('settings.deckLimitWarning', { count: playerCount, max: deckRounds })}
              </p>
            )}
          </section>

          {/* Edition: decides which special card switches the game shows */}
          {editions.length > 0 && (
            <section className="gs-card" aria-labelledby="gs-edition-title">
              <h3 id="gs-edition-title">{t('editions.label')}</h3>
              <p className="gs-hint">{t('editions.hint')}</p>
              <EditionPicker
                editions={editions}
                value={editionId}
                onChange={(edition) => setEditionId(edition.id)}
                name="gs-edition"
              />
            </section>
          )}

          {/* Players, seating & dealer */}
          <section className="gs-card" aria-labelledby="gs-seating-title">
            <div className="gs-card-head">
              <h3 id="gs-seating-title">
                {showRoles ? t('settings.seatingAndDealer') : t('settings.seating')}
              </h3>
              <span className="gs-count">{playerCount} / {maxPlayers}</span>
            </div>
            <p className="gs-hint">
              {showRoles ? t('settings.seatingHint') : t('settings.seatingHintNoDealer')}
            </p>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            >
              <SortableContext items={order} strategy={verticalListSortingStrategy}>
                <ol className="gs-seats">
                  {orderedPlayers.map((player, seat) => (
                    <SeatRow
                      key={player.id}
                      player={player}
                      seat={seat}
                      showRoles={showRoles}
                      isNew={newIds.has(player.id)}
                      role={roleForSeat(seat)}
                      onSelectDealer={() => setDealerId(player.id)}
                      onRemove={() => handleRemoveNewPlayer(player.id)}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>

            {canAddPlayer ? (
              <form className="gs-add-player" onSubmit={handleAddPlayer}>
                <input
                  type="text"
                  value={newName}
                  enterKeyHint="done"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="words"
                  onFocus={(e) => {
                    // Once the keyboard has settled, bring the field into view
                    // inside the sheet's own scroll area
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
            ) : (
              <p className="gs-hint">{t('settings.maxPlayersReached', { count: maxPlayers })}</p>
            )}
            {nameError && <p className="gs-error" role="alert">{nameError}</p>}
            {newPlayers.length > 0 && currentRound > 1 && (
              <p className="gs-hint">
                {t('settings.lateJoinHint', { count: currentRound - 1 })}
              </p>
            )}
          </section>
        </div>

        <div className="gs-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!isDirty}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameSettingsModal;
