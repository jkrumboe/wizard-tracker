import { useState, useEffect } from 'react';
import { XIcon, UsersIcon } from '@/components/ui/Icon';
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
      // Load both wizard games and table games
      const { getUserCloudGamesList } = await import('@/shared/api/gameService');
      const { getUserCloudTableGamesList } = await import('@/shared/api/tableGameService');
      
      const [wizardGames, tableGames] = await Promise.all([
        getUserCloudGamesList(),
        getUserCloudTableGamesList()
      ]);
      
      // Add game type to each game
      const wizardGamesWithType = wizardGames.map(g => ({ ...g, gameType: 'Wizard' }));
      const tableGamesWithType = tableGames.map(g => ({ 
        ...g, 
        gameType: 'Table',
        // Ensure these fields are at the top level
        players: g.players || [],
        totalRounds: g.totalRounds || 0,
        gameTypeName: g.gameTypeName || g.name || 'Table Game'
      }));
      
      console.log('Table games with type:', tableGamesWithType);
      
      // Combine and filter out games that already exist locally
      const allGames = [...wizardGamesWithType, ...tableGamesWithType];
      const availableGames = allGames.filter(game => !game.existsLocally);
      
      // Sort by date (newest first)
      availableGames.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      setCloudGames(availableGames);
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
    // Select all games (already filtered to not include local games)
    setSelectedGames(new Set(cloudGames.map(g => g.cloudId)));
  };

  const deselectAll = () => {
    setSelectedGames(new Set());
  };

  const handleDownload = () => {
    if (selectedGames.size > 0) {
      // Separate wizard games from table games
      const selectedGameObjects = Array.from(selectedGames).map(id => 
        cloudGames.find(g => g.cloudId === id)
      ).filter(Boolean);
      
      const wizardGameIds = selectedGameObjects
        .filter(g => g.gameType === 'Wizard')
        .map(g => g.cloudId);
      const tableGameIds = selectedGameObjects
        .filter(g => g.gameType === 'Table')
        .map(g => g.cloudId);
      
      onDownload({ wizardGameIds, tableGameIds });
      onClose();
    }
  };

  const getWinnerName = (game) => {
    // Handle winner_id as both single value and array
    const winnerIds = Array.isArray(game.winner_id) ? game.winner_id : (game.winner_id ? [game.winner_id] : []);
    
    if (winnerIds.length === 0) return 'Unknown';
    if (winnerIds.length === 1) {
      const winner = game.players?.find(p => p.id === winnerIds[0]);
      return winner?.name || 'Unknown';
    }
    
    // Multiple winners (draw)
    const winnerNames = winnerIds.map(id => game.players?.find(p => p.id === id)?.name).filter(Boolean);
    if (winnerNames.length === 0) return 'Unknown';
    if (winnerNames.length === 2) return `${winnerNames[0]} & ${winnerNames[1]}`;
    return `${winnerNames.slice(0, -1).join(', ')} & ${winnerNames[winnerNames.length - 1]}`;
  };

  const getWinnerScore = (game) => {
    // Handle winner_id as both single value and array
    const winnerIds = Array.isArray(game.winner_id) ? game.winner_id : (game.winner_id ? [game.winner_id] : []);
    
    if (winnerIds.length === 0) return 0;
    // For draws, show the score of the first winner (they all have the same score)
    return game.final_scores?.[winnerIds[0]] || 0;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container cloud-game-select-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <h2>
            Cloud Games
          </h2>
          <button className="close-btn" onClick={onClose}>
            <XIcon size={20} />
          </button>
        </div>

        <div className="modal-content">
          {loading && (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              <div style={{ 
                border: '3px solid var(--border)', 
                borderTopColor: 'var(--primary)', 
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
            <div>
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center', 
                marginBottom: 'var(--spacing-sm)',
              }}>
                <div style={{ 
                  display: 'flex', 
                  gap: 'var(--spacing-md)', 
                  alignItems: 'center', 
                  width: '100%',
                  justifyContent: 'center',
                }}>
                  <button 
                    onClick={selectAll} 
                    className="modal-button secondary"
                    style={{ width: '100%', padding: 'var(--spacing-sm) var(--spacing-md)', fontSize: '0.9rem' }}
                  >
                    Select All New
                  </button>
                  <button 
                    onClick={deselectAll} 
                    className="modal-button secondary"
                    style={{ width: '100%', padding: 'var(--spacing-sm) var(--spacing-md)', fontSize: '0.9rem' }}
                  >
                    Deselect All
                  </button>
                </div>
                <span style={{ margin: '0 auto', fontWeight: '500', color: 'var(--primary)' }}>
                  {selectedGames.size} selected
                </span>
              </div>
                

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {cloudGames.map((game) => (
                  <div
                    key={game.cloudId}
                    className={`player-selection-item ${selectedGames.has(game.cloudId) ? 'selected' : ''}`}
                    onClick={() => toggleGameSelection(game.cloudId)}
                    style={{ 
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', minWidth: '24px' }}>
                      <input
                        type="checkbox"
                        checked={selectedGames.has(game.cloudId)}
                        onChange={() => toggleGameSelection(game.cloudId)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                    </div>

                    <div className="player-info" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                      <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ 
                          padding: '2px 8px', 
                          borderRadius: 'var(--radius-sm)', 
                          fontSize: '0.75rem', 
                          fontWeight: '600',
                          background: game.gameType === 'Wizard' ? 'var(--primary)' : 'var(--info-color)',
                          color: 'white'
                        }}>
                          {game.gameType === 'Table' ? (game.gameTypeName || 'Table Game') : game.gameType}
                        </span>
                      </div>

                      <div className="game-players">
                        {/* <UsersIcon size={12} />{" "}  */}
                        {game.players && game.players.length > 0 
                          ? game.players.map(p => typeof p === 'string' ? p : (p.name || 'Unknown')).join(', ')
                          : 'No players'}
                      </div>
                      
                      {game.gameType === 'Wizard' && game.gameFinished && (
                        <div className="player-score">
                          Winner: {getWinnerName(game)} ({getWinnerScore(game)} pts)
                        </div>
                      )}
                      
                      <div className="player-score">
                        Rounds: {game.totalRounds || game.total_rounds || 0} | Date: {new Date(game.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )} 
          </div>
        <div className="modal-actions">
            {/* <button className="modal-button secondary" onClick={onClose}>
                Cancel
            </button> */}
            <button
                className="modal-button primary"
                onClick={handleDownload}
                disabled={selectedGames.size === 0}
                style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: 'var(--spacing-xs)',
                width: '100%',
                fontSize: '1rem',
                opacity: selectedGames.size === 0 ? 0.5 : 1,
                cursor: selectedGames.size === 0 ? 'not-allowed' : 'pointer'
                }}
            >
                Download 
            </button>
          </div>
      </div>
    </div>
  );
};

export default CloudGameSelectModal;
