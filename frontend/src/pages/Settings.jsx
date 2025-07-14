"use client"

import React, { useState, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import { LocalGameStorage } from '../services/localGameStorage';
import { TrashIcon, SettingsIcon, RefreshIcon, DownloadIcon } from '../components/Icon';
import PageTransition from '../components/PageTransition';
import '../styles/settings.css';

const Settings = () => {
  const [savedGames, setSavedGames] = useState({});
  const [totalStorageSize, setTotalStorageSize] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [gameToDelete, setGameToDelete] = useState(null);
  const [deleteAll, setDeleteAll] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const { theme, toggleTheme, useSystemTheme, setUseSystemTheme } = useTheme();

  useEffect(() => {
    loadSavedGames();
    calculateStorageUsage();
  }, []);

  const loadSavedGames = () => {
    const games = LocalGameStorage.getAllSavedGames();
    setSavedGames(games);
  };

  const calculateStorageUsage = () => {
    const totalSize = Object.keys(localStorage).reduce((total, key) => {
      const value = localStorage.getItem(key);
      return total + (value ? value.length * 2 / 1024 : 0); // Approximate size in KB
    }, 0);
    setTotalStorageSize(totalSize);
  };

  const handleDeleteGame = (gameId) => {
    setGameToDelete(gameId);
    setDeleteAll(false);
    setShowConfirmDialog(true);
  };

  const handleConfirmDelete = () => {
    if (deleteAll) {
      // Clear all localStorage data
      localStorage.clear();
      setSavedGames({});
      setTotalStorageSize(0);
      setMessage({ text: 'All local storage data has been cleared.', type: 'success' });
    } else if (gameToDelete) {
      // Delete specific game
      LocalGameStorage.deleteGame(gameToDelete);
      loadSavedGames();
      calculateStorageUsage();
      setMessage({ text: 'Game deleted successfully.', type: 'success' });
    }
    setShowConfirmDialog(false);
    setGameToDelete(null);
    setDeleteAll(false);
  };

  const handleDeleteAllData = () => {
    setDeleteAll(true);
    setGameToDelete(null);
    setShowConfirmDialog(true);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const handleThemeModeChange = (e) => {
    setUseSystemTheme(e.target.checked);
  };

  const clearMessage = () => {
    setTimeout(() => {
      setMessage({ text: '', type: '' });
    }, 3000);
  };

  useEffect(() => {
    if (message.text) {
      clearMessage();
    }
  }, [message]);

  const exportGamesData = () => {
    try {
      const jsonData = LocalGameStorage.exportGames();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wizard-tracker-games-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage({ text: 'Games data exported successfully.', type: 'success' });
    } catch (error) {
      console.error('Error exporting games data:', error);
      setMessage({ text: 'Failed to export games data.', type: 'error' });
    }
  };

  return (
    <PageTransition>
      <div className="settings-container">
        {message.text && (
          <div className={`settings-message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="settings-section">
          <h2>Theme Settings</h2>
          <div className="settings-option">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={useSystemTheme} 
                onChange={handleThemeModeChange} 
              />
              <span> Use system theme preference</span>
            </label>
            {/* <p className="option-description">
              When enabled, the app will automatically switch between light and dark mode based on your system settings.
            </p> */}
          </div>

          {!useSystemTheme && (
            <div className="settings-option">
              <label className="radio-group">
                <div className="radio-option">
                  <input 
                    type="radio" 
                    name="theme" 
                    checked={theme === 'light'} 
                    onChange={() => theme === 'dark' && toggleTheme()} 
                  />
                  <span>Light Mode</span>
                </div>
                <div className="radio-option">
                  <input 
                    type="radio" 
                    name="theme" 
                    checked={theme === 'dark'} 
                    onChange={() => theme === 'light' && toggleTheme()} 
                  />
                  <span>Dark Mode</span>
                </div>
              </label>
            </div>
          )}
        </div>

        <div className="settings-section">
          <h2>Local Storage</h2>
          <div className="storage-info">
            <div className="storage-metric">
              <span>Total Storage Used</span>
              <span className="storage-value">{totalStorageSize.toFixed(2)} KB</span>
            </div>
            <div className="storage-metric">
              <span>Saved Games</span>
              <span className="storage-value">{Object.keys(savedGames).length}</span>
            </div>
          </div>

          <div className="settings-actions">
            <button className="settings-button refresh-button" onClick={() => {
              loadSavedGames();
              calculateStorageUsage();
              setMessage({ text: 'Storage information refreshed.', type: 'info' });
            }}>
              <RefreshIcon size={18} />
              Refresh Storage Info
            </button>
            <button className="settings-button export-button" onClick={exportGamesData}>
              <DownloadIcon size={18} />
              Export Games Data
            </button>
            <button className="settings-button danger-button" onClick={handleDeleteAllData}>
              <TrashIcon size={18} />
              Clear All Local Data
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h2>Saved Games</h2>
          {Object.keys(savedGames).length > 0 ? (
            <div className="games-list">
              {Object.entries(savedGames).map(([gameId, game]) => (
                <div key={gameId} className="game-card">
                  <div className="game-date">
                    {game.isPaused ? 'Paused' : 'Finished'}: {formatDate(game.lastPlayed)} | 
                    Rounds: {game.gameState?.currentRound || game.gameState?.round_data?.length || "N/A"}
                  </div>
                  <div className="game-info">
                    {(() => {
                      const winnerName = game.gameState?.winner_name || game.gameState?.players?.find(p => p.id === game.gameState?.winner_id)?.name;
                      return winnerName ? (
                        <div className="game-winner">
                          Winner: {winnerName}
                        </div>
                      ) : null;
                    })()}
                    <div className="game-players">
                      Players:{" "}
                      {game.gameState?.players 
                        ? game.gameState.players.map(player => player.name || "Unknown Player").join(", ")
                        : "No players"}
                    </div>
                    <div className="bottom-game-history">
                      <div className="game-actions">
                        <button 
                          className="delete-game-button" 
                          onClick={() => handleDeleteGame(gameId)}
                          aria-label="Delete game"
                        >
                          <TrashIcon size={25} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-games">No saved games found.</p>
          )}
        </div>

        {showConfirmDialog && (
          <div className="confirm-dialog-overlay">
            <div className="confirm-dialog">
              <h3>{deleteAll ? 'Clear All Data?' : 'Delete Game?'}</h3>
              <p>
                {deleteAll 
                  ? 'Are you sure you want to delete all local storage data? This action cannot be undone.'
                  : 'Are you sure you want to delete this game? This action cannot be undone.'}
              </p>
              <div className="confirm-actions">
                <button 
                  className="cancel-button" 
                  onClick={() => setShowConfirmDialog(false)}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-button danger-button" 
                  onClick={handleConfirmDelete}
                >
                  {deleteAll ? 'Clear All Data' : 'Delete Game'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
};

export default Settings;
