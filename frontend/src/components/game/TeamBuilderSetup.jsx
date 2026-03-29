import { useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Icon, { TrashIcon, DiceIcon, UsersIcon, EditIcon } from '@/components/ui/Icon';

const TeamSection = ({
  teamIndex,
  title,
  otherTeamLabel,
  onTeamNameChange,
  players,
  onNameChange,
  onNameBlur,
  onRemovePlayer,
  onMovePlayer,
  lookingUpPlayers,
}) => {
  const { t } = useTranslation();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(title);
  const inputRef = useRef(null);

  const handleEditClick = () => {
    setIsEditingName(true);
    setEditNameValue(title);
  };

  const handleSaveName = (newName) => {
    onTeamNameChange(newName);
    setIsEditingName(false);
  };

  const handleInputBlur = () => {
    handleSaveName(editNameValue);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveName(editNameValue);
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
    }
  };

  return (
    <section className={`team-builder-panel ${teamIndex === 0 ? 'team-one' : 'team-two'}`}>
      <header className="team-builder-panel-header">
        {isEditingName ? (
          <input
            ref={inputRef}
            type="text"
            className="team-builder-name-input"
            value={editNameValue}
            onChange={(e) => setEditNameValue(e.target.value)}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            autoFocus
            placeholder={
              teamIndex === 0
                ? t('startTableGame.teamNamePlaceholderOne', { defaultValue: 'Team 1 name' })
                : t('startTableGame.teamNamePlaceholderTwo', { defaultValue: 'Team 2 name' })
            }
            aria-label={
              teamIndex === 0
                ? t('startTableGame.teamNameAriaOne', { defaultValue: 'Team 1 name' })
                : t('startTableGame.teamNameAriaTwo', { defaultValue: 'Team 2 name' })
            }
          />
        ) : (
          <div className="team-builder-name-display">
            <span className="team-builder-name-text">{title}</span>
            <button
              type="button"
              className="team-builder-edit-btn"
              onClick={handleEditClick}
              title={t('common.edit', { defaultValue: 'Edit' })}
              aria-label={t('common.edit', { defaultValue: 'Edit' })}
            >
              <EditIcon size={16} />
            </button>
          </div>
        )}
      </header>

      {players.length === 0 && (
        <div className="team-builder-empty-state">
          {t('startTableGame.teamEmptyHint', { defaultValue: 'No players yet. Add one to this team.' })}
        </div>
      )}

      <div className="team-player-list">
        {players.map((player, index) => (
          <article key={player.id} className={`team-player-card ${teamIndex === 0 ? 'team-one' : 'team-two'}`}>
            <button
              type="button"
              className="team-player-move-btn"
              onClick={() => onMovePlayer(player.id)}
              title={t('startTableGame.moveToTeam', { defaultValue: `Move to ${otherTeamLabel}`, team: otherTeamLabel })}
            >
              <Icon name="ArrowLeftRight" size={14} />
            </button>

            <div className="team-player-content">
              <input
                type="text"
                className="team-player-name-input"
                value={player.name}
                onChange={(e) => onNameChange(player.id, e.target.value)}
                onBlur={(e) => onNameBlur?.(player.id, e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder={t('startTableGame.playerPlaceholder', { n: index + 1 })}
              />
              {lookingUpPlayers.has(player.id) && (
                <span className="team-player-lookup">{t('startTableGame.lookingUpUser')}</span>
              )}
            </div>

            <button
              type="button"
              className="team-player-remove-btn"
              onClick={() => onRemovePlayer(player.id)}
              title={t('startTableGame.removePlayer')}
              aria-label={t('startTableGame.removePlayer')}
            >
              <TrashIcon size={15} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
};

const TeamBuilderSetup = ({
  players,
  onAddPlayer,
  onRemovePlayer,
  onPlayerNameChange,
  onPlayerNameBlur,
  onMovePlayerToOtherTeam,
  onRandomize,
  onAddFriends,
  maxPlayers,
  lookingUpPlayers,
  teamNames,
  onTeamNameChange,
}) => {
  const { t } = useTranslation();

  const teams = useMemo(() => {
    const teamOne = players.filter((p) => (p.teamIndex ?? 0) === 0);
    const teamTwo = players.filter((p) => (p.teamIndex ?? 0) === 1);
    return [teamOne, teamTwo];
  }, [players]);

  return (
    <div className="team-builder-setup" aria-label={t('startTableGame.teamAssignment')}>
      <div className="team-builder-grid">
        <TeamSection
          teamIndex={0}
          title={teamNames.teamOne}
          otherTeamLabel={teamNames.teamTwo || t('startTableGame.teamTwo')}
          onTeamNameChange={(value) => onTeamNameChange('teamOne', value)}
          players={teams[0]}
          onNameChange={onPlayerNameChange}
          onNameBlur={onPlayerNameBlur}
          onRemovePlayer={onRemovePlayer}
          onMovePlayer={onMovePlayerToOtherTeam}
          lookingUpPlayers={lookingUpPlayers}
        />

        <TeamSection
          teamIndex={1}
          title={teamNames.teamTwo}
          otherTeamLabel={teamNames.teamOne || t('startTableGame.teamOne')}
          onTeamNameChange={(value) => onTeamNameChange('teamTwo', value)}
          players={teams[1]}
          onNameChange={onPlayerNameChange}
          onNameBlur={onPlayerNameBlur}
          onRemovePlayer={onRemovePlayer}
          onMovePlayer={onMovePlayerToOtherTeam}
          lookingUpPlayers={lookingUpPlayers}
        />
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
          onClick={() => onAddPlayer()}
          disabled={players.length >= maxPlayers}
          title={t('startTableGame.addPlayer')}
          aria-label={t('startTableGame.addPlayer')}
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

export default TeamBuilderSetup;
