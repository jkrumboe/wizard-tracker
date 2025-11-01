import React, { useState, useEffect } from 'react';
import { XIcon, FilterIcon, PlusIcon } from '@/components/ui/Icon';
import PlayerNameInput from '@/components/ui/PlayerNameInput';
import '@/styles/components/modal.css';
import '@/styles/components/GameFilterModal.css';

const GameFilterModal = ({ isOpen, onClose, onApplyFilters, initialFilters = {} }) => {
  const [filters, setFilters] = useState({
    playerNames: [],
    dateFrom: '',
    dateTo: '',
    sortBy: 'date',
    sortOrder: 'desc',
    ...initialFilters
  });
  const [playerInput, setPlayerInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFilters({
        playerNames: [],
        dateFrom: '',
        dateTo: '',
        sortBy: 'date',
        sortOrder: 'desc',
        ...initialFilters
      });
      setPlayerInput('');
    }
  }, [isOpen, initialFilters]);

  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddPlayer = () => {
    if (playerInput.trim() && !filters.playerNames.includes(playerInput.trim())) {
      setFilters(prev => ({
        ...prev,
        playerNames: [...prev.playerNames, playerInput.trim()]
      }));
      setPlayerInput('');
    }
  };

  const handleRemovePlayer = (playerToRemove) => {
    setFilters(prev => ({
      ...prev,
      playerNames: prev.playerNames.filter(p => p !== playerToRemove)
    }));
  };

  const handlePlayerInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddPlayer();
    }
  };

  const handleApply = () => {
    onApplyFilters(filters);
    onClose();
  };

  const handleClear = () => {
    const clearedFilters = {
      playerNames: [],
      dateFrom: '',
      dateTo: '',
      sortBy: 'date',
      sortOrder: 'desc'
    };
    setFilters(clearedFilters);
    setPlayerInput('');
    onApplyFilters(clearedFilters);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container game-filter-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <FilterIcon size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Filter Games
          </h2>
          <button className="close-btn" onClick={onClose} aria-label="Close Filter">
            <XIcon size={20} />
          </button>
        </div>

        <div className="modal-content">
          <div className="filter-section">
            <h3 className="filter-section-title">Players</h3>
                <div className="player-input-container">
                    <PlayerNameInput
                    id="playerName"
                    className="filter-input"
                    placeholder="Enter player name..."
                    value={playerInput}
                    onChange={(e) => setPlayerInput(e.target.value)}
                    onKeyDown={handlePlayerInputKeyDown}
                    />
                    <button 
                    type="button"
                    className="add-player-btn"
                    onClick={handleAddPlayer}
                    disabled={!playerInput.trim()}
                    >
                    <PlusIcon size={20} />
                    </button>
                </div>
              {filters.playerNames.length > 0 && (
                <div className="player-tags">
                  {filters.playerNames.map((player, index) => (
                    <span key={index} className="player-tag">
                      {player}
                      <button
                        type="button"
                        className="remove-player-btn"
                        onClick={() => handleRemovePlayer(player)}
                        aria-label={`Remove ${player}`}
                      >
                        <XIcon size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
          </div>

          <div className="filter-section">
            <h3 className="filter-section-title">Date Range</h3>
            <div className="filter-group-row">
              <div className="filter-group">
                <label htmlFor="dateFrom">From</label>
                <input
                  id="dateFrom"
                  type="date"
                  className="filter-input"
                  value={filters.dateFrom}
                  onChange={(e) => handleInputChange('dateFrom', e.target.value)}
                />
              </div>
              <div className="filter-group">
                <label htmlFor="dateTo">To</label>
                <input
                  id="dateTo"
                  type="date"
                  className="filter-input"
                  value={filters.dateTo}
                  onChange={(e) => handleInputChange('dateTo', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="filter-section">
            <h3 className="filter-section-title">Sort</h3>
            <div className="filter-group-row">
              <div className="filter-group">
                <label htmlFor="sortBy">Sort by</label>
                <select
                  id="sortBy"
                  className="filter-select"
                  value={filters.sortBy}
                  onChange={(e) => handleInputChange('sortBy', e.target.value)}
                >
                  <option value="date">Date</option>
                  <option value="players">Players</option>
                </select>
              </div>
              <div className="filter-group">
                <label htmlFor="sortOrder">Order</label>
                <select
                  id="sortOrder"
                  className="filter-select"
                  value={filters.sortOrder}
                  onChange={(e) => handleInputChange('sortOrder', e.target.value)}
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-button secondary" onClick={handleClear}>
            Clear All
          </button>
          <button className="modal-button primary" onClick={handleApply}>
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameFilterModal;
