import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical } from 'lucide-react';
import { XIcon, DiceIcon, UsersIcon, PlusIcon } from '@/components/ui/Icon';
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

// Sortable Player Item Component
const SortablePlayerItem = ({
  player,
  index,
  onNameChange,
  onNameBlur,
  onRemove,
  isLookingUp,
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

  const isVerified = !!player.userId;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`player-item ${isDragging ? 'dragging' : ''} ${isVerified ? 'verified' : ''}`}
      {...attributes}
    >
      <div
        className="drag-handle"
        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'grab' }}
        {...listeners}
      >
        <GripVertical size={16} />
        <span className="player-number">
          {index + 1}
        </span>
      </div>

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

      {isLookingUp && (
        <span className="lookup-spinner" title={t('startTableGame.lookingUpUser')}>
          ⏳
        </span>
      )}

      <button
        className="remove-btn"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(player.id);
        }}
        title={t('startTableGame.removePlayer')}
      >
        <XIcon size={16} />
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
  lookingUpPlayers = new Set(),
}) => {
  const { t } = useTranslation();
  const playerListRef = useRef(null);

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
                    isLookingUp={lookingUpPlayers.has(player.id)}
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
          <DiceIcon size={25} />
        </button>
        <button
          className="addPlayer"
          onClick={handleAddPlayer}
          disabled={players.length >= maxPlayers}
        >
          +
        </button>
        <button
          className="add-friends-btn"
          onClick={onAddFriends}
          title={t('game.addFriendsToGame')}
        >
          <UsersIcon size={25} />
        </button>
      </div>
    </div>
  );
};

export default PlayerSetup;
