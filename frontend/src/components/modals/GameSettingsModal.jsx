import React, { useState, useEffect } from 'react';
import { XIcon } from '@/components/ui/Icon';
import { GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from '@dnd-kit/modifiers';
import { useTranslation } from 'react-i18next';

// Sortable Player Item Component
const SortablePlayerItem = ({ player, index }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: player.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`player-order-item ${isDragging ? 'dragging' : ''}`}
      {...attributes}
    >
      <div
        className="drag-handle"
        {...listeners}
        style={{ cursor: 'grab', gap: '0.5rem', display: 'flex', alignItems: 'center' }}
      >
        <GripVertical size={16} />
        <div className='player-number'>
          {index + 1}
        </div>
      </div>
      
      <div className="player-name-display">{player.name}</div>
    </div>
  );
};

const GameSettingsModal = ({ isOpen, onClose, gameState, onUpdateSettings }) => {
  const { t } = useTranslation();
  const [dealerIndex, setDealerIndex] = useState(0);
  const [maxRounds, setMaxRounds] = useState(1);
  const [playerOrder, setPlayerOrder] = useState([]);

  // @dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (gameState) {
      // Use startingDealerIndex from gameState or calculate from current round
      const currentDealerIndex = gameState.startingDealerIndex !== undefined 
        ? gameState.startingDealerIndex 
        : gameState.players.findIndex(p => p.isDealer);
      setDealerIndex(currentDealerIndex >= 0 ? currentDealerIndex : 0);
      
      // Set max rounds
      setMaxRounds(parseInt(gameState.maxRounds, 10) || 1);
      
      // Set player order
      setPlayerOrder(gameState.players.map((p, idx) => idx));
    }
  }, [gameState, isOpen]);

  if (!isOpen || !gameState) return null;

  const handleDealerChange = (newDealerIndex) => {
    setDealerIndex(newDealerIndex);
  };

  const handleMaxRoundsChange = (newMaxRounds) => {
    // Minimum 1 round, reasonable maximum based on player count
    const currentRound = parseInt(gameState.currentRound, 10) || 1;
    if (newMaxRounds >= currentRound && newMaxRounds <= 60) {
      setMaxRounds(newMaxRounds);
    }
  };

  // @dnd-kit drag end handler
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = playerOrder.findIndex((idx) => gameState.players[idx].id === active.id);
      const newIndex = playerOrder.findIndex((idx) => gameState.players[idx].id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = [...playerOrder];
        const [removed] = newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, removed);
        setPlayerOrder(newOrder);
      }
    }
  };

  const handleSave = () => {
    // Calculate new caller index (one after dealer)
    const newCallerIndex = (dealerIndex + 1) % gameState.players.length;
    
    onUpdateSettings({
      dealerIndex,
      callerIndex: newCallerIndex,
      maxRounds,
      playerOrder
    });
    onClose();
  };

  const orderedPlayers = playerOrder.map(idx => gameState.players[idx]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content game-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('settings.gameSettings')}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <XIcon size={24} />
          </button>
        </div>

        <div className="modal-body">
          {/* Max Rounds Setting */}
          <div className="setting-section">
            <h3>Max Rounds</h3>
            <div className="setting-control">
              <button 
                className="round-control-btn"
                onClick={() => handleMaxRoundsChange(maxRounds - 1)}
                disabled={maxRounds <= parseInt(gameState.currentRound, 10)}
              >
                -
              </button>
              <input
                type="number"
                value={maxRounds}
                onChange={(e) => handleMaxRoundsChange(parseInt(e.target.value, 10))}
                min={gameState.currentRound}
                max="60"
                className="round-input"
              />
              <button 
                className="round-control-btn"
                onClick={() => handleMaxRoundsChange(maxRounds + 1)}
                disabled={maxRounds >= 60}
              >
                +
              </button>
            </div>
            <p className="setting-hint">
              Currently on round {gameState.currentRound}. Max rounds: {maxRounds}
            </p>
          </div>

          {/* Dealer Selection */}
          <div className="setting-section">
            <h3>Dealer</h3>
            <div className="dealer-selection">
              {gameState.players.map((player, index) => (
                <label key={player.id} className="dealer-option">
                  <input
                    type="radio"
                    name="dealer"
                    checked={dealerIndex === index}
                    onChange={() => handleDealerChange(index)}
                  />
                  <span>{player.name}</span>
                  {dealerIndex === index && <span className="badge">Dealer</span>}
                  {(dealerIndex + 1) % gameState.players.length === index && (
                    <span className="badge caller-badge">Caller</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Player Order */}
          <div className="setting-section">
            <h3>Player Order</h3>
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            >
              <SortableContext 
                items={orderedPlayers.map(p => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="player-order-list">
                  {orderedPlayers.map((player, index) => (
                    <SortablePlayerItem
                      key={player.id}
                      player={player}
                      index={index}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameSettingsModal;
