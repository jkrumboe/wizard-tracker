import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon, { PlayIcon, TrashIcon, UsersIcon } from '@/components/ui/Icon';
import BackButton from '@/components/ui/BackButton';
import GameHistoryItem from '@/components/game/GameHistoryItem';
import DeleteConfirmationModal from '@/components/modals/DeleteConfirmationModal';
import { LocalGameStorage } from '@/shared/api/localGameStorage';
import { LocalTableGameStorage } from '@/shared/api/localTableGameStorage';
import { LocalScoreboardGameStorage } from '@/shared/api/localScoreboardGameStorage';
import { useGameTemplates } from '@/shared/hooks/useGameTemplates';
import { useGameHistory } from '@/shared/hooks/useGameHistory';
import { useGameStateContext } from '@/shared/hooks/useGameState';
import { getResumableGames } from '@/shared/utils/resumableGames';
import { gameBelongsToTemplate } from '@/shared/utils/templateGames';
import '@/styles/pages/gamesPage.css';
import '@/styles/pages/gameType.css';

const normalize = (name) => (name || '').trim().toLowerCase();

const deletePausedGame = (game) => {
  if (game.type === 'wizard') LocalGameStorage.deleteGame(game.id);
  else if (game.type === 'scoreboard') LocalScoreboardGameStorage.deleteTableGame(game.id);
  else LocalTableGameStorage.deleteTableGame(game.id);
};

/**
 * One game type: start a new game, continue paused ones and browse its history.
 */
const GameTypePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { name } = useParams();
  const { templates, loading: templatesLoading } = useGameTemplates();
  const { games, loading: gamesLoading, syncStatuses } = useGameHistory();
  const { gameState, resumeGame } = useGameStateContext();
  const [resumeError, setResumeError] = useState('');
  const [gameToDelete, setGameToDelete] = useState(null);
  // Bumped after deleting so the paused list is read from storage again
  const [pausedVersion, setPausedVersion] = useState(0);

  const template = useMemo(
    () => templates.find((tpl) => normalize(tpl.name) === normalize(name)) || null,
    [templates, name],
  );

  const pausedGames = useMemo(
    () => (template ? getResumableGames({ limit: null }).filter((game) => gameBelongsToTemplate(game, template)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template, pausedVersion],
  );

  const handleConfirmDelete = () => {
    deletePausedGame(gameToDelete);
    setGameToDelete(null);
    setPausedVersion((version) => version + 1);
  };

  const finishedGames = useMemo(
    () => (template ? games.filter((game) => gameBelongsToTemplate(game, template)) : []),
    [games, template],
  );

  const infoPath = `/game-types/${encodeURIComponent(template?.name || name)}/info`;


  const handleResume = (game) => {
    setResumeError('');
    if (game.type !== 'wizard') {
      navigate(game.route);
      return;
    }

    // The game currently in memory needs no reload from storage
    const isActiveGame = gameState.gameStarted && !gameState.gameFinished && gameState.gameId === game.id;
    if (isActiveGame || resumeGame(game.id)?.success) {
      navigate('/game/current');
      return;
    }
    setResumeError(t('gameHistory.resumeFailedCorrupted', {
      defaultValue: 'Could not resume this paused game. The save appears to be corrupted.'
    }));
  };

  if (!template) {
    return (
      <div className="game-type-page">
        <header className="game-type-header">
          <BackButton fallback="/start" />
          <h1 className="games-title game-type-title">{name}</h1>
        </header>
        <p className="empty-message">
          {templatesLoading ? t('common.loading') : t('gameType.notFound', { name })}
        </p>
        {!templatesLoading && <Link className="game-type-pill" to="/start">{t('gameType.allGames')}</Link>}
      </div>
    );
  }

  return (
    <div className="game-type-page">
      <header className="game-type-header">
        <BackButton fallback="/start" />
        <h1 className="games-title game-type-title">{template.name}</h1>
        <Link to={infoPath} state={{ fromGamePage: true }} className="games-quick-link" aria-label={t('gameType.info')} title={t('gameType.info')}>
          <Icon name="Info" size={18} strokeWidth={2} aria-hidden="true" />
          <span className="games-quick-link-label">{t('gameType.info')}</span>
        </Link>
      </header>

      <Link to={`/start?template=${encodeURIComponent(template.name)}`} className="game-type-start">
        <PlayIcon size={20} />
        <span>{t('gameType.startNewGame')}</span>
      </Link>

      {resumeError && <p className="error-message" role="alert">{resumeError}</p>}

      {pausedGames.length > 0 && (
        <section className="game-type-section" aria-label={t('gameType.continue')}>
          <span className="games-section-label">{t('gameType.continue')}</span>
          <div className="game-type-paused-list">
            {pausedGames.map((game) => (
              <div key={game.id} className="game-type-paused">
                <button type="button" className="game-type-paused-main" onClick={() => handleResume(game)}>
                  <span className="game-type-paused-info">
                    <span className="game-type-paused-players">
                      <UsersIcon size={14} aria-hidden="true" />
                      {game.players.join(', ') || t('common.noPlayers')}
                    </span>
                    {game.currentRound && game.maxRounds && (
                      <span className="game-type-paused-meta">
                        {t('home.activeGameProgress', { current: game.currentRound, max: game.maxRounds })}
                      </span>
                    )}
                  </span>
                  <span className="game-type-paused-action">
                    <PlayIcon size={16} aria-hidden="true" />
                    {t('home.continueGame')}
                  </span>
                </button>
                <button
                  type="button"
                  className="game-type-paused-delete"
                  onClick={() => setGameToDelete(game)}
                  aria-label={t('common.delete')}
                  title={t('common.delete')}
                >
                  <TrashIcon size={18} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="game-type-section game-type-history" aria-label={t('gameType.history')}>
        <div className="games-list-header">
          <span className="games-section-label">{t('gameType.history')}</span>
          <span className="games-list-count">{t('account.gamesCount', { count: finishedGames.length })}</span>
        </div>
        {finishedGames.length > 0 ? (
          <div className="game-history">
            {finishedGames.map((game) => (
              <GameHistoryItem
                findTemplate={() => template}
                key={game.id}
                game={{
                  ...game,
                  isUploaded: game.gameType === 'table'
                    ? game.isUploaded
                    : syncStatuses[game.id]?.synced || game.isUploaded,
                }}
              />
            ))}
          </div>
        ) : (
          <p className="empty-message">
            {gamesLoading ? t('home.loadingGames') : t('gameType.noGamesYet')}
          </p>
        )}
      </section>

      <DeleteConfirmationModal
        isOpen={Boolean(gameToDelete)}
        onClose={() => setGameToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default GameTypePage;
