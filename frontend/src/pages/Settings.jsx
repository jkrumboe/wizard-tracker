"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/shared/hooks/useTheme';
import { useUser } from '@/shared/hooks/useUser';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { LocalGameStorage } from '@/shared/api';
import { ShareValidator } from '@/shared/utils/shareValidator';
import { TrashIcon, SettingsIcon, RefreshIcon, CloudIcon, ShareIcon } from '@/components/ui/Icon';
import DeleteConfirmationModal from '@/components/modals/DeleteConfirmationModal';
import authService from '@/shared/api/authService';
import { uploadLocalGameToAppwrite } from '@/shared/api/gameService';
import { checkGameSyncStatus } from '@/shared/utils/syncChecker';
import { shareGame } from '@/shared/utils/gameSharing';
import { createSharedGameRecord } from '@/shared/api/sharedGameService';
import '@/styles/pages/settings.css';
import "@/styles/components/offline-notification.css";

const Settings = () => {
  const [savedGames, setSavedGames] = useState({});
  const [totalStorageSize, setTotalStorageSize] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [gameToDelete, setGameToDelete] = useState(null);
  const [deleteAll, setDeleteAll] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [cloudSyncStatus, setCloudSyncStatus] = useState({ uploading: false, progress: '', uploadedCount: 0, totalCount: 0 });
  const [uploadingGames, setUploadingGames] = useState(new Set()); // Track which games are currently uploading
  const [gameSyncStatuses, setGameSyncStatuses] = useState({}); // Track sync status for each game
  const [sharingGames, setSharingGames] = useState(new Set()); // Track which games are currently being shared
  const { theme, toggleTheme, useSystemTheme, setUseSystemTheme } = useTheme();
  const { user, clearUserData } = useUser();
  const { isOnline } = useOnlineStatus();

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

  const loadSavedGames = useCallback(async () => {
    // First migrate games to ensure they have upload tracking properties
    LocalGameStorage.migrateGamesForUploadTracking();
    
    const allGames = LocalGameStorage.getAllSavedGames();
    setSavedGames(allGames);
    
    // Check sync status for each game
    const syncStatuses = {};
    for (const gameId of Object.keys(allGames)) {
      try {
        const syncStatus = await checkGameSyncStatus(gameId);
        syncStatuses[gameId] = syncStatus;
      } catch (error) {
        console.error(`Error checking sync status for game ${gameId}:`, error);
        syncStatuses[gameId] = { status: 'Local', synced: false };
      }
    }
    setGameSyncStatuses(syncStatuses);
  }, []);

  // Reload games when date filter changes
  useEffect(() => {
    loadSavedGames();
  }, [loadSavedGames]);

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
    return new Date(dateString).toLocaleString("en-DE", {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const handleLogout = async () => {
    try {
      // Clear user data first
      clearUserData();
      // Then logout from Appwrite
      await authService.logout();
      // Navigate to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('Error during logout:', error);
      // Even if logout fails on server, clear local data and redirect
      clearUserData();
      window.location.href = '/login';
    }
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

  // Cloud Sync Functions
  const uploadSingleGameToCloud = async (gameId, gameData) => {
    if (!isOnline) {
      throw new Error('Cannot upload games while in offline mode');
    }
    
    if (gameData.isPaused) {
      throw new Error('Cannot upload paused games. Please finish the game first.');
    }

    try {
      const result = await uploadLocalGameToAppwrite(gameId, { replaceExisting: false });
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Patch local game object with Appwrite ID and isUploaded:true
      const appwriteGameId = result.appwriteGameId || result.cloudGameId || result.id;
      if (appwriteGameId) {
        // Update local storage directly and safely
        const allGames = LocalGameStorage.getAllSavedGames();
        if (allGames[gameId]) {
          allGames[gameId].appwriteGameId = appwriteGameId;
          allGames[gameId].isUploaded = true;
          // Save back to localStorage (do not call saveGame with wrong args)
          localStorage.setItem('wizardTracker_localGames', JSON.stringify(allGames));
        }
      }

      // Refresh the saved games list to show updated badge status
      loadSavedGames();
      return result;
    } catch (error) {
      console.error(`Failed to upload game ${gameId}:`, error);
      throw error;
    }
  };

  // Share Game Function
  const handleShareGame = async (gameId, gameData) => {
    console.debug('handleShareGame called with gameId:', gameId, 'gameData:', gameData);
    
    if (!isOnline) {
      setMessage({ text: 'Cannot share games while in offline mode', type: 'error' });
      return;
    }
    
    if (gameData.isPaused) {
      setMessage({ text: 'Cannot share paused games. Please finish the game first.', type: 'error' });
      return;
    }

    let syncStatus = gameSyncStatuses[gameId];
    let isGameOnline = syncStatus?.status === 'Online' || syncStatus?.status === 'Synced';

    // If not synced, upload first
    if (!isGameOnline) {
      setMessage({ text: 'Syncing game to cloud before sharing...', type: 'info' });
      try {
        const uploadResult = await uploadSingleGameToCloud(gameId, gameData);
        if (!uploadResult.success) {
          setMessage({ text: uploadResult.error || 'Failed to sync game before sharing.', type: 'error' });
          return;
        }
        // Optionally reload sync status here if needed
        if (typeof loadSavedGames === 'function') loadSavedGames();
        // Update syncStatus after upload
        syncStatus = gameSyncStatuses[gameId];
        isGameOnline = syncStatus?.status === 'Online' || syncStatus?.status === 'Synced';
      } catch (error) {
        setMessage({ text: `Failed to sync game before sharing: ${error.message}`, type: 'error' });
        return;
      }
    }

    if (!isGameOnline) {
      setMessage({ text: 'Game must be uploaded to cloud before sharing.', type: 'error' });
      return;
    }

    setSharingGames(prev => new Set([...prev, gameId]));
    try {
      // Use appwriteGameId for sharing if available, else fallback to local gameId
      let idToShare = gameData.appwriteGameId || gameData.cloudGameId || gameData.id || gameId;
      const gameToShare = {
        ...gameData,
        id: idToShare
      };
      console.debug('Game to share:', gameToShare);
      // Generate share link and handle sharing
      const shareResult = await shareGame(gameToShare);
      if (shareResult.success) {
        // Create shared game record in cloud
        const shareId = shareResult.url.split('/').pop();
        await createSharedGameRecord(gameData, shareId);
        if (shareResult.method === 'native') {
          setMessage({ text: 'Game shared successfully!', type: 'success' });
        } else {
          setMessage({ text: 'Share link copied to clipboard!', type: 'success' });
        }
      } else {
        setMessage({ text: 'Failed to share game. Please try again.', type: 'error' });
      }
    } catch (error) {
      console.error('Failed to share game:', error);
      setMessage({ text: `Share failed: ${error.message}`, type: 'error' });
    } finally {
      // Delay spinner removal for 1.5s to allow UI to update smoothly
      setTimeout(() => {
        setSharingGames(prev => {
          const newSet = new Set(prev);
          newSet.delete(gameId);
          return newSet;
        });
      }, 3000);
    }
  };

  const handleBulkCloudSync = async () => {
    if (!isOnline) {
      setMessage({ text: 'Cannot upload games while in offline mode', type: 'error' });
      return;
    }
    
    const gameEntries = Object.entries(savedGames);
    const uploadableGames = gameEntries.filter(([, game]) => !game.isPaused);
    
    if (uploadableGames.length === 0) {
      setMessage({ text: 'No games available for upload.', type: 'error' });
      return;
    }

    setCloudSyncStatus({ 
      uploading: true, 
      progress: 'Starting upload...', 
      uploadedCount: 0, 
      totalCount: uploadableGames.length 
    });

    let successful = 0;
    let failed = 0;
    const errors = [];

    try {
      for (let i = 0; i < uploadableGames.length; i++) {
        const [gameId, gameData] = uploadableGames[i];
        
        setCloudSyncStatus(prev => ({
          ...prev,
          progress: `Uploading game ${i + 1} of ${uploadableGames.length}...`,
          uploadedCount: i
        }));

        try {
          await uploadSingleGameToCloud(gameId, gameData);
          successful++;
        } catch (error) {
          failed++;
          errors.push(`Game ${gameId}: ${error.message}`);
        }
      }

      setCloudSyncStatus({ 
        uploading: false, 
        progress: '', 
        uploadedCount: 0, 
        totalCount: 0 
      });

      // Refresh the saved games list to show updated badge status
      loadSavedGames();

      if (successful > 0 && failed === 0) {
        setMessage({ 
          text: `✅ All ${successful} games uploaded successfully!`, 
          type: 'success' 
        });
      } else if (successful > 0 && failed > 0) {
        setMessage({ 
          text: `⚠️ Uploaded ${successful} games, ${failed} failed. Check console for details.`, 
          type: 'warning' 
        });
        console.warn('Upload errors:', errors);
      } else {
        setMessage({ 
          text: `❌ All uploads failed. Check console for details.`, 
          type: 'error' 
        });
        console.error('Upload errors:', errors);
      }
    } catch (error) {
      setCloudSyncStatus({ 
        uploading: false, 
        progress: '', 
        uploadedCount: 0, 
        totalCount: 0 
      });
      setMessage({ text: `Upload failed: ${error.message}`, type: 'error' });
    }
  };

  return (
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
          <h2>Storage{isOnline ? ' & Cloud Sync' : ''}</h2>
          
          {/* {!isOnline && (
            <div className="offline-notification">
              <p className="offline-message">
                <strong>Offline Mode:</strong> Cloud sync and sharing features are currently disabled. 
                You can still manage your local saved games below.
              </p>
            </div>
          )} */}
          
          <div className="storage-cloud-grid">
            <div className="storage-info">
              {/* <h3>Local Storage</h3> */}
              <div className="storage-metric">
                <span>Total Storage Used</span>
                <span className="storage-value">{totalStorageSize.toFixed(2)} KB</span>
              </div>
              <div className="storage-metric">
                <span>Saved Games</span>
                <span className="storage-value">{Object.keys(savedGames).length}</span>
              </div>
            </div>
          </div>

          {isOnline && cloudSyncStatus.uploading && (
            <div className="upload-progress">
              <div className="progress-text">{cloudSyncStatus.progress}</div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${(cloudSyncStatus.uploadedCount / cloudSyncStatus.totalCount) * 100}%` 
                  }}
                ></div>
              </div>
              <div className="progress-stats">
                {cloudSyncStatus.uploadedCount} / {cloudSyncStatus.totalCount} games
              </div>
            </div>
          )}

          <div className="settings-actions">
            <button className="settings-button refresh-button" onClick={() => {
              loadSavedGames();
              calculateStorageUsage();
              setMessage({ text: 'Storage information refreshed.', type: 'info' });
            }}>
              <RefreshIcon size={18} />
              Refresh Storage
            </button>
            {isOnline && (
              <button 
                className={`settings-button cloud-sync-button ${cloudSyncStatus.uploading ? 'loading' : ''}`}
                onClick={handleBulkCloudSync}
                disabled={cloudSyncStatus.uploading || Object.values(savedGames).filter(game => !game.isPaused).length === 0}
              >
                {cloudSyncStatus.uploading ? (
                  <span className="share-spinner" aria-label="Syncing..." />
                ) : (
                  <CloudIcon size={18} />
                )}
                {cloudSyncStatus.uploading ? 'Uploading...' : 'Upload All to Cloud'}
              </button>
            )}
            <button className="settings-button danger-button" onClick={handleDeleteAllData}>
              <TrashIcon size={18} />
              Clear all Data
            </button>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-header">
            <h2>Saved Games</h2>
          </div>
          {Object.keys(savedGames).length > 0 ? (
            <div className="game-history">
              {Object.entries(savedGames).map(([gameId, game]) => (
                <div key={gameId} className={`game-card ${game.isImported ? 'imported-game' : ''}`}>
                  <div className="settings-card-content">
                    <div className="settings-card-header">
                      <div className="game-info">
                        <div className="game-winner">
                          {game.isPaused ? 'Paused Game' : 'Finished Game'}
                          
                        </div>                  
                        <div>Rounds: {game.gameState?.currentRound || game.gameState?.round_data?.length || "N/A"}</div>
                      </div>
                      <div className="game-players">
                        Players:{" "}
                        {game.gameState?.players 
                          ? game.gameState.players.map(player => player.name || "Unknown Player").join(", ")
                          : "No players"}
                      </div>
                      <div className="actions-game-history">
                        <div className="bottom-actions-game-history">
                          {(() => {
                            const syncStatus = gameSyncStatuses[gameId];
                            const status = syncStatus?.status || (game.isUploaded ? 'Synced' : 'Local');
                            const badgeClass = status.toLowerCase().replace(' ', '-');
                            return (
                              <span className={`mode-badge ${badgeClass}`}>
                                {status}
                              </span>
                            );
                          })()}
                          <div className="game-date">
                            {formatDate(game.lastPlayed)}
                          </div>
                        </div>
                      </div>
                      </div>
                    
                      <div className="settings-card-actions">
                        <button 
                          className={`delete-game-button${!isOnline ? ' offline' : ''}`}
                          onClick={() => handleDeleteGame(gameId)}
                          aria-label="Delete game"
                        >
                          <TrashIcon size={25} />
                        </button>
                        
                        {/* Conditionally show upload or share button based on sync status - only when app is online */}
                        {isOnline && (() => {
                          const syncStatus = gameSyncStatuses[gameId];
                          const status = syncStatus?.status || (game.isUploaded ? 'Synced' : 'Local');
                          const isGameSynced = status === 'Synced';
                          const needsUpload = status === 'Local';
                          if (isGameSynced) {
                            // Show share button for synced games
                            return (
                              <button 
                                className={`cloud-upload-game-button share-button ${sharingGames.has(gameId) ? 'sharing' : ''}`}
                                onClick={() => {
                                  console.debug('Share button clicked for gameId:', gameId);
                                  console.debug('Game object:', game);
                                  console.debug('Game object ID:', game.id);
                                  handleShareGame(gameId, game);
                                }}
                                aria-label={sharingGames.has(gameId) ? "Sharing..." : "Share game"}
                                disabled={game.isPaused || sharingGames.has(gameId)}
                                title={
                                  sharingGames.has(gameId) ? 'Creating share link...' :
                                  game.isPaused ? 'Cannot share paused games' : 
                                  'Share game'
                                }
                              >
                                {sharingGames.has(gameId) ? (
                                  <span className="share-spinner" aria-label="Sharing..." />
                                ) : (
                                  <ShareIcon size={25} />
                                )}
                              </button>
                            );
                          } else if (needsUpload) {
                            // Show upload button for local games
                            return (
                              <button 
                                className={`cloud-upload-game-button ${uploadingGames.has(gameId) ? 'uploading' : ''}`}
                                onClick={async () => {
                                  if (uploadingGames.has(gameId)) return; // Prevent double-click
                                  setUploadingGames(prev => new Set([...prev, gameId]));
                                  try {
                                    const result = await uploadSingleGameToCloud(gameId, game);
                                    if (result.isDuplicate) {
                                      setMessage({ text: `Game was already uploaded - marked as synced!`, type: 'success' });
                                    } else {
                                      setMessage({ text: `Game uploaded to cloud successfully!`, type: 'success' });
                                    }
                                    // Wait for loadSavedGames to finish before removing spinner
                                    await loadSavedGames();
                                  } catch (error) {
                                    setMessage({ text: `Upload failed: ${error.message}`, type: 'error' });
                                  } finally {
                                    setUploadingGames(prev => {
                                      const newSet = new Set(prev);
                                      newSet.delete(gameId);
                                      return newSet;
                                    });
                                  }
                                }}
                                aria-label={uploadingGames.has(gameId) ? "Uploading..." : "Upload to cloud"}
                                disabled={game.isPaused || uploadingGames.has(gameId)}
                                title={
                                  uploadingGames.has(gameId) ? 'Uploading game...' :
                                  game.isPaused ? 'Cannot upload paused games' : 
                                  'Upload to cloud'
                                }
                              >
                                {uploadingGames.has(gameId) ? (
                                  <span className="share-spinner" aria-label="Uploading..." />
                                ) : (
                                  <CloudIcon size={25} />
                                )}
                              </button>
                            );
                          }
                          return null;
                        })()}
                      </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-games">No saved games found.</p>
          )}
        </div>

        {/* App Info Section */}
        <div className="settings-section app-info-section" >
          <h3 className="settings-section-title">App Information</h3>
          <div className="settings-card info-card">
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Version:</span>
                <span className="info-value">{import.meta.env.VITE_APP_VERSION}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Build Date:</span>
                <span className="info-value">
                  {formatDate(import.meta.env.VITE_BUILD_DATE || new Date().toISOString())}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Account Section - Only show if user is logged in */}
        {user && (
          <div className="settings-section account-section">
            <h3 className="settings-section-title">Account</h3>
            <div className="settings-card">
              <div className="account-info">
                <div className="info-item">
                  <span className="info-label">Logged in as:</span>
                  <span className="info-value">{user.name || user.email}</span>
                </div>
              </div>
              <button 
                className="btn btn-danger logout-btn"
                onClick={handleLogout}
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        <DeleteConfirmationModal
          isOpen={showConfirmDialog}
          onClose={() => setShowConfirmDialog(false)}
          onConfirm={handleConfirmDelete}
          deleteAll={deleteAll}
        />
      </div>
  );
};

export default Settings;
