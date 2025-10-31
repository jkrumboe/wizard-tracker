import { useState, useEffect } from 'react';
import { XIcon } from '@/components/ui/Icon';
import '@/styles/components/modal.css';

const CloudGameSelectModal = ({ isOpen, onClose, onDownload }) => {
  const [cloudGames, setCloudGames] = useState([]);
  const [selectedGames, setSelectedGames] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadCloudGames();
    }
  }, [isOpen]);

  const loadCloudGames = async () => {
    setLoading(true);
    setError(null);
    try {
      const { getUserCloudGamesList } = await import('@/shared/api/gameService');
      const games = await getUserCloudGamesList();
      setCloudGames(games);
    } catch (err) {
      setError(err.message);
      console.error('Error loading cloud games:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleGameSelection = (cloudId) => {
    const newSelected = new Set(selectedGames);
    if (newSelected.has(cloudId)) {
      newSelected.delete(cloudId);
    } else {
      newSelected.add(cloudId);
    }
    setSelectedGames(newSelected);
  };

  const selectAll = () => {
    const notLocalGames = cloudGames.filter(g => !g.existsLocally);
    setSelectedGames(new Set(notLocalGames.map(g => g.cloudId)));
  };

  const deselectAll = () => {
    setSelectedGames(new Set());
  };

  const handleDownload = () => {
    if (selectedGames.size > 0) {
      onDownload(Array.from(selectedGames));
      onClose();
    }
  };

  const getWinnerName = (game) => {
    const winner = game.players?.find(p => p.id === game.winner_id);
    return winner?.name || 'Unknown';
  };

  const getWinnerScore = (game) => {
    return game.final_scores?.[game.winner_id] || 0;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container cloud-game-select-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <h2>
            Download Cloud Games
          </h2>
          <button className="close-btn" onClick={onClose}>
            <XIcon size={20} />
          </button>
        </div>

        <div className="modal-content">
          {loading && (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              <div style={{ 
                border: '3px solid var(--border-color)', 
                borderTopColor: 'var(--primary-color)', 
                borderRadius: '50%', 
                width: '40px', 
                height: '40px', 
                animation: 'spin 1s linear infinite',
                margin: '0 auto var(--spacing-md)'
              }}></div>
              <p>Loading cloud games...</p>
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              <p style={{ color: 'var(--error-color)', marginBottom: 'var(--spacing-md)' }}>Error: {error}</p>
              <button className="modal-button primary" onClick={loadCloudGames}>Retry</button>
            </div>
          )}

          {!loading && !error && cloudGames.length === 0 && (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              <p>No cloud games found</p>
            </div>
          )}

          {!loading && !error && cloudGames.length > 0 && (
            <>
              <div style={{ 
                display: 'flex', 
                gap: 'var(--spacing-sm)', 
                alignItems: 'center', 
                marginBottom: 'var(--spacing-md)',
                paddingBottom: 'var(--spacing-sm)',
                borderBottom: '1px solid var(--border-color)'
              }}>
                <button 
                  onClick={selectAll} 
                  className="modal-button secondary"
                  style={{ width: 'auto', padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '0.9rem' }}
                >
                  Select All New
                </button>
                <button 
                  onClick={deselectAll} 
                  className="modal-button secondary"
                  style={{ width: 'auto', padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '0.9rem' }}
                >
                  Deselect All
                </button>
                <span style={{ marginLeft: 'auto', fontWeight: '500', color: 'var(--primary-color)' }}>
                  {selectedGames.size} selected
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {cloudGames.map((game) => (
                  <div
                    key={game.cloudId}
                    className={`player-selection-item ${selectedGames.has(game.cloudId) ? 'selected' : ''}`}
                    onClick={() => !game.existsLocally && toggleGameSelection(game.cloudId)}
                    style={{ 
                      cursor: game.existsLocally ? 'not-allowed' : 'pointer',
                      opacity: game.existsLocally ? 0.6 : 1
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', minWidth: '24px' }}>
                      {game.existsLocally ? (
                        <span style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'var(--success-color)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 'bold'
                        }} title="Already exists locally">
                          ✓
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={selectedGames.has(game.cloudId)}
                          onChange={() => toggleGameSelection(game.cloudId)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                      )}
                    </div>

                    <div className="player-info" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                      <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                        {game.isPaused ? (
                          <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: 'var(--radius-sm)', 
                            fontSize: '0.75rem', 
                            fontWeight: '600',
                            background: 'var(--warning-color)',
                            color: 'white'
                          }}>PAUSED</span>
                        ) : game.gameFinished ? (
                          <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: 'var(--radius-sm)', 
                            fontSize: '0.75rem', 
                            fontWeight: '600',
                            background: 'var(--success-color)',
                            color: 'white'
                          }}>FINISHED</span>
                        ) : (
                          <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: 'var(--radius-sm)', 
                            fontSize: '0.75rem', 
                            fontWeight: '600',
                            background: 'var(--info-color)',
                            color: 'white'
                          }}>IN PROGRESS</span>
                        )}
                      </div>

                      <div className="player-name">
                        Players: {game.players.map(p => p.name).join(', ')}
                      </div>
                      
                      {game.gameFinished && (
                        <div className="player-score">
                          Winner: {getWinnerName(game)} ({getWinnerScore(game)} pts)
                        </div>
                      )}
                      
                      <div className="player-score">
                        Rounds: {game.total_rounds} | Date: {new Date(game.created_at).toLocaleDateString()}
                        {game.existsLocally && ' | Already Downloaded'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="modal-actions">
            <button className="modal-button secondary" onClick={onClose}>
                Cancel
            </button>
            <button
                className="modal-button primary"
                onClick={handleDownload}
                disabled={selectedGames.size === 0}
                style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: 'var(--spacing-xs)',
                opacity: selectedGames.size === 0 ? 0.5 : 1,
                cursor: selectedGames.size === 0 ? 'not-allowed' : 'pointer'
                }}
            >
                Download 
            </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CloudGameSelectModal;
