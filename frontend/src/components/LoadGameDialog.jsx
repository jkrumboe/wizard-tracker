import React, { useState, useEffect } from 'react';
import { PlayIcon, TrashIcon, CalendarIcon, UsersIcon, XIcon } from './Icon';

const LoadGameDialog = ({ 
  isOpen, 
  onClose, 
  onLoadGame, 
  onDeleteGame,
  getSavedGames 
}) => {
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
        alert(`Error loading game: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGame = async (gameId, gameName) => {
    if (window.confirm(`Are you sure you want to delete "${gameName}"?`)) {
      try {
        const result = await onDeleteGame(gameId);
        if (result.success) {
          setSavedGames(savedGames.filter(game => game.id !== gameId));
        } else {
          alert(`Error deleting game: ${result.error}`);
        }
      } catch (error) {
        alert(`Error: ${error.message}`);
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
          <h2>Load Saved Game</h2>
          <button onClick={onClose} className="dialog-close-btn" disabled={loading}>
            <XIcon size={16} />
          </button>
        </div>

        <div className="dialog-content">
          <div className="saved-games-list">
            {loading ? (
              <div className="loading-container">
                <p>Loading saved games...</p>
              </div>
            ) : savedGames.length === 0 ? (
              <div className="empty-saved-games">
                <p>No saved games found</p>
                <p>Start a new game and save it to see it here</p>
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
                      {game.name || `Game with ${game.players.map(p => p.name).join(', ')}`}
                    </div>
                    <div className="saved-game-details">
                      <UsersIcon size={14} style={{ marginRight: '4px', display: 'inline' }} />
                      {game.players.length} players • Round {game.currentRound}/{game.totalRounds}
                      <br />
                      <CalendarIcon size={14} style={{ marginRight: '4px', display: 'inline' }} />
                      Last played: {formatDate(game.lastPlayed)}
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
                      <PlayIcon size={16} />
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoadGameDialog;
