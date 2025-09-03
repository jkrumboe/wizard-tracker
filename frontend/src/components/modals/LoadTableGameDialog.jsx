import React, { useState, useEffect } from 'react';
import { PlayIcon, TrashIcon, CalendarIcon, UsersIcon, XIcon } from '@/components/ui/Icon';
import { LocalTableGameStorage } from '@/shared/api';

const LoadTableGameDialog = ({ 
  isOpen, 
  onClose, 
  onLoadGame, 
  onDeleteGame
}) => {
  const [savedGames, setSavedGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState(null);

  useEffect(() => {
    const loadSavedGames = async () => {
      setLoading(true);
      try {
        const games = LocalTableGameStorage.getSavedTableGamesList();
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
  }, [isOpen]);

  const handleLoadGame = async (gameId) => {
    setLoading(true);
    try {
      const gameData = LocalTableGameStorage.loadTableGame(gameId);
      if (gameData) {
        onLoadGame(gameData);
        onClose();
      }
    } catch (error) {
      console.error('Error loading table game:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGame = async (gameId, gameName) => {
    if (window.confirm(`Are you sure you want to delete "${gameName}"? This action cannot be undone.`)) {
      try {
        LocalTableGameStorage.deleteTableGame(gameId);
        // Refresh the list
        const games = LocalTableGameStorage.getSavedTableGamesList();
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
          <h2>Load Table Game</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <XIcon size={20} />
          </button>
        </div>

        <div className="modal-content">
          {loading ? (
            <div className="loading-indicator">Loading saved games...</div>
          ) : savedGames.length === 0 ? (
            <div className="empty-saved-games">
              <p>No saved table games found.</p>
              <p>Save a table game to see it here.</p>
            </div>
          ) : (
            <div className="saved-games-list">
              {savedGames.map(game => (
                <div 
                  key={game.id} 
                  className={`saved-game-item ${selectedGameId === game.id ? 'selected' : ''}`}
                  onClick={() => setSelectedGameId(game.id)}
                >
                  <div className="saved-game-info">
                    <div className="saved-game-name">{game.name}</div>
                    <div className="saved-game-details">
                      <span className="game-detail">
                        <UsersIcon size={14} />
                        {game.playerCount} players
                      </span>
                      <span className="game-detail">
                        <CalendarIcon size={14} />
                        {formatDate(game.lastPlayed)}
                      </span>
                      <span className="game-detail">
                        Rounds: {game.totalRounds}
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
                      title="Load Game"
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
                        title="Delete Game"
                      >
                        <TrashIcon size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedGameId && (
            <div className="selected-actions" style={{ marginTop: '1rem' }}>
              <button
                onClick={() => handleLoadGame(selectedGameId)}
                className="dialog-btn primary"
                disabled={loading}
                style={{ width: '100%' }}
              >
                <PlayIcon size={16} style={{ marginRight: '8px' }} />
                Load Selected Game
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
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoadTableGameDialog;
