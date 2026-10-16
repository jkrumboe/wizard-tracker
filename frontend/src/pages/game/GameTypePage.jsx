import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon, { PauseIcon, PlayIcon, TrashIcon, UsersIcon, XIcon } from '@/components/ui/Icon';
import BackButton from '@/components/ui/BackButton';
import GameHistoryItem from '@/components/game/GameHistoryItem';
import EditionSwitcher from '@/components/game/EditionSwitcher';
import AddEditionModal from '@/components/modals/AddEditionModal';
import DeleteConfirmationModal from '@/components/modals/DeleteConfirmationModal';
import { LocalGameStorage } from '@/shared/api/localGameStorage';
import { LocalTableGameStorage } from '@/shared/api/localTableGameStorage';
import { LocalScoreboardGameStorage } from '@/shared/api/localScoreboardGameStorage';
import { useGameTemplates } from '@/shared/hooks/useGameTemplates';
import { useGameHistory } from '@/shared/hooks/useGameHistory';
import { useGameStateContext } from '@/shared/hooks/useGameState';
import { getResumableGames } from '@/shared/utils/resumableGames';
import { gameBelongsToTemplate } from '@/shared/utils/templateGames';
import { useModalDismiss } from '@/shared/hooks/useModalDismiss';
import { getTemplateEditions, getPreferredEdition, findEdition, rememberEdition } from '@/shared/utils/gameEditions';
import '@/styles/components/modal.css';
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
  // Paused games open in a modal so the played games keep the room on the page
  const [showPaused, setShowPaused] = useState(false);
  // Edition picked on this page; until then the last one played
  const [editionId, setEditionId] = useState(null);
  // Adding the first edition of a game that has none yet
  const [addingEdition, setAddingEdition] = useState(false);

  const template = useMemo(
    () => templates.find((tpl) => normalize(tpl.name) === normalize(name)) || null,
    [templates, name],
  );
  // An edition saved as its own game ("Wizard: Jubiläumsedition") lives on its main game's page
  const editionOf = useMemo(
    () => (template ? null : templates.find((tpl) => (tpl.editionSources || [])
      .some((source) => normalize(source.name) === normalize(name))) || null),
    [templates, template, name],
  );

  const pausedGames = useMemo(
    () => (template ? getResumableGames({ limit: null }).filter((game) => gameBelongsToTemplate(game, template)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template, pausedVersion],
  );

  const closePaused = () => setShowPaused(false);
  // The delete confirmation sits on top and handles Escape itself
  useModalDismiss(showPaused && pausedGames.length > 0 && !gameToDelete, closePaused);

  const handleConfirmDelete = () => {
    deletePausedGame(gameToDelete);
    setGameToDelete(null);
    setPausedVersion((version) => version + 1);
  };

  const finishedGames = useMemo(
    () => (template ? games.filter((game) => gameBelongsToTemplate(game, template)) : []),
    [games, template],
  );

  // Read on every render: adding an edition only changes storage
  const editions = template ? getTemplateEditions(template) : [];
  const edition = findEdition(editions, editionId) || (template ? getPreferredEdition(template) : null);
  const editionQuery = edition ? `edition=${encodeURIComponent(edition.id)}` : '';

  const handleSelectEdition = (selected) => {
    setEditionId(selected.id);
    rememberEdition(template.name, selected.id);
  };

  const infoPath = `/game-types/${encodeURIComponent(template?.name || name)}/info${editionQuery ? `?${editionQuery}` : ''}`;


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

  if (editionOf) {
    return <Navigate to={`/game-types/${encodeURIComponent(editionOf.name)}`} replace />;
  }

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
    <div className="game-type-page game-type-main-page">
      <header className="game-type-header">
        <BackButton fallback="/start" />
        <h1 className="games-title game-type-title">{template.name}</h1>
        <Link to={infoPath} state={{ fromGamePage: true }} className="games-quick-link" aria-label={t('gameType.info')} title={t('gameType.info')}>
          <Icon name="Info" size={18} strokeWidth={2} aria-hidden="true" />
          <span className="games-quick-link-label">{t('gameType.info')}</span>
        </Link>
      </header>

      <AddEditionModal
        isOpen={addingEdition}
        templateName={template.name}
        onClose={() => setAddingEdition(false)}
        onAdded={(id) => handleSelectEdition({ id })}
      />

      {/* Where the edition selector goes once the game has editions; it adds more itself */}
      {editions.length === 0 && (
        <section className="edition-switcher" aria-label={t('editions.sectionLabel')}>
          <span className="games-section-label">{t('editions.sectionLabel')}</span>
          <button type="button" className="edition-add-first" onClick={() => setAddingEdition(true)}>
            <span className="edition-add-first-icon" aria-hidden="true">
              <Icon name="PackagePlus" size={20} strokeWidth={2} />
            </span>
            <span className="edition-add-first-text">
              <span className="edition-add-first-title">{t('editions.addEditionOf', { game: template.name })}</span>
              <span className="edition-add-first-hint">{t('editions.addFirstHint')}</span>
            </span>
          </button>
        </section>
      )}

      {editions.length > 0 && (
        <EditionSwitcher
          template={template}
          editions={editions}
          value={edition?.id ?? null}
          onChange={handleSelectEdition}
          onAdded={(id) => handleSelectEdition({ id })}
        />
      )}

      <div className="game-type-actions">
        <Link
          to={`/start?template=${encodeURIComponent(template.name)}${editionQuery ? `&${editionQuery}` : ''}`}
          className="game-type-start"
        >
          <PlayIcon size={20} />
          <span>{t('gameType.startNewGame')}</span>
        </Link>
        {pausedGames.length > 0 && (
          <button
            type="button"
            className="game-type-continue"
            onClick={() => setShowPaused(true)}
            aria-haspopup="dialog"
          >
            <PauseIcon size={18} aria-hidden="true" />
            <span>{t('gameType.continue')}</span>
            <span className="game-type-continue-count">{pausedGames.length}</span>
          </button>
        )}
      </div>

      {resumeError && <p className="error-message" role="alert">{resumeError}</p>}

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

      {showPaused && pausedGames.length > 0 && (
        <div className="modal-overlay" onClick={closePaused}>
          <div
            className="modal-container game-type-paused-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="paused-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="paused-modal-title">{t('gameType.continue')}</h2>
              <button className="close-btn" onClick={closePaused} aria-label={t('common.close')}>
                <XIcon size={20} />
              </button>
            </div>
            <div className="modal-content">
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
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={Boolean(gameToDelete)}
        onClose={() => setGameToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default GameTypePage;
