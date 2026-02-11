import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getSharedGameData, importSharedGame } from '@/shared/api/sharedGameService';
import { LocalGameStorage } from '@/shared/api/localGameStorage';
import { useUser } from '@/shared/hooks';
import LoadingScreen from '@/components/common/AppLoadingScreen';
import { ImportGamePlayerSelectModal } from '@/components/modals';
import { UserIcon, CalendarIcon, TrophyIcon, ShareIcon } from '@/components/ui/Icon';
import '@/styles/pages/shared-game.css';

const SharedGamePage = () => {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sharedGameInfo, setSharedGameInfo] = useState(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [alreadyImported, setAlreadyImported] = useState(false);
  const [showPlayerSelectModal, setShowPlayerSelectModal] = useState(false);

  useEffect(() => {
    const loadSharedGame = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!shareId) {
          throw new Error(t('sharedGame.invalidShareLink'));
        }

        console.debug('Loading shared game with ID:', shareId);

        // Try to get the game data directly using the game ID from URL
        const gameData = await getSharedGameData(shareId);
        
        if (!gameData) {
          throw new Error(t('sharedGame.gameNotFound'));
        }

        // Extract players from the correct location
        const players = gameData.players || gameData.gameState?.players || [];
        
        // Handle winner_ids (new) and winner_id (legacy) as both single value and array
        const winnerIdRaw = gameData.winner_ids || gameData.winner_id;
        const winnerIds = Array.isArray(winnerIdRaw) ? winnerIdRaw : (winnerIdRaw ? [winnerIdRaw] : []);
        const winnerNames = winnerIds.map(id => players.find(p => p.id === id)?.name).filter(Boolean);
        const winnerDisplay = winnerNames.length === 0 ? t('common.unknown') :
                            winnerNames.length === 1 ? winnerNames[0] :
                            winnerNames.length === 2 ? `${winnerNames[0]} & ${winnerNames[1]}` :
                            `${winnerNames.slice(0, -1).join(', ')} & ${winnerNames[winnerNames.length - 1]}`;
        const finalScore = winnerIds.length > 0 ? (gameData.final_scores?.[winnerIds[0]] || 0) : 0;

        // Create mock shared game info from the actual game data
        const mockSharedInfo = {
          shareId: shareId,
          originalGameId: shareId, // Use the direct game ID
          title: t('sharedGame.gameTitle', { winner: winnerDisplay }),
          playerNames: players.map(p => p.name).join(', ') || '',
          winnerName: winnerDisplay,
          finalScore: finalScore,
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
    // Check one more time before proceeding
    if (alreadyImported) {
      setError(t('sharedGame.alreadyImportedError'));
      return;
    }
    
    // If user is logged in, show player selection modal
    if (user) {
      setShowPlayerSelectModal(true);
    } else {
      // If not logged in, import without player selection
      await performImport(null);
    }
  };

  const performImport = async (selectedPlayerId) => {
    try {
      setImporting(true);
      setError(null);

      // Double-check if already imported before proceeding
      const existingGames = LocalGameStorage.getAllSavedGames();
      const isAlreadyImported = Object.values(existingGames).some(game => {
        return game.originalGameId === shareId || 
               game.gameState?.originalGameId === shareId ||
               game.cloudGameId === shareId;
      });
      
      if (isAlreadyImported) {
        setAlreadyImported(true);
        setError(t('sharedGame.alreadyImportedError'));
        setImporting(false);
        return;
      }

      // Use the game data that's already loaded
      const gameData = sharedGameInfo.gameData;
      
      if (!gameData) {
        throw new Error(t('sharedGame.gameDataNotFound'));
      }

      // Import the game into local storage, passing shareId for proper syncing
      const shareInfoWithId = {
        ...sharedGameInfo,
        shareId: shareId, // Pass the shareId for marking as synced
        selectedPlayerId: selectedPlayerId, // Pass the selected player ID
        currentUserId: user?.id // Pass the current user ID if logged in
      };
      const newGameId = await importSharedGame(gameData, shareInfoWithId);
      
      setImported(true);
      setAlreadyImported(true); // Mark as imported to prevent further attempts
      
      // Redirect to account page after a short delay
      setTimeout(() => {
        navigate('/account', { 
          state: { 
            message: selectedPlayerId 
              ? t('sharedGame.importedAndLinked') 
              : t('sharedGame.importedSuccessfully'),
            importedGameId: newGameId
          }
        });
      }, 2000);

    } catch (error) {
      console.error('Failed to import shared game:', error);
      setError(t('sharedGame.importFailed', { error: error.message }));
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
            <h2>{t('sharedGame.unableToLoad')}</h2>
            <p>{error}</p>
            <button 
              className="btn-primary"
              onClick={() => navigate('/')}
            >
              {t('sharedGame.goToHome')}
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
            <h1>{t('sharedGame.importSuccess')}</h1>
            <p>{t('sharedGame.addedToCollection')}</p>
            <p>{t('sharedGame.redirecting')}</p>
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
                  <span>{t('sharedGame.winnerWith', { winner: sharedGameInfo.winnerName })}</span>
                  <span className="score">{sharedGameInfo.finalScore} points</span>
                </div>
                
                <div className="detail-item">
                </div>
                
                <div className="detail-item">
                  <UserIcon size={20} />
                  <span>{sharedGameInfo.playerNames}</span>
                </div>
                
                <div className="detail-item">
                  <span>{t('sharedGame.rounds', { count: sharedGameInfo.totalRounds })}</span>
                </div>
                
                {/* <div className="detail-item">
                  <CalendarIcon size={20} />
                  <span>Shared: {formatDate(sharedGameInfo.createdAt)}</span>
                </div> */}
              </div>
            </div>

            <div className="import-section">
              {error && !imported && sharedGameInfo && (
                <div className="import-error-message">
                  <p>⚠️ {error}</p>
                </div>
              )}
              
              <div className="import-actions">
                {alreadyImported ? (
                  <>
                    <div className="already-imported-message">
                      <p>{t('sharedGame.alreadyHaveGame')}</p>
                    </div>
                    <button 
                      className="btn-secondary"
                      onClick={() => navigate('/account')}
                    >
                      {t('sharedGame.viewMyGames')}
                    </button>
                  </>
                ) : (
                  <button 
                    className="btn-primary import-btn"
                    onClick={handleImportGame}
                    disabled={importing || alreadyImported}
                  >
                    {importing ? t('sharedGame.importing') : t('sharedGame.importGame')}
                  </button>
                )}
                
                <button 
                  className="btn-secondary"
                  onClick={() => navigate('/')}
                >
                  {t('sharedGame.goToHome')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Player Selection Modal */}
        <ImportGamePlayerSelectModal
          isOpen={showPlayerSelectModal}
          onClose={() => setShowPlayerSelectModal(false)}
          onConfirm={performImport}
          players={(sharedGameInfo?.gameData?.players || []).map(player => ({
            ...player,
            final_score: sharedGameInfo?.gameData?.final_scores?.[player.id]
          }))}
          currentUser={user}
        />
      </div>
    </div>
  );
};

export default SharedGamePage;
