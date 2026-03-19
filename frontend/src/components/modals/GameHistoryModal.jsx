import { XIcon } from '@/components/ui/Icon';
import '@/styles/modals/gameHistoryModal.css';

const GameHistoryModal = ({
  isOpen,
  onClose,
  title,
  searchPlaceholder,
  searchTerm,
  onSearchChange,
  loading,
  loadingText,
  games,
  filteredGames,
  pausedCount,
  finishedCount,
  pausedLabel,
  finishedLabel,
  statusFilter,
  onStatusFilterChange,
  emptyTitle,
  emptySubtitle,
  renderGameCard
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="game-history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-content">
            <h2>{title}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <XIcon size={24} />
          </button>
        </div>

        <div className="modal-search">
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button className="search-clear-btn" onClick={() => onSearchChange('')} aria-label="Clear search">
                <XIcon size={14} />
              </button>
            )}
          </div>
        </div>

        {games.length > 0 && (
          <div className="modal-stats">
            <button
              type="button"
              className={`stat-item paused ${statusFilter === 'paused' ? 'active' : ''}`}
              onClick={() => onStatusFilterChange('paused')}
              aria-pressed={statusFilter === 'paused'}
            >
              <span className="stat-badge"></span>
              <span>{pausedCount} {pausedLabel}</span>
            </button>
            <div className="stat-divider"></div>
            <button
              type="button"
              className={`stat-item finished ${statusFilter === 'finished' ? 'active' : ''}`}
              onClick={() => onStatusFilterChange('finished')}
              aria-pressed={statusFilter === 'finished'}
            >
              <span className="stat-badge"></span>
              <span>{finishedCount} {finishedLabel}</span>
            </button>
          </div>
        )}

        <div className="games-list">
          {loading ? (
            <div className="empty-state">
              <div className="loading-spinner"></div>
              <p>{loadingText}</p>
            </div>
          ) : filteredGames.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">{emptyTitle}</p>
              {emptySubtitle && <p className="empty-subtitle">{emptySubtitle}</p>}
            </div>
          ) : (
            filteredGames.map(renderGameCard)
          )}
        </div>
      </div>
    </div>
  );
};

export default GameHistoryModal;
