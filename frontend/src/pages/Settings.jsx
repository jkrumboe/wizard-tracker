"use client"

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { LocalGameStorage } from '@/services/localGameStorage';
import { ShareValidator } from '@/utils/shareValidator';
import { TrashIcon, SettingsIcon, RefreshIcon, DownloadIcon, UploadIcon, ShareIcon } from '@/components/Icon';
import PageTransition from '@/components/PageTransition';
import '@/styles/settings.css';

const Settings = () => {
  const [savedGames, setSavedGames] = useState({});
  const [totalStorageSize, setTotalStorageSize] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [gameToDelete, setGameToDelete] = useState(null);
  const [deleteAll, setDeleteAll] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const { theme, toggleTheme, useSystemTheme, setUseSystemTheme } = useTheme();

  const checkForImportedGames = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const importGamesParam = urlParams.get('importGames');
    const importGameParam = urlParams.get('importGame');
    const shareKeyParam = urlParams.get('shareKey');
    
    if (importGamesParam) {
      // Handle multiple games import with security validation
      const validation = ShareValidator.validateEncodedGamesData(importGamesParam);
      
      if (!validation.isValid) {
        setMessage({ 
          text: `Invalid shared link: ${validation.error}`, 
          type: 'error' 
        });
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      try {
        const success = LocalGameStorage.importGames(JSON.stringify(validation.data));
        if (success) {
          loadSavedGames();
          calculateStorageUsage();
          setMessage({ text: 'Games imported successfully from shared link!', type: 'success' });
        } else {
          setMessage({ text: 'Failed to import games from shared link.', type: 'error' });
        }
      } catch (error) {
        console.error('Error importing games from URL:', error);
        setMessage({ text: 'Failed to process shared link data.', type: 'error' });
      }
      
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (importGameParam) {
      // Handle single game import with security validation
      const validation = ShareValidator.validateEncodedGameData(importGameParam);
      
      if (!validation.isValid) {
        setMessage({ 
          text: `Invalid shared link: ${validation.error}`, 
          type: 'error' 
        });
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      try {
        const compactGameData = validation.data;
        
        // Convert compact data back to full game format
        const fullGameData = {
          [compactGameData.id]: {
            id: compactGameData.id,
            name: `Imported Game - ${new Date(compactGameData.created_at).toLocaleDateString()}`,
            gameState: {
              id: compactGameData.id,
              players: compactGameData.players,
              winner_id: compactGameData.winner_id,
              final_scores: compactGameData.final_scores,
              round_data: compactGameData.round_data,
              total_rounds: compactGameData.total_rounds,
              created_at: compactGameData.created_at,
              game_mode: compactGameData.game_mode,
              duration_seconds: compactGameData.duration_seconds,
              currentRound: compactGameData.total_rounds,
              maxRounds: compactGameData.total_rounds,
              roundData: compactGameData.round_data,
              gameStarted: true,
              gameFinished: true,
              mode: compactGameData.game_mode,
              isLocal: true,
              isPaused: false,
              referenceDate: compactGameData.created_at,
              gameId: compactGameData.id,
              player_ids: compactGameData.players.map(p => p.id)
            },
            savedAt: compactGameData.created_at,
            lastPlayed: compactGameData.created_at,
            playerCount: compactGameData.players.length,
            roundsCompleted: compactGameData.total_rounds,
            totalRounds: compactGameData.total_rounds,
            mode: compactGameData.game_mode,
            gameFinished: true,
            isPaused: false,
            isImported: true,
            winner_id: compactGameData.winner_id,
            final_scores: compactGameData.final_scores,
            created_at: compactGameData.created_at,
            player_ids: compactGameData.players.map(p => p.id),
            round_data: compactGameData.round_data,
            total_rounds: compactGameData.total_rounds,
            duration_seconds: compactGameData.duration_seconds,
            is_local: true
          }
        };
        
        const success = LocalGameStorage.importGames(JSON.stringify(fullGameData));
        if (success) {
          loadSavedGames();
          calculateStorageUsage();
          setMessage({ text: 'Game imported successfully from shared link!', type: 'success' });
        } else {
          setMessage({ text: 'Failed to import game from shared link.', type: 'error' });
        }
      } catch (error) {
        console.error('Error importing game from URL:', error);
        setMessage({ text: 'Failed to process shared link data.', type: 'error' });
      }
      
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (shareKeyParam) {
      // Handle share key import (for large data) with security validation
      
      // First validate the share key format
      if (!ShareValidator.isValidShareKey(shareKeyParam)) {
        setMessage({ 
          text: 'Invalid share link format.', 
          type: 'error' 
        });
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      try {
        const jsonData = localStorage.getItem(shareKeyParam);
        const expirationTime = localStorage.getItem(shareKeyParam + '_expires');
        
        if (!jsonData) {
          setMessage({ 
            text: 'This share link was created on a different device. Please use the download/import file method for cross-device sharing.', 
            type: 'error' 
          });
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
        
        // Check if expired
        if (expirationTime && Date.now() > parseInt(expirationTime)) {
          localStorage.removeItem(shareKeyParam);
          localStorage.removeItem(shareKeyParam + '_expires');
          setMessage({ text: 'Shared game link has expired.', type: 'error' });
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
        
        // Validate the JSON data structure before importing
        try {
          JSON.parse(jsonData); // Just validate it's valid JSON
        } catch (parseError) {
          console.warn('Parse error for share key data:', parseError);
          localStorage.removeItem(shareKeyParam);
          localStorage.removeItem(shareKeyParam + '_expires');
          setMessage({ text: 'Invalid shared link data format.', type: 'error' });
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
        
        // Validate the structure as games data
        const validation = ShareValidator.validateEncodedGamesData(btoa(jsonData));
        if (!validation.isValid) {
          localStorage.removeItem(shareKeyParam);
          localStorage.removeItem(shareKeyParam + '_expires');
          setMessage({ 
            text: `Invalid shared link: ${validation.error}`, 
            type: 'error' 
          });
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
        
        const success = LocalGameStorage.importGames(JSON.stringify(validation.data));
        
        if (success) {
          loadSavedGames();
          calculateStorageUsage();
          setMessage({ text: 'Game imported successfully from shared link!', type: 'success' });
          
          // Clean up the temporary storage
          localStorage.removeItem(shareKeyParam);
          localStorage.removeItem(shareKeyParam + '_expires');
        } else {
          setMessage({ text: 'Failed to import game from shared link.', type: 'error' });
        }
      } catch (error) {
        console.error('Error importing game from share key:', error);
        setMessage({ text: 'Failed to process shared link data.', type: 'error' });
      }
      
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const cleanupExpiredShareKeys = () => {
    const keysToRemove = [];
    
    // Find all share keys in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('share_') && key.endsWith('_expires')) {
        const expirationTime = localStorage.getItem(key);
        if (expirationTime && Date.now() > parseInt(expirationTime)) {
          // Mark for removal
          const shareKey = key.replace('_expires', '');
          keysToRemove.push(shareKey);
          keysToRemove.push(key);
        }
      }
    }
    
    // Remove expired keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
  };

  useEffect(() => {
    loadSavedGames();
    calculateStorageUsage();
    checkForImportedGames();
    cleanupExpiredShareKeys();
    
    // Check for import success/error flags from URL handler
    if (localStorage.getItem('import_success')) {
      setMessage({ text: 'Game imported successfully from shared link!', type: 'success' });
      localStorage.removeItem('import_success');
    } else if (localStorage.getItem('import_error')) {
      setMessage({ text: 'Failed to import game from shared link.', type: 'error' });
      localStorage.removeItem('import_error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Keep empty dependency array and handle URL changes elsewhere

  // Handle URL parameter changes
  useEffect(() => {
    const handleUrlParamImport = () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('importGame') || urlParams.has('importGames') || urlParams.has('shareKey')) {
        checkForImportedGames();
      }
    };

    // Run once on mount
    handleUrlParamImport();

    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', handleUrlParamImport);

    return () => {
      window.removeEventListener('popstate', handleUrlParamImport);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSavedGames = () => {
    const games = LocalGameStorage.getAllSavedGames();
    setSavedGames(games);
  };

  const calculateStorageUsage = () => {
    const totalSize = Object.keys(localStorage).reduce((total, key) => {
      // Skip temporary share keys in storage calculation
      if (key.startsWith('share_')) {
        return total;
      }
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

  const importGamesData = (file) => {
    // File size limit (1MB)
    const MAX_FILE_SIZE = 1024 * 1024;
    
    if (file.size > MAX_FILE_SIZE) {
      setMessage({ text: 'File too large. Maximum size is 1MB.', type: 'error' });
      return;
    }
    
    // File type validation
    if (!file.type.includes('json') && !file.name.endsWith('.json')) {
      setMessage({ text: 'Invalid file type. Please select a JSON file.', type: 'error' });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = e.target.result;
        
        // Additional size check after reading
        if (jsonData.length > MAX_FILE_SIZE) {
          setMessage({ text: 'File content too large.', type: 'error' });
          return;
        }
        
        let parsedData;
        try {
          parsedData = JSON.parse(jsonData);
        } catch (parseError) {
          console.warn('JSON parse error:', parseError.message);
          setMessage({ text: 'Invalid JSON file format.', type: 'error' });
          return;
        }
        
        // Check if it's a compact single game format or full games format
        if (parsedData.id && parsedData.players && parsedData.round_data) {
          // This is a compact single game format - validate it
          const validation = ShareValidator.validateGameDataStructure(parsedData);
          if (!validation.isValid) {
            setMessage({ 
              text: `Invalid game data: ${validation.error}`, 
              type: 'error' 
            });
            return;
          }
          
          // Sanitize the data
          const sanitizedGameData = ShareValidator.sanitizeGameData(parsedData);
          
          const fullGameData = {
            [sanitizedGameData.id]: {
              id: sanitizedGameData.id,
              name: `Imported Game - ${new Date(sanitizedGameData.created_at).toLocaleDateString()}`,
              gameState: {
                id: sanitizedGameData.id,
                players: sanitizedGameData.players,
                winner_id: sanitizedGameData.winner_id,
                final_scores: sanitizedGameData.final_scores,
                round_data: sanitizedGameData.round_data,
                total_rounds: sanitizedGameData.total_rounds,
                created_at: sanitizedGameData.created_at,
                game_mode: sanitizedGameData.game_mode,
                duration_seconds: sanitizedGameData.duration_seconds,
                currentRound: sanitizedGameData.total_rounds,
                maxRounds: sanitizedGameData.total_rounds,
                roundData: sanitizedGameData.round_data,
                gameStarted: true,
                gameFinished: true,
                mode: sanitizedGameData.game_mode,
                isLocal: true,
                isPaused: false,
                referenceDate: sanitizedGameData.created_at,
                gameId: sanitizedGameData.id,
                player_ids: sanitizedGameData.players.map(p => p.id)
              },
              savedAt: sanitizedGameData.created_at,
              lastPlayed: sanitizedGameData.created_at,
              playerCount: sanitizedGameData.players.length,
              roundsCompleted: sanitizedGameData.total_rounds,
              totalRounds: sanitizedGameData.total_rounds,
              mode: sanitizedGameData.game_mode,
              gameFinished: true,
              isPaused: false,
              isImported: true,
              winner_id: sanitizedGameData.winner_id,
              final_scores: sanitizedGameData.final_scores,
              created_at: sanitizedGameData.created_at,
              player_ids: sanitizedGameData.players.map(p => p.id),
              round_data: sanitizedGameData.round_data,
              total_rounds: sanitizedGameData.total_rounds,
              duration_seconds: sanitizedGameData.duration_seconds,
              is_local: true
            }
          };
          
          const success = LocalGameStorage.importGames(JSON.stringify(fullGameData));
          if (success) {
            loadSavedGames();
            calculateStorageUsage();
            setMessage({ text: 'Game imported successfully.', type: 'success' });
          } else {
            setMessage({ text: 'Failed to import game.', type: 'error' });
          }
        } else {
          // This is the full games format - validate it
          const validation = ShareValidator.validateEncodedGamesData(btoa(jsonData));
          if (!validation.isValid) {
            setMessage({ 
              text: `Invalid games data: ${validation.error}`, 
              type: 'error' 
            });
            return;
          }
          
          const success = LocalGameStorage.importGames(JSON.stringify(validation.data));
          if (success) {
            loadSavedGames();
            calculateStorageUsage();
            setMessage({ text: 'Games data imported successfully.', type: 'success' });
          } else {
            setMessage({ text: 'Failed to import games data.', type: 'error' });
          }
        }
      } catch (error) {
        console.error('Error importing games data:', error);
        setMessage({ text: 'Failed to process games data file.', type: 'error' });
      }
    };
    reader.readAsText(file);
  };

  const handleFileImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      importGamesData(file);
    }
    // Reset the input
    event.target.value = '';
  };

  const generateSingleGameShareableLink = (gameId, gameData) => {
    // Don't allow sharing of paused games
    if (gameData.isPaused) {
      setMessage({ text: 'Cannot share paused games. Please finish the game first.', type: 'error' });
      return;
    }
    
    try {
      // Create a more compact data structure by removing redundant information
      const gameState = gameData.gameState || {};
      const compactGameData = {
        id: gameId,
        players: gameState.players || [],
        winner_id: gameState.winner_id,
        final_scores: gameState.final_scores || {},
        round_data: gameState.round_data || [],
        total_rounds: gameState.total_rounds || gameState.maxRounds || 0,
        created_at: gameState.created_at || gameData.savedAt,
        game_mode: gameState.game_mode || gameState.mode || "Local",
        duration_seconds: gameState.duration_seconds || 0
      };
      
      // Validate the game data structure before sharing
      const validation = ShareValidator.validateGameDataStructure(compactGameData);
      if (!validation.isValid) {
        setMessage({ 
          text: `Cannot share game: ${validation.error}`, 
          type: 'error' 
        });
        return;
      }
      
      // Sanitize the data to prevent any security issues
      const sanitizedData = ShareValidator.sanitizeGameData(compactGameData);
      
      // Remove any undefined or null values to make it more compact
      const cleanedData = JSON.parse(JSON.stringify(sanitizedData, (key, value) => {
        return value === undefined || value === null ? undefined : value;
      }));
      
      const jsonData = JSON.stringify(cleanedData);
      
      // Use direct URL method that works across devices
      const compressedData = btoa(unescape(encodeURIComponent(jsonData)));
      const baseUrl = window.location.origin;
      const shareableLink = `${baseUrl}?importGame=${compressedData}`;
      
      // Check URL length and warn user about different sharing methods
      if (shareableLink.length > 8000) {
        setMessage({ 
          text: 'Game data is too large for URL sharing. Please use the download button instead.', 
          type: 'error' 
        });
        return;
      } else if (shareableLink.length > 2000) {
        // Create a temporary share key for very large data
        const shareKey = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expirationTime = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        
        // Store the compact data in localStorage temporarily
        localStorage.setItem(shareKey, jsonData);
        localStorage.setItem(shareKey + '_expires', expirationTime.toString());
        
        // Create a shorter URL with just the share key
        const shortShareableLink = `${baseUrl}?shareKey=${shareKey}`;
        
        // Copy the short URL to clipboard
        navigator.clipboard.writeText(shortShareableLink).then(() => {
          // Success
        }).catch(() => {
          // Fallback for browsers that don't support clipboard API
          const textArea = document.createElement('textarea');
          textArea.value = shortShareableLink;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        });
        
        setMessage({ 
          text: 'Game link copied to clipboard! (Note: This link only works on the same device and expires in 24 hours. For cross-device sharing, use the download button instead.)', 
          type: 'success' 
        });
        return;
      }
      
      // URL is short enough, use the direct method
      setMessage({ text: 'Game link copied to clipboard!', type: 'success' });
      
      // Copy to clipboard
      navigator.clipboard.writeText(shareableLink).then(() => {
        // Success
      }).catch(() => {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = shareableLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      });
    } catch (error) {
      console.error('Error generating single game shareable link:', error);
      setMessage({ text: 'Failed to generate game link.', type: 'error' });
    }
  };

  const downloadSingleGame = (gameId, gameData) => {
    // Don't allow downloading of paused games
    if (gameData.isPaused) {
      setMessage({ text: 'Cannot download paused games. Please finish the game first.', type: 'error' });
      return;
    }
    
    try {
      // Create a more compact data structure by removing redundant information
      const gameState = gameData.gameState || {};
      const compactGameData = {
        id: gameId,
        players: gameState.players || [],
        winner_id: gameState.winner_id,
        final_scores: gameState.final_scores || {},
        round_data: gameState.round_data || [],
        total_rounds: gameState.total_rounds || gameState.maxRounds || 0,
        created_at: gameState.created_at || gameData.savedAt,
        game_mode: gameState.game_mode || gameState.mode || "Local",
        duration_seconds: gameState.duration_seconds || 0
      };
      
      // Validate the game data structure before downloading
      const validation = ShareValidator.validateGameDataStructure(compactGameData);
      if (!validation.isValid) {
        setMessage({ 
          text: `Cannot download game: ${validation.error}`, 
          type: 'error' 
        });
        return;
      }
      
      // Sanitize the data to prevent any security issues
      const sanitizedData = ShareValidator.sanitizeGameData(compactGameData);
      
      // Remove any undefined or null values to make it more compact
      const cleanedData = JSON.parse(JSON.stringify(sanitizedData, (key, value) => {
        return value === undefined || value === null ? undefined : value;
      }));
      
      const jsonData = JSON.stringify(cleanedData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wizard-tracker-game-${gameId}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage({ text: 'Game exported successfully.', type: 'success' });
    } catch (error) {
      console.error('Error downloading single game:', error);
      setMessage({ text: 'Failed to export game.', type: 'error' });
    }
  };

  return (
    <PageTransition>
      <div className="settings-container">
        {/* {message.text && (
          <div className={`settings-message ${message.type}`}>
            {message.text}
          </div>
        )} */}

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
          </div>

          {!useSystemTheme && (
            <div className="settings-option">
              <div className="theme-button-group">
                <button 
                  type="button"
                  className={`tab-button ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => theme === 'dark' && toggleTheme()}
                >
                  Light Mode
                </button>
                <button 
                  type="button"
                  className={`tab-button ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => theme === 'light' && toggleTheme()}
                >
                  Dark Mode
                </button>
              </div>
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
              Refresh Storage
            </button>
            <div className='import-export-buttons'>
              <label className="settings-button import-button">
                <DownloadIcon size={18} />
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  style={{ display: 'none' }}
                />
              </label>
              <button className="settings-button export-button" onClick={exportGamesData}>
                <UploadIcon size={18} />
                Export
              </button>
            </div>
            <button className="settings-button danger-button" onClick={handleDeleteAllData}>
              <TrashIcon size={18} />
              Clear all Data
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h2>Saved Games</h2>
          {Object.keys(savedGames).length > 0 ? (
            <div className="games-list">
              {Object.entries(savedGames).map(([gameId, game]) => (
                <div key={gameId} className={`game-card ${game.isImported ? 'imported-game' : ''}`}>
                  <div className="game-date">
                    {game.isPaused ? 'Paused' : 'Finished'}: {formatDate(game.lastPlayed)} | 
                    Rounds: {game.gameState?.currentRound || game.gameState?.round_data?.length || "N/A"}
                    {game.isImported && (
                      <span className="import-badge">
                        <ShareIcon size={14} />
                        Imported
                      </span>
                    )}
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
                        <button 
                          className="share-game-button" 
                          onClick={() => generateSingleGameShareableLink(gameId, game)}
                          aria-label="Share game"
                          disabled={game.isPaused}
                        >
                          <ShareIcon size={25} />
                        </button>
                        <button 
                          className="download-game-button" 
                          onClick={() => downloadSingleGame(gameId, game)}
                          aria-label="Download game"
                          disabled={game.isPaused}
                        >
                          <DownloadIcon size={25} />
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
