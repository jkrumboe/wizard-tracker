import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Icon, { TrashIcon, DiceIcon, UsersIcon } from '@/components/ui/Icon';

const TeamSection = ({
  teamIndex,
  title,
  players,
  onNameChange,
  onNameBlur,
  onRemovePlayer,
  onMovePlayer,
  lookingUpPlayers,
}) => {
  const { t } = useTranslation();
  const otherTeamLabel = teamIndex === 0 ? t('startTableGame.teamTwo') : t('startTableGame.teamOne');

  return (
    <section className={`team-builder-panel ${teamIndex === 0 ? 'team-one' : 'team-two'}`}>
      <header className="team-builder-panel-header">
        <div>
          <h3>{title}</h3>
        </div>
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
