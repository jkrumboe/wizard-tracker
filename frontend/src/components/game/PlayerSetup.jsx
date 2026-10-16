import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TrashIcon, DiceIcon, UsersIcon, PlusIcon } from '@/components/ui/Icon';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
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

// The whole row is the drag handle, so sensors must not start a drag from
// the controls inside it - the name field, remove button and team select
const ignoringControls = (Sensor, controls) => class extends Sensor {
  static activators = Sensor.activators.map(({ eventName, handler }) => ({
    eventName,
    handler: (event, ...rest) => !event.nativeEvent.target?.closest?.(controls) && handler(event, ...rest),
  }));
};

// Mouse: click-drag anywhere but the field. Touch: long-press anywhere, even
// the field - a tap still focuses it. Keyboard: space/enter on the focused row.
const RowMouseSensor = ignoringControls(MouseSensor, 'input, button, select');
const RowTouchSensor = ignoringControls(TouchSensor, 'button, select');
const RowKeyboardSensor = ignoringControls(KeyboardSensor, 'input, button, select');

// Sortable Player Item Component
const SortablePlayerItem = ({
  player,
  index,
  onNameChange,
  onNameBlur,
  onRemove,
  isTwoSideScoreboard,
  onTeamChange,
}) => {
  const { t } = useTranslation();
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
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`player-item ${isDragging ? 'dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <span className="player-number">
        {index + 1}
      </span>

      <input
        type="text"
        className="inputPlayerName"
        value={player.name}
        onChange={(e) => onNameChange(player.id, e.target.value)}
        onBlur={(e) => onNameBlur?.(player.id, e.target.value)}
        onFocus={(e) => e.target.select()}
        placeholder={t('game.playerPlaceholder', { n: index + 1 })}
      />

      {isTwoSideScoreboard && (
        <select
          className="player-team-select"
          value={player.teamIndex === 1 ? '1' : '0'}
          onChange={(e) => onTeamChange?.(player.id, Number(e.target.value))}
          title={t('startTableGame.teamAssignment')}
        >
          <option value="0">{t('startTableGame.teamOne')}</option>
          <option value="1">{t('startTableGame.teamTwo')}</option>
        </select>
      )}

      <button
        className="remove-btn"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(player.id);
        }}
        title={t('startTableGame.removePlayer')}
        aria-label={t('startTableGame.removePlayer')}
      >
        <TrashIcon size={18} aria-hidden="true" />
      </button>
    </div>
  );
};

const PlayerSetup = ({
  players,
  onAddPlayer,
  onRemovePlayer,
  onReorderPlayers,
  onPlayerNameChange,
  onPlayerNameBlur,
  onRandomize,
  onAddFriends,
  onPlayerTeamChange,
  isTwoSideScoreboard = false,
  maxPlayers,
}) => {
  const { t } = useTranslation();
  const playerListRef = useRef(null);

  const sensors = useSensors(
    useSensor(RowMouseSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(RowTouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 8,
      },
    }),
    useSensor(RowKeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = players.findIndex((p) => p.id === active.id);
      const newIndex = players.findIndex((p) => p.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderPlayers(oldIndex, newIndex);
      }
    }
  };

  const handleAddPlayer = () => {
    onAddPlayer();
    // Scroll to bottom after adding
    setTimeout(() => {
      if (playerListRef.current) {
        playerListRef.current.scrollTo({
          top: playerListRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 100);
  };

  return (
    <div className="setup-section">
      <div className="setup-section-header">
        <span className="setup-section-title">{t('common.players')}</span>
        <span className="player-count-chip">
          {maxPlayers < 100 ? `${players.length} / ${maxPlayers}` : players.length}
        </span>
      </div>

      <div className="selected-players-wrapper">
        <div className="selected-players" ref={playerListRef}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          >
            <SortableContext
              items={players.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="player-list">
                {players.map((player, index) => (
                  <SortablePlayerItem
                    key={player.id}
                    player={player}
                    index={index}
                    onNameChange={onPlayerNameChange}
                    onNameBlur={onPlayerNameBlur}
                    onRemove={onRemovePlayer}
                    isTwoSideScoreboard={isTwoSideScoreboard}
                    onTeamChange={onPlayerTeamChange}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      <div className="player-actions">
        <button
          className="randomizer-btn"
          onClick={onRandomize}
          disabled={players.length < 2}
          title={t('game.randomizeOrder')}
          aria-label={t('game.randomizeOrder')}
        >
          <DiceIcon size={20} />
        </button>
        <button
          className="addPlayer"
          onClick={handleAddPlayer}
          disabled={players.length >= maxPlayers}
        >
          <PlusIcon size={18} aria-hidden="true" />
          <span>{t('startTableGame.addPlayer')}</span>
        </button>
        <button
          className="add-friends-btn"
          onClick={onAddFriends}
          title={t('game.addFriendsToGame')}
          aria-label={t('game.addFriendsToGame')}
        >
          <UsersIcon size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default PlayerSetup;
