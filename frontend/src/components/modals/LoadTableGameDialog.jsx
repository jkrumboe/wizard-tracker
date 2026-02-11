import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PlayIcon, TrashIcon, CalendarIcon, UsersIcon, XIcon } from '@/components/ui/Icon';
import { LocalTableGameStorage } from '@/shared/api';

const LoadTableGameDialog = ({ 
  isOpen, 
  onClose, 
  onLoadGame, 
  onDeleteGame,
  filterByGameName = null // Optional filter by game name/type
}) => {
  const { t } = useTranslation();
  const [savedGames, setSavedGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState(null);

  useEffect(() => {
    const loadSavedGames = async () => {
      setLoading(true);
      try {
        let games = LocalTableGameStorage.getSavedTableGamesList();
        
        // Filter by game name if provided
        if (filterByGameName) {
          games = games.filter(game => game.name === filterByGameName);
        }
        
        setSavedGames(games);
      } catch (error) {
        console.error('Error loading saved table games:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      loadSavedGames();
    }
  }, [isOpen, filterByGameName]);

  const handleLoadGame = async (gameId) => {
    setLoading(true);
    try {
      // Get the full saved game object first to get the name
      const games = LocalTableGameStorage.getAllSavedTableGames();
      const savedGame = games[gameId];
      
      if (savedGame) {
        const gameData = LocalTableGameStorage.loadTableGame(gameId);
        if (gameData) {
          // Pass gameData with metadata from the saved game object
          // The gameFinished flag can be in either gameData or the savedGame object
          onLoadGame({ 
            ...gameData, 
            gameName: savedGame.name, 
            gameId: gameId,
            gameFinished: savedGame.gameFinished || gameData.gameFinished || false
          });
          onClose();
        }
      }
    } catch (error) {
      console.error('Error loading table game:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGame = async (gameId, gameName) => {
    if (globalThis.confirm(t('loadTableGame.deleteConfirm', { name: gameName }))) {
      try {
        LocalTableGameStorage.deleteTableGame(gameId);
        // Refresh the list with the current filter
        let games = LocalTableGameStorage.getSavedTableGamesList();
        
        // Re-apply filter if it exists
        if (filterByGameName) {
          games = games.filter(game => game.name === filterByGameName);
        }
        
        setSavedGames(games);
        if (selectedGameId === gameId) {
          setSelectedGameId(null);
        }
        if (onDeleteGame) {
          onDeleteGame(gameId);
        }
      } catch (error) {
        console.error('Error deleting table game:', error);
      }
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2>{filterByGameName ? t('loadTableGame.gamesTitle', { name: filterByGameName }) : t('loadTableGame.gamesTitle', { name: 'Table' })}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <XIcon size={20} />
          </button>
        </div>

        <div className="modal-content">
          {loading ? (
            <div className="loading-indicator">{t('loadTableGame.loadingSavedGames')}</div>
          ) : savedGames.length === 0 ? (
            <div className="empty-saved-games">
              <p>{t('loadTableGame.noSavedGames')}</p>
              <p>{t('loadTableGame.saveHint')}</p>
            </div>
          ) : (
            <div className="saved-games-list" style={{ marginBottom: "8px", background: "none" }}>
              {savedGames.map(game => (
                <div 
                  key={game.id} 
                  className={`saved-game-item ${selectedGameId === game.id ? 'selected' : ''}`}
                  onClick={() => setSelectedGameId(game.id)}
                >
                  <div className="saved-game-info">
                    <div className="saved-game-name">{game.name}</div>
                    <div className="saved-game-details">
                      {game.players && game.players.length > 0 && (
                        <span className="game-detail">
                          <UsersIcon size={14} />
                          <span>{game.players.join(', ')}</span>
                        </span>
                      )}
                      <span className="game-detail" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', gap: 'var(--spacing-lg)', width: '100%', color: 'white' }}>
                        Rounds: {game.totalRounds} 
                        <span className="game-detail">
                          <CalendarIcon size={14} />
                          {formatDate(game.lastPlayed)}
                        </span>
                      </span>
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
                      title={game.gameFinished ? t('loadTableGame.viewGame') : t('loadTableGame.resumeGame')}
                    >
                      {game.gameFinished ? t('loadTableGame.viewGame') : t('loadTableGame.resumeGame')}
                    </button>
                    {onDeleteGame && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGame(game.id, game.name);
                        }}
                        className="icon-btn danger"
                        disabled={loading}
                        title={t('loadTableGame.deleteGameTitle')}
                      >
                        <TrashIcon size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>        
      </div>
    </div>
  );
};

export default LoadTableGameDialog;
