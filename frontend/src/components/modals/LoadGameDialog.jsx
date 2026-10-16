import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PlayIcon, CalendarIcon, UsersIcon, XIcon } from '@/components/ui/Icon';
import DeleteIconButton from '@/components/ui/DeleteIconButton';
import DeleteConfirmationModal from '@/components/modals/DeleteConfirmationModal';
import { useModalDismiss } from '@/shared/hooks/useModalDismiss';
import '@/styles/components/modal.css';

const LoadGameDialog = ({
  isOpen,
  onClose,
  onLoadGame,
  onDeleteGame,
  getSavedGames
}) => {
  const { t } = useTranslation();
  const [savedGames, setSavedGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [gameToDelete, setGameToDelete] = useState(null);
  const [error, setError] = useState('');
  const backdrop = useModalDismiss(isOpen, onClose, { disabled: loading });

  useEffect(() => {
    const loadSavedGames = async () => {
      setLoading(true);
      try {
        const games = await getSavedGames();
        setSavedGames(games);
      } catch (error) {
        console.error('Error loading saved games:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      setError('');
      loadSavedGames();
    }
  }, [isOpen, getSavedGames]);

  const handleLoadGame = async (gameId) => {
    setLoading(true);
    setError('');
    try {
      const result = await onLoadGame(gameId);
      if (result.success) {
        onClose();
      } else {
        setError(t('loadGameDialog.loadError', { error: result.error }));
      }
    } catch (error) {
      setError(t('loadGameDialog.genericError', { message: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteGame = async () => {
    const game = gameToDelete;
    setGameToDelete(null);
    setError('');
    try {
      const result = await onDeleteGame(game.id);
      if (result.success) {
        setSavedGames(prev => prev.filter(g => g.id !== game.id));
        if (selectedGameId === game.id) setSelectedGameId(null);
      } else {
        setError(t('loadGameDialog.deleteError', { error: result.error }));
      }
    } catch (error) {
      setError(t('loadGameDialog.genericError', { message: error.message }));
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" {...backdrop}>
        <div
          className="modal-container"
          role="dialog"
          aria-modal="true"
          aria-labelledby="load-game-title"
        >
          <div className="modal-header">
            <h2 id="load-game-title">{t('loadGameDialog.title')}</h2>
            <button onClick={onClose} className="close-btn" disabled={loading} aria-label={t('common.close')}>
              <XIcon size={20} />
            </button>
          </div>

          <div className="modal-content">
            {error && <div className="modal-error" role="alert">{error}</div>}
            <div className="saved-games-list">
              {loading ? (
                <div className="loading-container">
                  <p>{t('loadGameDialog.loadingSavedGames')}</p>
                </div>
              ) : savedGames.length === 0 ? (
                <div className="empty-saved-games">
                  <p>{t('loadGameDialog.noSavedGames')}</p>
                  <p>{t('loadGameDialog.noSavedGamesHint')}</p>
                </div>
              ) : (
                savedGames.map((game) => (
                  <div
                    key={game.id}
                    className={`saved-game-item ${selectedGameId === game.id ? 'selected' : ''}`}
                    onClick={() => setSelectedGameId(game.id)}
                  >
                    <div className="saved-game-info">
                      <div className="saved-game-name">
                        {game.name || t('loadGameDialog.gameWithPlayers', { players: Array.isArray(game.players) ? game.players.join(', ') : 'Unknown Players' })}
                      </div>
                      <div className="saved-game-details">
                        <UsersIcon size={14} style={{ marginRight: '4px', display: 'inline' }} />
                        {t('loadGameDialog.playerCount', { count: game.playerCount || (game.players ? game.players.length : 0) })} - {t('loadGameDialog.roundProgress', { current: (game.roundsCompleted || 0) + 1, total: game.totalRounds })}
                        <br />
                        <CalendarIcon size={14} style={{ marginRight: '4px', display: 'inline' }} />
                        {t('loadGameDialog.lastPlayed', { date: formatDate(game.lastPlayed) })}
                      </div>
                    </div>
                    <div className="saved-game-actions">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoadGame(game.id);
                        }}
                        className="icon-btn"
                        disabled={loading}
                        title={t('loadGameDialog.loadGame')}
                        aria-label={t('loadGameDialog.loadGame')}
                      >
                        <PlayIcon size={26} />
                      </button>
                      {onDeleteGame && (
                        <DeleteIconButton
                          label={t('loadGameDialog.deleteGame')}
                          onClick={(e) => {
                            e.stopPropagation();
                            setGameToDelete(game);
                          }}
                          disabled={loading}
                        />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button
              onClick={onClose}
              className="modal-button secondary"
              disabled={loading}
            >
              {t('loadGameDialog.close')}
            </button>
            <button
              onClick={() => handleLoadGame(selectedGameId)}
              className="modal-button primary"
              disabled={loading || !selectedGameId}
            >
              {t('loadGameDialog.loadSelectedGame')}
            </button>
          </div>
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={Boolean(gameToDelete)}
        onClose={() => setGameToDelete(null)}
        onConfirm={confirmDeleteGame}
        title={t('loadGameDialog.deleteGame')}
        message={gameToDelete ? t('loadGameDialog.deleteConfirm', { name: gameToDelete.name }) : ''}
      />
    </>
  );
};

export default LoadGameDialog;
