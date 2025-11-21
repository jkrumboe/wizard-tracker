"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '@/shared/hooks/useTheme';
import { useUser } from '@/shared/hooks/useUser';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { LocalGameStorage, LocalTableGameStorage } from '@/shared/api';
import { ShareValidator } from '@/shared/utils/shareValidator';
import { TrashIcon, RefreshIcon, CloudIcon, ShareIcon, LogOutIcon, FilterIcon, UsersIcon } from '@/components/ui/Icon';
import DeleteConfirmationModal from '@/components/modals/DeleteConfirmationModal';
import CloudGameSelectModal from '@/components/modals/CloudGameSelectModal';
import GameFilterModal from '@/components/modals/GameFilterModal';
import authService from '@/shared/api/authService';
import avatarService from '@/shared/api/avatarService';
import defaultAvatar from "@/assets/default-avatar.png";
import { checkGameSyncStatus } from '@/shared/utils/syncChecker';
import { shareGame } from '@/shared/utils/gameSharing';
import { createSharedGameRecord } from '@/shared/api/sharedGameService';
import { filterGames, getDefaultFilters, hasActiveFilters } from '@/shared/utils/gameFilters';
import '@/styles/pages/settings.css';

const Settings = () => {
  const navigate = useNavigate();
  const [savedGames, setSavedGames] = useState({});
  const [savedTableGames, setSavedTableGames] = useState([]);
  const [totalStorageSize, setTotalStorageSize] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [gameToDelete, setGameToDelete] = useState(null);
  const [deleteAll, setDeleteAll] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [cloudSyncStatus, setCloudSyncStatus] = useState({ uploading: false, progress: '', uploadedCount: 0, totalCount: 0 });
  const [uploadingGames, setUploadingGames] = useState(new Set()); // Track which games are currently uploading
  const [gameSyncStatuses, setGameSyncStatuses] = useState({}); // Track sync status for each game
  const [sharingGames, setSharingGames] = useState(new Set()); // Track which games are currently being shared
  const [showCloudGameSelectModal, setShowCloudGameSelectModal] = useState(false); // Cloud game select modal
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatar); // Avatar URL state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState(getDefaultFilters());
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);
  const { theme, toggleTheme, useSystemTheme, setUseSystemTheme } = useTheme();
  const { user, clearUserData } = useUser();
  const { isOnline } = useOnlineStatus();

  // Convert saved games object to array and apply filters
  const filteredGames = useMemo(() => {
    const gamesArray = Object.entries(savedGames).map(([id, game]) => ({
      ...game,
      id
    }));
    return filterGames(gamesArray, filters);
  }, [savedGames, filters]);

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
  };

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
    // Only load games if user is logged in
    if (user) {
      loadSavedGames();
      calculateStorageUsage();
    } else {
      // Clear games when user logs out
      setSavedGames({});
      setSavedTableGames([]);
      setGameSyncStatuses({});
    }
    
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
  }, [user]); // Re-run when user changes (login/logout)

  // Load user avatar when user is available
  useEffect(() => {
    const loadAvatarUrl = async () => {
      if (user && isOnline) {
        try {
          const url = await avatarService.getAvatarUrl()
          setAvatarUrl(url)
        } catch (error) {
          console.error('Error loading avatar:', error)
          setAvatarUrl(defaultAvatar)
        }
      } else {
        setAvatarUrl(defaultAvatar)
      }
    }

    loadAvatarUrl()

    // Listen for avatar updates
    const handleAvatarUpdate = () => {
      loadAvatarUrl()
    }

    window.addEventListener('avatarUpdated', handleAvatarUpdate)

    return () => {
      window.removeEventListener('avatarUpdated', handleAvatarUpdate)
    }
  }, [user, isOnline])

  const loadSavedGames = useCallback(async () => {
    // First migrate games to ensure they have upload tracking properties
    LocalGameStorage.migrateGamesForUploadTracking();
    LocalTableGameStorage.migrateGamesForUploadTracking();
    
    const allGames = LocalGameStorage.getAllSavedGames();
    setSavedGames(allGames);
    
    // Load table games
    const tableGames = LocalTableGameStorage.getSavedTableGamesList();
    setSavedTableGames(tableGames);
    
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
  // Removed redundant reload on every render

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

  const formatStorageSize = (sizeInKB) => {
    if (sizeInKB < 1024) {
      return `${sizeInKB.toFixed(2)} KB`;
    } else if (sizeInKB < 1024 * 1024) {
      return `${(sizeInKB / 1024).toFixed(2)} MB`;
    } else {
      return `${(sizeInKB / (1024 * 1024)).toFixed(2)} GB`;
    }
  };

  const handleDeleteGame = (gameId, isTableGame = false) => {
    setGameToDelete({ id: gameId, isTableGame });
    setDeleteAll(false);
    setShowConfirmDialog(true);
  };

  const handleConfirmDelete = () => {
    if (deleteAll) {
      // Clear all localStorage data
      localStorage.clear();
      setSavedGames({});
      setSavedTableGames([]);
      setTotalStorageSize(0);
      setMessage({ text: 'All local storage data has been cleared.', type: 'success' });
    } else if (gameToDelete) {
      // Delete specific game
      if (gameToDelete.isTableGame) {
        LocalTableGameStorage.deleteTableGame(gameToDelete.id);
      } else {
        LocalGameStorage.deleteGame(gameToDelete.id);
      }
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
      // Then logout from backend
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

  const handleCheckForUpdates = async () => {
    if (!('serviceWorker' in navigator)) {
      setMessage({ text: 'Service Worker not supported in this browser', type: 'error' });
      return;
    }

    setCheckingForUpdates(true);
    setMessage({ text: 'Checking for updates...', type: 'info' });

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (!registration) {
        setCheckingForUpdates(false);
        setMessage({ text: 'No service worker registered', type: 'error' });
        return;
      }

      // Force an update check
      await registration.update();

      // Wait a bit to see if an update is found
      setTimeout(() => {
        if (registration.waiting) {
          // Update is available and waiting
          setCheckingForUpdates(false);
          setMessage({ 
            text: '✅ Update available! The page will reload to apply the update.', 
            type: 'success' 
          });
          
          // Send message to service worker to skip waiting
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          
          // Reload the page after a short delay
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else if (registration.installing) {
          // Update is installing
          setCheckingForUpdates(false);
          setMessage({ 
            text: '📥 Update is being installed...', 
            type: 'info' 
          });
        } else {
          // No update available
          setCheckingForUpdates(false);
          setMessage({ 
            text: '✅ You are running the latest version!', 
            type: 'success' 
          });
        }
      }, 2000);
    } catch (error) {
      console.error('Error checking for updates:', error);
      setCheckingForUpdates(false);
      setMessage({ 
        text: 'Failed to check for updates. Please try again later.', 
        type: 'error' 
      });
    }
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
    // Check authentication before attempting upload
    const token = localStorage.getItem('auth_token');
    if (!token) {
      // Navigate to login page
      navigate('/login');
      return { success: false, error: 'You must be logged in to upload games to the cloud. Please sign in and try again.', requiresAuth: true };
    }

    // Prevent uploading if already uploaded
    if (LocalGameStorage.isGameUploaded(gameId)) {
      return { success: false, error: 'Game already uploaded', isDuplicate: true };
    }
    try {
      const { createGame } = await import('@/shared/api/gameService');
      const result = await createGame(gameData, gameId);
      if (result.duplicate) {
        // Mark as uploaded with existing cloud ID
        LocalGameStorage.markGameAsUploaded(gameId, result.game.id);
        if (typeof loadSavedGames === 'function') await loadSavedGames();
        if (typeof window !== 'undefined') {
          const { checkAllGamesSyncStatus } = await import('@/shared/utils/syncChecker');
          const syncStatuses = await checkAllGamesSyncStatus();
          setGameSyncStatuses(syncStatuses);
        }
        return { success: true, isDuplicate: true, cloudGameId: result.game.id };
      } else {
        LocalGameStorage.markGameAsUploaded(gameId, result.game.id);
        if (typeof loadSavedGames === 'function') await loadSavedGames();
        if (typeof window !== 'undefined') {
          const { checkAllGamesSyncStatus } = await import('@/shared/utils/syncChecker');
          const syncStatuses = await checkAllGamesSyncStatus();
          setGameSyncStatuses(syncStatuses);
        }
        return { success: true, cloudGameId: result.game.id };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Upload single table game to cloud
  const uploadSingleTableGameToCloud = async (gameId, gameData) => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate('/login');
      return { success: false, error: 'You must be logged in to upload table games to the cloud. Please sign in and try again.', requiresAuth: true };
    }

    // Prevent uploading if already uploaded
    if (LocalTableGameStorage.isGameUploaded(gameId)) {
      return { success: false, error: 'Table game already uploaded', isDuplicate: true };
    }

    try {
      const { createTableGame } = await import('@/shared/api/tableGameService');
      const result = await createTableGame(gameData, gameId);
      
      if (result.duplicate) {
        LocalTableGameStorage.markGameAsUploaded(gameId, result.game._id);
        await loadSavedGames();
        return { success: true, isDuplicate: true, cloudGameId: result.game._id };
      } else {
        LocalTableGameStorage.markGameAsUploaded(gameId, result.game._id);
        await loadSavedGames();
        return { success: true, cloudGameId: result.game._id };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Share Game Function
  const handleShareGame = async (gameId, gameData) => {
    console.debug('handleShareGame called with gameId:', gameId, 'gameData:', gameData);
    
    if (!isOnline) {
      setMessage({ text: 'Cannot share games while in offline mode', type: 'error' });
      return;
    }

    // Check authentication before attempting to share
    const token = localStorage.getItem('auth_token');
    if (!token) {
      // Navigate to login page
      navigate('/login');
      return;
    }
    
    if (gameData.isPaused) {
      setMessage({ text: 'Cannot share paused games. Please finish the game first.', type: 'error' });
      return;
    }

    // Check if this is an imported shared game - prevent re-sharing to avoid confusion
    if (gameData.isImported || gameData.isShared || gameData.originalGameId) {
      setMessage({ text: 'Cannot share imported games. This game was already shared by someone else.', type: 'error' });
      return;
    }

    let syncStatus = gameSyncStatuses[gameId];
    let isGameOnline = syncStatus?.status === 'Online' || syncStatus?.status === 'Synced';

    // If not synced, upload first using the new backend sync
    if (!isGameOnline) {
      try {
        const { ensureGameSynced } = await import('@/shared/utils/ensureGameSynced');
        const syncSuccess = await ensureGameSynced(gameId, gameData, setMessage);
        
        if (!syncSuccess) {
          setMessage({ text: 'Failed to sync game to backend before sharing.', type: 'error' });
          return;
        }
        
        // Force reload sync status after upload
        if (typeof loadSavedGames === 'function') await loadSavedGames();
        if (typeof window !== 'undefined') {
          const { checkAllGamesSyncStatus } = await import('@/shared/utils/syncChecker');
          const syncStatuses = await checkAllGamesSyncStatus();
          setGameSyncStatuses(syncStatuses);
          console.debug('[SyncDebug] Updated sync statuses after share upload:', syncStatuses);
        }
        // Update syncStatus after upload
        syncStatus = gameSyncStatuses[gameId];
        isGameOnline = syncStatus?.status === 'Online' || syncStatus?.status === 'Synced';
      } catch (error) {
        setMessage({ text: `Failed to sync game before sharing: ${error.message}`, type: 'error' });
        console.error('[SyncDebug] Failed to sync before sharing:', error);
        return;
      }
    }

    if (!isGameOnline) {
      setMessage({ text: 'Game must be uploaded to backend before sharing.', type: 'error' });
      console.warn('[SyncDebug] Tried to share but game is not online:', syncStatus);
      return;
    }

    setSharingGames(prev => new Set([...prev, gameId]));
    try {
      // Use cloudGameId for sharing if available, else fallback to local gameId
      let idToShare = gameData.cloudGameId || gameData.id || gameId;
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

    // Check authentication before attempting bulk upload
    const token = localStorage.getItem('auth_token');
    if (!token) {
      // Navigate to login page
      navigate('/login');
      return;
    }
    
    // Get wizard games
    const gameEntries = Object.entries(savedGames);
    const uploadableGames = gameEntries.filter(([, game]) => !game.isPaused);
    
    // Get table games
    const allTableGames = LocalTableGameStorage.getAllSavedTableGames();
    const tableGameEntries = Object.entries(allTableGames);
    const uploadableTableGames = tableGameEntries.filter(([, game]) => 
      game.gameFinished && !LocalTableGameStorage.isGameUploaded(game.id)
    );
    
    const totalUploadable = uploadableGames.length + uploadableTableGames.length;
    
    if (totalUploadable === 0) {
      setMessage({ text: 'No games available for upload.', type: 'error' });
      return;
    }

    setCloudSyncStatus({ 
      uploading: true, 
      progress: 'Starting upload...', 
      uploadedCount: 0, 
      totalCount: totalUploadable 
    });

    let successful = 0;
    let failed = 0;
    const errors = [];

    try {
      // Upload wizard games
      for (let i = 0; i < uploadableGames.length; i++) {
        const [gameId, gameData] = uploadableGames[i];
        
        setCloudSyncStatus(prev => ({
          ...prev,
          progress: `Uploading wizard game ${i + 1} of ${uploadableGames.length}...`,
          uploadedCount: successful
        }));

        try {
          await uploadSingleGameToCloud(gameId, gameData);
          successful++;
        } catch (error) {
          failed++;
          errors.push(`Wizard Game ${gameId}: ${error.message}`);
        }
      }

      // Upload table games
      for (let i = 0; i < uploadableTableGames.length; i++) {
        const [gameId, gameData] = uploadableTableGames[i];
        
        setCloudSyncStatus(prev => ({
          ...prev,
          progress: `Uploading table game ${i + 1} of ${uploadableTableGames.length}...`,
          uploadedCount: successful
        }));

        try {
          await uploadSingleTableGameToCloud(gameId, gameData);
          successful++;
        } catch (error) {
          failed++;
          errors.push(`Table Game ${gameId}: ${error.message}`);
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

  const handleDownloadCloudGames = () => {
    if (!isOnline) {
      setMessage({ text: 'Cannot download games while in offline mode', type: 'error' });
      return;
    }

    // Check authentication
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Open the cloud game select modal
    setShowCloudGameSelectModal(true);
  };

  const handleDownloadSelectedGames = async (selectedGameIds) => {
    setCloudSyncStatus({ 
      uploading: true, 
      progress: 'Downloading selected games...', 
      uploadedCount: 0, 
      totalCount: selectedGameIds.length
    });

    try {
      const { downloadSelectedCloudGames } = await import('@/shared/api/gameService');
      const result = await downloadSelectedCloudGames(selectedGameIds);

      setCloudSyncStatus({ 
        uploading: false, 
        progress: '', 
        uploadedCount: 0, 
        totalCount: 0 
      });

      // Refresh the saved games list
      loadSavedGames();

      if (result.downloaded > 0) {
        setMessage({ 
          text: `✅ Downloaded ${result.downloaded} games from cloud! (${result.skipped} already existed locally)`, 
          type: 'success' 
        });
      } else if (result.skipped > 0) {
        setMessage({ 
          text: `All ${result.skipped} selected games already exist locally`, 
          type: 'info' 
        });
      } else {
        setMessage({ 
          text: 'No games were downloaded', 
          type: 'info' 
        });
      }
    } catch (error) {
      setCloudSyncStatus({ 
        uploading: false, 
        progress: '', 
        uploadedCount: 0, 
        totalCount: 0 
      });
      setMessage({ text: `Download failed: ${error.message}`, type: 'error' });
      console.error('Download error:', error);
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
          {/* Profile Picture Section */}
          {isOnline && (
            <div className="settings-option">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <Link to={user ? "/profile" : "/login"} style={{ textDecoration: 'none' }}>
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        cursor: 'pointer',
                        border: '1px solid var(--primary-color)'
                      }}
                    />
                  </Link>
                  <div>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>{user?.username || 'Guest'}</p>
                    <Link 
                      to={user ? "/profile/edit" : "/login"}
                      style={{ fontSize: '14px', color: 'var(--primary-color)' }}
                    >
                      {user ? 'Edit Profile' : 'Login'}
                    </Link>
                  </div>
                </div>
                {user && (
                  <button
                    onClick={handleLogout}
                    style={{
                      background: 'none',
                      cursor: 'pointer',
                      padding: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--error-color)',
                      border: '1px solid var(--error-color)',
                    }}
                    title="Sign Out"
                    aria-label="Sign Out"
                  >
                    <LogOutIcon size={24} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Theme Toggle Section */}
          <div className="settings-option">
            <label className="checkbox-label">
              <input 
                type="checkbox"
                checked={useSystemTheme} 
                onChange={handleThemeModeChange}
                style={{ 
                    width: '15px', 
                    height: '15px',
                    cursor: 'pointer',
                    justifySelf: 'center',
                    alignSelf: 'center'
                  }}
              />
              <span> Use system theme preference</span>
            </label>
          </div>

          {!useSystemTheme && (
            <>
              <div className="settings-option" style={{ marginBottom: 'var(--spacing-sm)' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                </div>
              </div>

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
            </>
          )}
        </div>

        <div className="settings-section">
          {/* <h2>Storage{isOnline ? ' & Cloud Sync' : ''}</h2> */}
          
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
                <span className="storage-value">{formatStorageSize(totalStorageSize)}</span>
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
            {isOnline && user && (
              <div className="cloud-sync-actions">
                <button 
                  className={`settings-button cloud-sync-button ${cloudSyncStatus.uploading ? 'loading' : ''}`}
                  onClick={handleBulkCloudSync}
                  disabled={
                    cloudSyncStatus.uploading || 
                    (
                      // Check wizard games
                      Object.values(savedGames).filter(game => !game.isPaused).length === 0 &&
                      // Check table games
                      savedTableGames.filter(game => game.gameFinished && !LocalTableGameStorage.isGameUploaded(game.id)).length === 0
                    ) ||
                    (
                      // All wizard games are synced
                      Object.entries(savedGames)
                        .filter(([, game]) => !game.isPaused)
                        .every(([gameId]) => gameSyncStatuses[gameId]?.status === 'Synced') &&
                      // All table games are synced
                      savedTableGames.every(game => LocalTableGameStorage.isGameUploaded(game.id) || !game.gameFinished)
                    )
                  }
                >
                  {cloudSyncStatus.uploading ? (
                    <span className="share-spinner" aria-label="Syncing..." />
                  ) : (
                    <CloudIcon size={18} />
                  )}
                  {cloudSyncStatus.uploading ? 'Uploading...' : 'Upload All'}
                </button>
                <button 
                  className={`settings-button cloud-sync-button ${cloudSyncStatus.uploading ? 'loading' : ''}`}
                  onClick={handleDownloadCloudGames}
                  disabled={cloudSyncStatus.uploading}
                >
                  {cloudSyncStatus.uploading ? (
                    <span className="share-spinner" aria-label="Downloading..." />
                  ) : (
                    <CloudIcon size={18} />
                  )}
                  {cloudSyncStatus.uploading ? 'Downloading...' : 'Download'}
                </button>
              </div>
            )}
            {isOnline && !user && (
              <button 
                className="settings-button cloud-sync-button"
                onClick={() => navigate('/login')}
              >
                <CloudIcon size={18} />
                Sign In to Upload Games
              </button>
            )}
            <button className="settings-button danger-button" onClick={handleDeleteAllData}>
              <TrashIcon size={18} />
              Clear all Data
            </button>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-header" >
            <h2>Saved Games</h2>
            <button 
              className="filter-button"
              onClick={() => setShowFilterModal(true)}
              aria-label="Filter games"
              style={{
                background: 'var(--primary-color)',
                color: 'var(--text-white)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                position: 'relative'
              }}
            >
              <FilterIcon size={20} />
              {hasActiveFilters(filters) && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '12px',
                  height: '12px',
                  background: 'var(--danger-color, red)',
                  borderRadius: '50%',
                  border: '2px solid var(--card-background)'
                }} />
              )}
            </button>
          </div>
          {filteredGames.length > 0 ? (
            <div className="game-history">
              {filteredGames.map((game) => (
                <div key={game.id} className={`game-card ${game.isImported ? 'imported-game' : ''}`}>
                  <div className="settings-card-content">
                    <div className="settings-card-header">
                      <div className="game-info">
                        <div className="game-name">
                          Wizard
                          {game.isPaused ? ' | Paused' : ''}
                        </div>
                        {(() => {
                            const syncStatus = gameSyncStatuses[game.id];
                            const status = syncStatus?.status || (game.isUploaded ? 'Synced' : 'Local');
                            const badgeClass = status.toLowerCase().replace(' ', '-');
                            return (
                              <span className={`mode-badge ${badgeClass}`}>
                                {status}
                              </span>
                            );
                          })()}              
                      </div>
                      <div className="game-players">
                        <UsersIcon size={12} />{" "}
                        {game.gameState?.players 
                          ? game.gameState.players.map(player => player.name || "Unknown Player").join(", ")
                          : "No players"}
                      </div>
                      <div className="actions-game-history">
                        <div className="bottom-actions-game-history">
                          <div className="game-rounds">Rounds: {game.gameState?.currentRound || game.gameState?.round_data?.length || "N/A"}</div>
                          <div className="game-date">
                            {formatDate(game.lastPlayed)}
                          </div>
                        </div>
                      </div>
                      </div>
                    
                      <div className="settings-card-actions">
                        <button 
                          className={`delete-game-button${!isOnline ? ' offline' : ''}`}
                          onClick={() => handleDeleteGame(game.id)}
                          aria-label="Delete game"
                        >
                          <TrashIcon size={25} />
                        </button>
                        
                        {/* Conditionally show upload or share button based on sync status - only when app is online */}
                        {isOnline && (() => {
                          const syncStatus = gameSyncStatuses[game.id];
                          const status = syncStatus?.status || (game.isUploaded ? 'Synced' : 'Local');
                          const isGameSynced = status === 'Synced';
                          const needsUpload = status === 'Local';
                          const isImportedGame = game.isImported || game.isShared || game.originalGameId;
                          
                          if (isGameSynced && !isImportedGame) {
                            // Show share button for synced games that are not imported
                            return (
                              <button 
                                className={`cloud-upload-game-button share-button ${sharingGames.has(game.id) ? 'sharing' : ''}`}
                                onClick={() => {
                                  // Check authentication and navigate to login if needed
                                  if (!user) {
                                    navigate('/login');
                                    return;
                                  }
                                  handleShareGame(game.id, game);
                                }}
                                aria-label={sharingGames.has(game.id) ? "Sharing..." : "Share game"}
                                disabled={game.isPaused || sharingGames.has(game.id)}
                                title={
                                  sharingGames.has(game.id) ? 'Creating share link...' :
                                  game.isPaused ? 'Cannot share paused games' :
                                  !user ? 'Click to sign in and share games' :
                                  'Share game'
                                }
                              >
                                {sharingGames.has(game.id) ? (
                                  <span className="share-spinner" aria-label="Sharing..." />
                                ) : (
                                  <ShareIcon size={25} />
                                )}
                              </button>
                            );
                          } else if (isGameSynced && isImportedGame) {
                            // Show a disabled button with tooltip for imported games
                            return (
                              <button 
                                className="cloud-upload-game-button share-button disabled"
                                disabled={true}
                                title="Imported games cannot be shared"
                                aria-label="Cannot share imported game"
                              >
                                <ShareIcon size={25} />
                              </button>
                            );
                          } else if (needsUpload && !isImportedGame) {
                            // Show upload button for local games that are not imported
                            const isUploaded = LocalGameStorage.isGameUploaded(game.id);
                            return (
                              <button 
                                className={`cloud-upload-game-button ${uploadingGames.has(game.id) ? 'uploading' : ''} ${game.isPaused || isUploaded ? 'disabled' : ''}`}
                                onClick={async () => {
                                  if (uploadingGames.has(game.id) || isUploaded) return; // Prevent double-click or duplicate upload
                                  
                                  // Check authentication and navigate to login if needed
                                  if (!user) {
                                    navigate('/login');
                                    return;
                                  }
                                  
                                  setUploadingGames(prev => new Set([...prev, game.id]));
                                  try {
                                    const result = await uploadSingleGameToCloud(game.id, game);
                                    setMessage({ text: result.isDuplicate ? `Game was already uploaded - marked as synced!` : `Game uploaded to cloud successfully!`, type: 'success' });
                                    // Only reload local state and sync status once
                                    await loadSavedGames();
                                  } catch (error) {
                                    setMessage({ text: `Upload failed: ${error.message}`, type: 'error' });
                                  } finally {
                                    setUploadingGames(prev => {
                                      const newSet = new Set(prev);
                                      newSet.delete(game.id);
                                      return newSet;
                                    });
                                  }
                                }}
                                aria-label={uploadingGames.has(game.id) ? "Uploading..." : "Upload to cloud"}
                                disabled={game.isPaused || uploadingGames.has(game.id) || isUploaded}
                                title={
                                  uploadingGames.has(game.id) ? 'Uploading game...' :
                                  isUploaded ? 'Already uploaded' :
                                  game.isPaused ? 'Cannot upload paused games' :
                                  !user ? 'Click to sign in and upload to cloud' :
                                  'Upload to cloud'
                                }
                              >
                                {uploadingGames.has(game.id) ? (
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
          ) : Object.keys(savedGames).length > 0 ? (
            <p className="no-games">No games match your filters.</p>
          ) : (
            <p className="no-games">No saved games found.</p>
          )}
        </div>

        {/* Table Games Section */}
        <div className="settings-section">
          <div className="section-header">
            <h2>Table Games</h2>
          </div>
          {savedTableGames.length > 0 ? (
            <div className="game-history">
              {savedTableGames.map((game) => {
                const isUploaded = LocalTableGameStorage.isGameUploaded(game.id);
                
                return (
                <div key={game.id} className="game-card table-game-card">
                  <div className="settings-card-content">
                    <div className="settings-card-header">
                      <div className="game-info">
                        <div className="game-name">
                          {game.name}
                        </div>
                          {isUploaded && (
                            <span className="mode-badge synced" title="Synced to Cloud">
                              Synced
                            </span>
                          )}
                          {!isUploaded && (
                            <span className="mode-badge table">
                              Local
                            </span>
                          )}               
                      </div>
                      <div className="game-players">
                        <UsersIcon size={12} />{" "}
                        {game.players.join(", ")}
                      </div>
                      <div className="actions-game-history">
                        <div className="bottom-actions-game-history">
                          <div>Rounds: {game.totalRounds}</div>
                          <div className="game-date">
                            {formatDate(game.lastPlayed)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="settings-card-actions">
                      <button 
                        className="delete-game-button"
                        id='table'
                        onClick={() => handleDeleteGame(game.id, true)}
                        aria-label="Delete table game"
                      >
                        <TrashIcon size={25} />
                      </button>
                      
                      {/* Upload button for table games */}
                      {isOnline && !isUploaded && game.gameFinished && (
                        <button 
                          className={`cloud-upload-game-button ${uploadingGames.has(game.id) ? 'uploading' : ''}`}
                          onClick={async () => {
                            if (uploadingGames.has(game.id)) return;
                            
                            if (!user) {
                              navigate('/login');
                              return;
                            }
                            
                            setUploadingGames(prev => new Set([...prev, game.id]));
                            try {
                              const fullGame = LocalTableGameStorage.getAllSavedTableGames()[game.id];
                              const result = await uploadSingleTableGameToCloud(game.id, fullGame);
                              setMessage({ 
                                text: result.isDuplicate 
                                  ? 'Table game was already uploaded - marked as synced!' 
                                  : 'Table game uploaded to cloud successfully!', 
                                type: 'success' 
                              });
                              await loadSavedGames();
                            } catch (error) {
                              setMessage({ text: `Upload failed: ${error.message}`, type: 'error' });
                            } finally {
                              setUploadingGames(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(game.id);
                                return newSet;
                              });
                            }
                          }}
                          aria-label={uploadingGames.has(game.id) ? "Uploading..." : "Upload to cloud"}
                          disabled={uploadingGames.has(game.id)}
                          title={
                            uploadingGames.has(game.id) ? 'Uploading table game...' :
                            !game.gameFinished ? 'Cannot upload unfinished table games' :
                            !user ? 'Click to sign in and upload to cloud' :
                            'Upload to cloud'
                          }
                        >
                          {uploadingGames.has(game.id) ? (
                            <span className="share-spinner" aria-label="Uploading..." />
                          ) : (
                            <CloudIcon size={25} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <p className="no-games">No table games found.</p>
          )}
        </div>

        {/* App Info Section */}
        <div className="settings-section app-info-section" >
          <h3 className="settings-section-title">App Information
            <button 
              className={`settings-button-update`}
              onClick={handleCheckForUpdates}
              disabled={checkingForUpdates}
              title="Check for app updates"
            >
              <RefreshIcon size={18} />Check for Updates
            </button>
          </h3>
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

        <DeleteConfirmationModal
          isOpen={showConfirmDialog}
          onClose={() => setShowConfirmDialog(false)}
          onConfirm={handleConfirmDelete}
          deleteAll={deleteAll}
        />

        <CloudGameSelectModal
          isOpen={showCloudGameSelectModal}
          onClose={() => setShowCloudGameSelectModal(false)}
          onDownload={handleDownloadSelectedGames}
        />

        <GameFilterModal
          isOpen={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          onApplyFilters={handleApplyFilters}
          initialFilters={filters}
        />
      </div>
  );
};

export default Settings;
