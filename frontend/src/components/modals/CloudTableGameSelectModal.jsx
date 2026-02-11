import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from '@/components/ui/Icon';
import '@/styles/components/modal.css';

const CloudTableGameSelectModal = ({ isOpen, onClose, onDownload }) => {
  const { t } = useTranslation();
  const [cloudGames, setCloudGames] = useState([]);
  const [selectedGames, setSelectedGames] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadCloudTableGames();
    }
  }, [isOpen]);

  const loadCloudTableGames = async () => {
    setLoading(true);
    setError(null);
    try {
      const { getUserCloudTableGamesList } = await import('@/shared/api/tableGameService');
      const games = await getUserCloudTableGamesList();
      // Filter out games that already exist locally
      const availableGames = games.filter(game => !game.existsLocally);
      setCloudGames(availableGames);
    } catch (err) {
      setError(err.message);
      console.error('Error loading cloud table games:', err);
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
      onDownload(Array.from(selectedGames));
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container cloud-game-select-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <h2>
            {t('cloudGames.cloudTableGamesTitle')}
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
              <p>{t('cloudGames.loadingTableGames')}</p>
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              <p style={{ color: 'var(--error-color)', marginBottom: 'var(--spacing-md)' }}>{t('common.error')}: {error}</p>
              <button className="modal-button primary" onClick={loadCloudTableGames}>{t('cloudGames.retry')}</button>
            </div>
          )}

          {!loading && !error && cloudGames.length === 0 && (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              <p>{t('cloudGames.noTableGamesFound')}</p>
            </div>
          )}

          {!loading && !error && cloudGames.length > 0 && (
            <>
              <div style={{ 
                display: 'flex', 
                gap: 'var(--spacing-sm)', 
                alignItems: 'center', 
                marginBottom: 'var(--spacing-md)',
              }}>
                <button 
                  onClick={selectAll} 
                  className="modal-button secondary"
                  style={{ width: 'auto', padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '0.9rem' }}
                >
                  {t('cloudGames.selectAllNew')}
                </button>
                <button 
                  onClick={deselectAll} 
                  className="modal-button secondary"
                  style={{ width: 'auto', padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '0.9rem' }}
                >
                  {t('cloudGames.deselectAll')}
                </button>
                <span style={{ marginLeft: 'auto', fontWeight: '500', color: 'var(--primary)' }}>
                  {t('cloudGames.selected', { count: selectedGames.size })}
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
                      <div className="player-name" style={{ fontWeight: '600' }}>
                        {game.name}
                      </div>
                      
                      {game.gameTypeName && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {t('cloudGames.gameType', { type: game.gameTypeName })}
                        </div>
                      )}
                      
                      <div className="player-score" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {t('common.players')}: {game.players.map(p => p.name).join(', ')}
                      </div>
                      
                      {game.gameFinished && (
                        <span style={{ 
                          padding: '2px 8px', 
                          borderRadius: 'var(--radius-sm)', 
                          fontSize: '0.75rem', 
                          fontWeight: '600',
                          background: 'var(--success-color)',
                          color: 'white',
                          width: 'fit-content'
                        }}>{t('cloudGames.finished')}</span>
                      )}
                      
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {new Date(game.created_at).toLocaleDateString()} - {game.playerCount} {t('common.players')}, {game.totalRounds} {t('common.rounds')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button 
            className="modal-button secondary" 
            onClick={onClose}
          >
            {t('common.cancel')}
          </button>
          <button 
            className="modal-button primary" 
            onClick={handleDownload}
            disabled={selectedGames.size === 0}
            style={{
              opacity: selectedGames.size === 0 ? 0.5 : 1,
              cursor: selectedGames.size === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            {t('cloudGames.downloadSelected', { count: selectedGames.size })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CloudTableGameSelectModal;
