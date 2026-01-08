import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { XIcon, PlusIcon } from '@/components/ui/Icon';
import { GripVertical } from 'lucide-react';
import DeleteConfirmationModal from './DeleteConfirmationModal';
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

const MIN_PLAYERS = 2;

// Sortable Player Item Component
const SortablePlayerItem = ({ player, index, onNameChange, onRemove, canRemove, disabled }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: player.id || `player-${index}`,
    disabled: disabled,
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
        style={{ cursor: disabled ? 'default' : 'grab', gap: '0.5rem', display: 'flex', alignItems: 'center' }}
      >
        <GripVertical size={16} />
        <div className='player-number'>
          {player.originalIndex + 1}
        </div>
      </div>
      
      <input
        type="text"
        className="player-name-input"
        value={player.name}
        onChange={(e) => onNameChange(index, e.target.value)}
        disabled={disabled}
      />
      {canRemove && (
        <button
          className="remove-player-btn"
          onClick={() => onRemove(index)}
          disabled={disabled}
        >
          <XIcon size={16} />
        </button>
      )}
    </div>
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
  targetNumber,
  lowIsBetter,
  onUpdateSettings,
  gameFinished 
}) => {
  const [localPlayers, setLocalPlayers] = useState([]);
  const [localRows, setLocalRows] = useState(10);
  const [localTargetNumber, setLocalTargetNumber] = useState(null);
  const [localLowIsBetter, setLocalLowIsBetter] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState(null);

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
    if (isOpen) {
      setLocalPlayers(players.map((p, idx) => ({ 
        ...p, 
        id: p.id || `player-${idx}`,
        originalIndex: idx 
      })));
      setLocalRows(rows);
      setLocalTargetNumber(targetNumber);
      setLocalLowIsBetter(lowIsBetter);
    }
  }, [isOpen, players, rows, targetNumber, lowIsBetter]);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateSettings({
      players: localPlayers,
      rows: localRows,
      targetNumber: localTargetNumber,
      lowIsBetter: localLowIsBetter
    });
  };

  const handlePlayerNameChange = (index, newName) => {
    const updated = [...localPlayers];
    updated[index].name = newName;
    setLocalPlayers(updated);
  };

  // @dnd-kit drag end handler
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = localPlayers.findIndex(player => (player.id || `player-${localPlayers.indexOf(player)}`) === active.id);
      const newIndex = localPlayers.findIndex(player => (player.id || `player-${localPlayers.indexOf(player)}`) === over?.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newPlayers = [...localPlayers];
        const [removed] = newPlayers.splice(oldIndex, 1);
        newPlayers.splice(newIndex, 0, removed);
        setLocalPlayers(newPlayers);
      }
    }
  };

  const handleAddPlayer = () => {
    const newPlayer = {
      id: `player-${Date.now()}`,
      name: `Player ${localPlayers.length + 1}`,
      points: [],
      originalIndex: localPlayers.length
    };
    setLocalPlayers([...localPlayers, newPlayer]);
  };

  const handleRemovePlayer = (index) => {
    if (localPlayers.length > MIN_PLAYERS) {
      setPlayerToDelete(index);
      setShowDeleteConfirm(true);
    }
  };

  const confirmDeletePlayer = () => {
    if (playerToDelete !== null) {
      const updated = localPlayers.filter((_, idx) => idx !== playerToDelete);
      setLocalPlayers(updated);
    }
    setShowDeleteConfirm(false);
    setPlayerToDelete(null);
  };

  const cancelDeletePlayer = () => {
    setShowDeleteConfirm(false);
    setPlayerToDelete(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content game-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Game Settings</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <XIcon size={24} />
          </button>
        </div>

        <div className="modal-body">
          {/* Player Order - Moved to Top */}
          <div className="settings-section">
            <h3>Players</h3>
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            >
              <SortableContext 
                items={localPlayers.map(p => p.id || `player-${localPlayers.indexOf(p)}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="player-order-list">
                  {localPlayers.map((player, index) => (
                    <SortablePlayerItem
                      key={player.id || index}
                      player={player}
                      index={index}
                      onNameChange={handlePlayerNameChange}
                      onRemove={handleRemovePlayer}
                      canRemove={localPlayers.length > MIN_PLAYERS}
                      disabled={gameFinished}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <button
              className="add-player-modal-btn"
              onClick={handleAddPlayer}
              disabled={gameFinished}
            >
              <PlusIcon size={16} />
              Add Player
            </button>
          </div>

          {/* Game Settings - Styled like StartTableGameModal */}
          <div className="settings-section game-settings-info">
            <h3>Game Settings</h3>
            <div className="settings-details">
              <div className="add-section">
                <label htmlFor="target-number-input">Target Number (optional):</label>
                <input
                  id="target-number-input"
                  type="number"
                  className="game-name-input"
                  value={localTargetNumber || ''}
                  onChange={(e) => setLocalTargetNumber(e.target.value ? Number.parseInt(e.target.value, 10) : null)}
                  placeholder="200"
                  disabled={gameFinished}
                />
              </div>
              <div className="add-section">
                <label>Scoring Preference:</label>
                 <div className="scoring-prefernce-type" style={{ display: 'flex'}}>
                  <label htmlFor="high-score-radio" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      id="high-score-radio"
                      type="radio"
                      name="scoring-preference"
                      checked={localLowIsBetter === false}
                      onChange={() => setLocalLowIsBetter(false)}
                      disabled={gameFinished}
                    />
                    <span>High Score</span>
                  </label>
                 <label htmlFor="low-score-radio" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      id="low-score-radio"
                      type="radio"
                      name="scoring-preference"
                      checked={localLowIsBetter}
                      onChange={() => setLocalLowIsBetter(true)}
                      disabled={gameFinished}
                    />
                    <span>Low Score</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={handleSave}
            disabled={gameFinished}
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Delete Player Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={cancelDeletePlayer}
        onConfirm={confirmDeletePlayer}
        title="Delete Player"
        message={
          playerToDelete === null
            ? 'Are you sure you want to delete this player?'
            : `Are you sure you want to delete "${localPlayers[playerToDelete]?.name}"? All their scores will be permanently lost.`
        }
        confirmText="Delete Player"
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
  onUpdateSettings: PropTypes.func.isRequired,
  gameFinished: PropTypes.bool.isRequired
};

export default TableGameSettingsModal;
