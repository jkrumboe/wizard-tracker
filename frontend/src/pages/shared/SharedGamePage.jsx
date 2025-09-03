import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSharedGameData, importSharedGame } from '@/shared/api/sharedGameService';
import { LocalGameStorage } from '@/shared/api/localGameStorage';
import LoadingScreen from '@/components/common/AppLoadingScreen';
import { UserIcon, CalendarIcon, TrophyIcon, ShareIcon } from '@/components/ui/Icon';
import '@/styles/pages/shared-game.css';

const SharedGamePage = () => {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sharedGameInfo, setSharedGameInfo] = useState(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [alreadyImported, setAlreadyImported] = useState(false);

  useEffect(() => {
    const loadSharedGame = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!shareId) {
          throw new Error('Invalid share link - no game ID found');
        }

        console.debug('Loading shared game with ID:', shareId);

        // Try to get the game data directly using the game ID from URL
        const gameData = await getSharedGameData(shareId);
        
        if (!gameData) {
          throw new Error('Shared game not found - it may have been deleted');
        }

        // Extract players from the correct location
        const players = gameData.players || gameData.gameState?.players || [];

        // Create mock shared game info from the actual game data
        const mockSharedInfo = {
          shareId: shareId,
          originalGameId: shareId, // Use the direct game ID
          title: `Wizard Game - ${players.find(p => p.id === gameData.winner_id)?.name || 'Unknown'} wins!`,
          playerNames: players.map(p => p.name).join(', ') || '',
          winnerName: players.find(p => p.id === gameData.winner_id)?.name || 'Unknown',
          finalScore: gameData.final_scores?.[gameData.winner_id] || 0,
          totalRounds: gameData.total_rounds || 0,
          createdAt: gameData.created_at || new Date().toISOString(),
          gameData: gameData
        };

        // Check if this game is already imported
        const existingGames = LocalGameStorage.getAllSavedGames();
        const isAlreadyImported = Object.values(existingGames).some(game => {
          return game.originalGameId === shareId || 
                 game.gameState?.originalGameId === shareId ||
                 game.cloudGameId === shareId;
        });
        
        setAlreadyImported(isAlreadyImported);
        setSharedGameInfo(mockSharedInfo);
      } catch (error) {
        console.error('Failed to load shared game:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadSharedGame();
  }, [shareId]);

  const handleImportGame = async () => {
    try {
      setImporting(true);
      setError(null);

      // Use the game data that's already loaded
      const gameData = sharedGameInfo.gameData;
      
      if (!gameData) {
        throw new Error('Game data not found');
      }

      // Import the game into local storage, passing shareId for proper syncing
      const shareInfoWithId = {
        ...sharedGameInfo,
        shareId: shareId // Pass the shareId for marking as synced
      };
      const newGameId = await importSharedGame(gameData, shareInfoWithId);
      
      setImported(true);
      
      // Redirect to settings page after a short delay
      setTimeout(() => {
        navigate('/settings', { 
          state: { 
            message: 'Shared game imported successfully!',
            importedGameId: newGameId
          }
        });
      }, 2000);

    } catch (error) {
      console.error('Failed to import shared game:', error);
      setError(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="shared-game-page">
        <div className="shared-game-container">
          <div className="shared-game-error">
            <h2>Unable to Load Shared Game</h2>
            <p>{error}</p>
            <button 
              className="btn-primary"
              onClick={() => navigate('/')}
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (imported) {
    return (
      <div className="shared-game-page">
        <div className="shared-game-container">
          <div className="shared-game-success">
            {/* <TrophyIcon size={48} /> */}
            <h1>Game Imported Successfully!</h1>
            <p>The shared game has been added to your collection.</p>
            <p>Redirecting to your games...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shared-game-page">
      <div className="shared-game-container">
        {/* <div className="shared-game-header">
          <ShareIcon size={32} />
          <h1>Shared Wizard Game</h1>
        </div> */}

        {sharedGameInfo && (
          <div className="shared-game-info">
            <div className="game-summary">
              <h2>{sharedGameInfo.title}</h2>

              <div className="shared-game-details">
                <div className="detail-item">
                  <TrophyIcon size={20} style={{ color: 'var(--warning-color)' }} />
                  <span>{sharedGameInfo.winnerName} with</span>
                  <span className="score">{sharedGameInfo.finalScore} points</span>
                </div>
                
                <div className="detail-item">
                </div>
                
                <div className="detail-item">
                  <UserIcon size={20} />
                  <span>{sharedGameInfo.playerNames}</span>
                </div>
                
                <div className="detail-item">
                  <span>Rounds: {sharedGameInfo.totalRounds}</span>
                </div>
                
                {/* <div className="detail-item">
                  <CalendarIcon size={20} />
                  <span>Shared: {formatDate(sharedGameInfo.createdAt)}</span>
                </div> */}
              </div>
            </div>

            <div className="import-section">              
              <div className="import-actions">
                {alreadyImported ? (
                  <>
                    <div className="already-imported-message">
                      <p>✅ You already have this game in your collection!</p>
                    </div>
                    <button 
                      className="btn-secondary"
                      onClick={() => navigate('/settings')}
                    >
                      View My Games
                    </button>
                  </>
                ) : (
                  <button 
                    className="btn-primary import-btn"
                    onClick={handleImportGame}
                    disabled={importing}
                  >
                    {importing ? 'Importing...' : 'Import Game'}
                  </button>
                )}
                
                <button 
                  className="btn-secondary"
                  onClick={() => navigate('/')}
                >
                  Go to Home
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedGamePage;
