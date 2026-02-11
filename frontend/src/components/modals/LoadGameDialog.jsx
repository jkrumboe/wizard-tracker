import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PlayIcon, TrashIcon, CalendarIcon, UsersIcon, XIcon } from '@/components/ui/Icon';

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
      loadSavedGames();
    }
  }, [isOpen, getSavedGames]);

  const handleLoadGame = async (gameId) => {
    setLoading(true);
    try {
      const result = await onLoadGame(gameId);
      if (result.success) {
        onClose();
      } else {
        alert(t('loadGameDialog.loadError', { error: result.error }));
      }
    } catch (error) {
      alert(t('loadGameDialog.genericError', { message: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGame = async (gameId, gameName) => {
    if (globalThis.confirm(t('loadGameDialog.deleteConfirm', { name: gameName }))) {
      try {
        const result = await onDeleteGame(gameId);
        if (result.success) {
          setSavedGames(savedGames.filter(game => game.id !== gameId));
        } else {
          alert(t('loadGameDialog.deleteError', { error: result.error }));
        }
      } catch (error) {
        alert(t('loadGameDialog.genericError', { message: error.message }));
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog-modal">
        <div className="dialog-header">
          <h2>{t('loadGameDialog.title')}</h2>
          <button onClick={onClose} className="dialog-close-btn" disabled={loading}>
            <XIcon size={16} />
          </button>
        </div>

        <div className="dialog-content">
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
                      {t('loadGameDialog.playerCount', { count: game.playerCount || (game.players ? game.players.length : 0) })} • {t('loadGameDialog.roundProgress', { current: (game.roundsCompleted || 0) + 1, total: game.totalRounds })}
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
                    >
                      <PlayIcon size={26} />
                    </button>
                    {onDeleteGame && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGame(game.id, game.name);
                        }}
                        className="icon-btn danger"
                        disabled={loading}
                        title={t('loadGameDialog.deleteGame')}
                      >
                        <TrashIcon size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedGameId && (
            <div className="selected-actions" style={{ marginTop: '1rem' }}>
              <button
                onClick={() => handleLoadGame(selectedGameId)}
                className="dialog-btn primary"
                disabled={loading}
                style={{ width: '100%' }}
              >
                <PlayIcon size={16} style={{ marginRight: '8px' }} />
                {t('loadGameDialog.loadSelectedGame')}
              </button>
            </div>
          )}
        </div>

        <div className="dialog-actions">
          <button
            onClick={onClose}
            className="dialog-btn secondary"
            disabled={loading}
          >
            {t('loadGameDialog.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoadGameDialog;
