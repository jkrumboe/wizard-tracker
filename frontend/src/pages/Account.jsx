"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '@/shared/hooks/useTheme';
import { useUser } from '@/shared/hooks/useUser';
import { sanitizeImageUrl } from '@/shared/utils/urlSanitizer';
import { LocalGameStorage, LocalTableGameStorage } from '@/shared/api';
import { ShareValidator } from '@/shared/utils/shareValidator';
import { TrashIcon, RefreshIcon, CloudIcon, LogOutIcon, FilterIcon, UsersIcon, TrophyIcon, BarChartIcon } from '@/components/ui/Icon';
import DeleteConfirmationModal from '@/components/modals/DeleteConfirmationModal';
import CloudGameSelectModal from '@/components/modals/CloudGameSelectModal';
import GameFilterModal from '@/components/modals/GameFilterModal';
import { SwipeableGameCard } from '@/components/common';
import authService from '@/shared/api/authService';
import avatarService from '@/shared/api/avatarService';
import defaultAvatar from "@/assets/default-avatar.png";
import { batchCheckGamesSyncStatus } from '@/shared/utils/syncChecker';
import { shareGame } from '@/shared/utils/gameSharing';
import { createSharedGameRecord } from '@/shared/api/sharedGameService';
import { filterGames, getDefaultFilters, hasActiveFilters } from '@/shared/utils/gameFilters';
import PerformanceStatsEnhanced from '@/pages/profile/PerformanceStatsEnhanced';
import '@/styles/pages/account.css';

const Account = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview'); // overview, stats, games
  const [statsGameType, setStatsGameType] = useState('all'); // all, wizard, or specific table game type
  const [savedGames, setSavedGames] = useState({});
  const [savedTableGames, setSavedTableGames] = useState([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [gameToDelete, setGameToDelete] = useState(null);
  const [deleteAll, setDeleteAll] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [cloudSyncStatus, setCloudSyncStatus] = useState({ uploading: false, progress: '', uploadedCount: 0, totalCount: 0 });
  const [uploadingGames, setUploadingGames] = useState(new Set()); // Track which games are currently uploading
  const [gameSyncStatuses, setGameSyncStatuses] = useState({}); // Track sync status for each game
  const [syncStatusLoaded, setSyncStatusLoaded] = useState(false); // Track if sync status has been checked
  const [sharingGames, setSharingGames] = useState(new Set()); // Track which games are currently being shared
  const [showCloudGameSelectModal, setShowCloudGameSelectModal] = useState(false); // Cloud game select modal
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatar); // Avatar URL state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState(getDefaultFilters());
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);
  const [forcingUpdate, setForcingUpdate] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(() => {
    const saved = localStorage.getItem('autoUpdate');
    return saved !== null ? saved === 'true' : true; // Default to true
  });
  const { theme, toggleTheme, useSystemTheme, setUseSystemTheme } = useTheme();
  const { user, clearUserData } = useUser();

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
    const urlParams = new URLSearchParams(globalThis.location.search);
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
        globalThis.history.replaceState({}, document.title, globalThis.location.pathname);
        return;
      }
      
      try {
        const success = LocalGameStorage.importGames(JSON.stringify(validation.data));
        if (success) {
          loadSavedGames();
          setMessage({ text: 'Games imported successfully from shared link!', type: 'success' });
        } else {
          setMessage({ text: 'Failed to import games from shared link.', type: 'error' });
        }
      } catch (error) {
        console.error('Error importing games from URL:', error);
        setMessage({ text: 'Failed to process shared link data.', type: 'error' });
      }
      
      globalThis.history.replaceState({}, document.title, globalThis.location.pathname);
    } else if (importGameParam) {
      // Handle single game import with security validation
      const validation = ShareValidator.validateEncodedGameData(importGameParam);
      
      if (!validation.isValid) {
        setMessage({ 
          text: `Invalid shared link: ${validation.error}`, 
          type: 'error' 
        });
        globalThis.history.replaceState({}, document.title, globalThis.location.pathname);
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
          setMessage({ text: 'Game imported successfully from shared link!', type: 'success' });
        } else {
          setMessage({ text: 'Failed to import game from shared link.', type: 'error' });
        }
      } catch (error) {
        console.error('Error importing game from URL:', error);
        setMessage({ text: 'Failed to process shared link data.', type: 'error' });
      }
      
      globalThis.history.replaceState({}, document.title, globalThis.location.pathname);
    } else if (shareKeyParam) {
      // Handle share key import (for large data) with security validation
      
      // First validate the share key format
      if (!ShareValidator.isValidShareKey(shareKeyParam)) {
        setMessage({ 
          text: 'Invalid share link format.', 
          type: 'error' 
        });
        globalThis.history.replaceState({}, document.title, globalThis.location.pathname);
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
          globalThis.history.replaceState({}, document.title, globalThis.location.pathname);
          return;
        }
        
        // Check if expired
        if (expirationTime && Date.now() > parseInt(expirationTime)) {
          localStorage.removeItem(shareKeyParam);
          localStorage.removeItem(shareKeyParam + '_expires');
          setMessage({ text: 'Shared game link has expired.', type: 'error' });
          globalThis.history.replaceState({}, document.title, globalThis.location.pathname);
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
          globalThis.history.replaceState({}, document.title, globalThis.location.pathname);
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
          globalThis.history.replaceState({}, document.title, globalThis.location.pathname);
          return;
        }
        
        const success = LocalGameStorage.importGames(JSON.stringify(validation.data));
        
        if (success) {
          loadSavedGames();
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
      
      globalThis.history.replaceState({}, document.title, globalThis.location.pathname);
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
    } else {
      // Clear games when user logs out
      setSavedGames({});
      setSavedTableGames([]);
      setGameSyncStatuses({});
      setSyncStatusLoaded(false); // Reset sync status loaded flag
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
      if (user) {
        try {
          // Preload avatar (loads thumbnail first, then full image)
          await avatarService.preloadAvatar();
          // Get full avatar for display
          const url = await avatarService.getAvatarUrl(false);
          setAvatarUrl(url);
        } catch (error) {
          console.error('Error loading avatar:', error);
          setAvatarUrl(defaultAvatar);
        }
      } else {
        setAvatarUrl(defaultAvatar);
      }
    };

    loadAvatarUrl();

    // Listen for avatar updates
    const handleAvatarUpdate = () => {
      loadAvatarUrl();
    };

    globalThis.addEventListener('avatarUpdated', handleAvatarUpdate);

    return () => {
      globalThis.removeEventListener('avatarUpdated', handleAvatarUpdate);
    };
  }, [user]);

  const loadSavedGames = useCallback(async () => {
    // First migrate games to ensure they have upload tracking properties
    LocalGameStorage.migrateGamesForUploadTracking();
    LocalTableGameStorage.migrateGamesForUploadTracking();
    
    const allGames = LocalGameStorage.getAllSavedGames();
    setSavedGames(allGames);
    
    // Load table games
    const tableGames = LocalTableGameStorage.getSavedTableGamesList();
    setSavedTableGames(tableGames);
    
    // Check sync status if user is logged in - do it in background with delay to avoid rate limiting
    if (user) {
      // Verify table games asynchronously with delay between requests
      setTimeout(async () => {
        const { getTableGameById } = await import('@/shared/api/tableGameService');
        for (let i = 0; i < tableGames.length; i++) {
          const game = tableGames[i];
          if (game.isUploaded && game.cloudGameId) {
            try {
              // Add small delay between requests to avoid rate limiting
              if (i > 0) await new Promise(resolve => setTimeout(resolve, 200));
              
              await getTableGameById(game.cloudGameId);
              // Game exists on server, keep upload status
            } catch (error) {
              // Game doesn't exist on server anymore, clear upload status
              const isNotFound = error.message.includes('not found') || 
                                error.message.includes('404') ||
                                error.message.includes('Not Found');
              if (isNotFound) {
                console.debug(`[Settings] Table game ${game.id} not found on server, clearing upload status`);
                LocalTableGameStorage.clearUploadStatus(game.id);
                // Reload games to reflect changes
                const updatedTableGames = LocalTableGameStorage.getSavedTableGamesList();
                setSavedTableGames(updatedTableGames);
              } else {
                console.debug(`[Settings] Error checking table game ${game.id}:`, error.message);
              }
            }
          }
        }
      }, 1000); // Wait 1 second before starting verification
      
      // Check sync status for wizard games in background using batch API
      setTimeout(async () => {
        try {
          const gameIds = Object.keys(allGames);
          if (gameIds.length > 0) {
            const syncStatuses = await batchCheckGamesSyncStatus(gameIds);
            setGameSyncStatuses(syncStatuses);
            setSyncStatusLoaded(true); // Mark sync status as loaded
          } else {
            setSyncStatusLoaded(true); // No games, mark as loaded
          }
        } catch (error) {
          console.debug('Error checking batch sync status:', error.message);
          // Set all games as local on error
          const gameIds = Object.keys(allGames);
          const fallbackStatuses = {};
          gameIds.forEach(id => {
            fallbackStatuses[id] = { status: 'Local', synced: false };
          });
          setGameSyncStatuses(fallbackStatuses);
          setSyncStatusLoaded(true); // Mark sync status as loaded even on error
        }
      }, 1000); // Reduced delay since batch check is much faster
    }
  }, [user]);

  // Reload games when date filter changes
  // Removed redundant reload on every render

  // Handle URL parameter changes
  useEffect(() => {
    const handleUrlParamImport = () => {
      const urlParams = new URLSearchParams(globalThis.location.search);
      if (urlParams.has('importGame') || urlParams.has('importGames') || urlParams.has('shareKey')) {
        checkForImportedGames();
      }
    };

    // Run once on mount
    handleUrlParamImport();

    // Listen for popstate events (back/forward navigation)
    globalThis.addEventListener('popstate', handleUrlParamImport);

    return () => {
      globalThis.removeEventListener('popstate', handleUrlParamImport);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setMessage({ text: 'All local storage data has been cleared.', type: 'success' });
    } else if (gameToDelete) {
      // Delete specific game
      if (gameToDelete.isTableGame) {
        LocalTableGameStorage.deleteTableGame(gameToDelete.id);
      } else {
        LocalGameStorage.deleteGame(gameToDelete.id);
      }
      loadSavedGames();
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
      globalThis.location.href = '/login';
    } catch (error) {
      console.error('Error during logout:', error);
      // Even if logout fails on server, clear local data and redirect
      clearUserData();
      globalThis.location.href = '/login';
    }
  };

  const handleThemeModeChange = (e) => {
    setUseSystemTheme(e.target.checked);
  };

  const handleAutoUpdateChange = (e) => {
    const newValue = e.target.checked;
    setAutoUpdate(newValue);
    localStorage.setItem('autoUpdate', newValue.toString());
    setMessage({ 
      text: newValue 
        ? 'Automatic updates enabled. Updates will install automatically.' 
        : 'Automatic updates disabled. You will be prompted before updating.', 
      type: 'success' 
    });
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

      // Check if there's already a waiting service worker
      if (registration.waiting) {
        setCheckingForUpdates(false);
        setMessage({ 
          text: '✅ Update available! Applying update now...', 
          type: 'success' 
        });
        
        // Post message to activate the waiting service worker
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        
        // Wait for controller change and reload - with one-time handler
        const handleControllerChange = () => {
          globalThis.location.reload();
        };
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange, { once: true });
        
        return;
      }

      // Force an update check
      await registration.update();

      // Wait for the update to be detected
      let updateCheckTimeout;
      const updatePromise = new Promise((resolve) => {
        let resolved = false;
        
        const checkUpdate = () => {
          if (resolved) return;
          
          if (registration.waiting) {
            resolved = true;
            clearTimeout(updateCheckTimeout);
            resolve('waiting');
          } else if (registration.installing) {
            // Keep checking while installing
            setTimeout(checkUpdate, 100);
          } else {
            // Check a few more times in case update is still propagating
            setTimeout(() => {
              if (resolved) return;
              if (registration.waiting) {
                resolved = true;
                clearTimeout(updateCheckTimeout);
                resolve('waiting');
              } else {
                resolved = true;
                clearTimeout(updateCheckTimeout);
                resolve('none');
              }
            }, 500);
          }
        };
        
        // Start checking immediately
        checkUpdate();
        
        // Timeout after 5 seconds
        updateCheckTimeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(registration.waiting ? 'waiting' : 'none');
          }
        }, 5000);
      });

      const result = await updatePromise;
      
      setCheckingForUpdates(false);
      
      if (result === 'waiting') {
        setMessage({ 
          text: '✅ Update available! Applying update now...', 
          type: 'success' 
        });
        
        // Post message to activate the waiting service worker
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        
        // Wait for controller change and reload - with one-time handler
        const handleControllerChange = () => {
          globalThis.location.reload();
        };
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange, { once: true });
      } else {
        setMessage({ 
          text: '✅ You are running the latest version!', 
          type: 'success' 
        });
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      setCheckingForUpdates(false);
      setMessage({ 
        text: 'Failed to check for updates. Please try again later.', 
        type: 'error' 
      });
    }
  };

  const handleForceUpdate = async () => {
    if (!('serviceWorker' in navigator)) {
      setMessage({ text: 'Service Worker not supported in this browser', type: 'error' });
      return;
    }

    // Confirm action
    if (!confirm('This will clear all caches and reload the app. Any unsaved changes may be lost. Continue?')) {
      return;
    }

    setForcingUpdate(true);
    setMessage({ text: 'Clearing caches and forcing update...', type: 'info' });

    try {
      // Clear all localStorage update tracking
      localStorage.removeItem('last_sw_reload');
      localStorage.removeItem('last_sw_version');
      localStorage.removeItem('sw_reload_attempts');
      sessionStorage.removeItem('sw_update_ready');
      sessionStorage.removeItem('sw_update_in_progress');
      
      // Clear all caches
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
      console.debug(`🧹 Cleared ${cacheNames.length} caches`);
      
      // Unregister service workers
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
      console.debug(`🧹 Unregistered ${registrations.length} service workers`);
      
      setMessage({ text: '✅ Caches cleared! Reloading...', type: 'success' });
      
      // Hard reload after a short delay
      setTimeout(() => {
        globalThis.location.reload(true);
      }, 1000);
    } catch (error) {
      console.error('Error forcing update:', error);
      setForcingUpdate(false);
      setMessage({ 
        text: 'Failed to clear caches. Please try again.', 
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
      // If error suggests game was deleted from server, clear upload status
      if (error.message.includes('not found') || error.message.includes('404')) {
        console.debug('[Settings] Game not found on server, clearing upload status');
        LocalTableGameStorage.clearUploadStatus(gameId);
        await loadSavedGames();
      }
      return { success: false, error: error.message };
    }
  };

  // Share Game Function
  const handleShareGame = async (gameId, gameData) => {
    console.debug('handleShareGame called with gameId:', gameId, 'gameData:', gameData);
    
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
    // Check authentication
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Open the cloud game select modal
    setShowCloudGameSelectModal(true);
  };

  const handleDownloadSelectedGames = async ({ wizardGameIds, tableGameIds }) => {
    const totalCount = wizardGameIds.length + tableGameIds.length;
    
    setCloudSyncStatus({ 
      uploading: true, 
      progress: 'Downloading selected games...', 
      uploadedCount: 0, 
      totalCount: totalCount
    });

    try {
      let totalDownloaded = 0;
      let totalSkipped = 0;

      // Download wizard games
      if (wizardGameIds.length > 0) {
        const { downloadSelectedCloudGames } = await import('@/shared/api/gameService');
        const wizardResult = await downloadSelectedCloudGames(wizardGameIds);
        totalDownloaded += wizardResult.downloaded;
        totalSkipped += wizardResult.skipped;
      }

      // Download table games
      if (tableGameIds.length > 0) {
        const { downloadSelectedCloudTableGames } = await import('@/shared/api/tableGameService');
        const tableResult = await downloadSelectedCloudTableGames(tableGameIds);
        totalDownloaded += tableResult.downloaded;
        totalSkipped += tableResult.skipped;
      }

      setCloudSyncStatus({ 
        uploading: false, 
        progress: '', 
        uploadedCount: 0, 
        totalCount: 0 
      });

      // Refresh the saved games list
      loadSavedGames();

      if (totalDownloaded > 0) {
        setMessage({ 
          text: `✅ Downloaded ${totalDownloaded} games from cloud! (${totalSkipped} already existed locally)`, 
          type: 'success' 
        });
      } else if (totalSkipped > 0) {
        setMessage({ 
          text: `All ${totalSkipped} selected games already exist locally`, 
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

  // Calculate overview stats from all games
  const overviewStats = useMemo(() => {
    const allGamesList = [...Object.values(savedGames), ...savedTableGames];
    
    console.log('📊 Overview Stats Debug:', {
      user,
      totalGames: allGamesList.length,
      wizardGames: Object.values(savedGames).length,
      tableGames: savedTableGames.length,
      sampleGame: allGamesList[0],
      sampleTableGame: savedTableGames[0]
    });
    
    if (!user || allGamesList.length === 0) {
      return { gameTypes: [], recentResults: [] };
    }

    const gameTypeStats = {};

    // Get user identifiers - for local games, username is the key
    const userIdentifiers = [user.id, user.name, user.username, user.$id].filter(Boolean);
    const usernameLower = user.username?.toLowerCase();

    allGamesList.forEach(game => {
      // Determine game type
      // Check if it's a table game (has specific table game indicators)
      let gameType;
      if (game.gameType === 'table') {
        // It's a table game - use the gameTypeName or name
        gameType = game.gameTypeName || game.name || 'Table Game';
      } else {
        // It's a wizard game
        gameType = game.game_mode || game.gameState?.game_mode || 'Wizard';
        // Fix "Local" mode to be "Wizard"
        if (gameType === 'Local') {
          gameType = 'Wizard';
        }
      }
      
      // Initialize game type stats
      if (!gameTypeStats[gameType]) {
        gameTypeStats[gameType] = {
          name: gameType,
          matches: 0,
          wins: 0,
          recentResults: []
        };
      }

      // Check if user won this game
      // Local games: ALL games in localStorage are played by the current user
      // The user either created the game or was part of it
      let userWon = false;
      let userPlayer = null;

      // Different handling for table games vs wizard games
      if (game.gameType === 'table') {
        // Table games: check gameData.players
        if (game.gameData?.players) {
          userPlayer = game.gameData.players.find(p => {
            const playerNameLower = p.name?.toLowerCase();
            return playerNameLower === usernameLower;
          });
          
          // For table games, use winner_id if available, otherwise calculate
          if (userPlayer && game.gameFinished) {
            const winnerId = game.gameData?.winner_id || game.winner_id;
            
            console.log('🎯 Table Game Win Check:', {
              gameName: game.name || game.gameTypeName,
              winnerId,
              userPlayerId: userPlayer.id,
              userId: user.id,
              userDollarId: user.$id,
              matches: {
                playerIdMatch: winnerId === userPlayer.id,
                userIdMatch: winnerId === user.id,
                dollarIdMatch: winnerId === user.$id
              }
            });
            
            if (winnerId) {
              // Use the stored winner_id (faster and more reliable)
              userWon = winnerId === userPlayer.id || winnerId === user.id || winnerId === user.$id;
            } else {
              // Fallback: calculate winner by score (for old games without winner_id)
              const players = game.gameData.players;
              const lowIsBetter = game.gameData.lowIsBetter || game.lowIsBetter || false;
              
              const playersWithScores = players.map(player => {
                const total = player.points?.reduce((sum, val) => sum + (Number.parseInt(val, 10) || 0), 0) || 0;
                return { ...player, total };
              });
              
              const userWithScore = playersWithScores.find(p => p.name === userPlayer.name);
              const userScore = userWithScore?.total || 0;
              
              userWon = playersWithScores.every(p => {
                if (p.name === userPlayer.name) return true;
                return lowIsBetter ? userScore <= p.total : userScore >= p.total;
              });
            }
          }
        }
      } else {
        // Wizard games: check gameState.players
        if (game.gameState?.players) {
          userPlayer = game.gameState.players.find(p => {
            const playerNameLower = p.name?.toLowerCase();
            const playerUsernameLower = p.username?.toLowerCase();
            
            return playerNameLower === usernameLower ||
                   playerUsernameLower === usernameLower ||
                   userIdentifiers.includes(p.id) ||
                   userIdentifiers.includes(p.userId);
          });
          
          if (userPlayer) {
            const winnerId = game.winner_id || game.gameState?.winner_id;
            // Check if user won by comparing IDs or if user is the winner
            userWon = winnerId === userPlayer.id || 
                      winnerId === userPlayer.userId ||
                      winnerId === user.id ||
                      winnerId === user.$id;
          } else {
            // If we can't find the user in players but the game is saved locally,
            // check if user might be winner by ID match
            const winnerId = game.winner_id || game.gameState?.winner_id;
            userWon = userIdentifiers.includes(winnerId);
          }
        }
      }

      gameTypeStats[gameType].matches++;
      if (userWon) {
        gameTypeStats[gameType].wins++;
      }
      
      // Add to recent results (limit to last 20)
      gameTypeStats[gameType].recentResults.unshift(userWon ? 'W' : 'L');
      if (gameTypeStats[gameType].recentResults.length > 20) {
        gameTypeStats[gameType].recentResults.pop();
      }
    });

    const gameTypes = Object.values(gameTypeStats).filter(gt => gt.matches > 0);
    
    console.log('📊 Game Types Found:', gameTypes);
    
    // Get overall recent results (last 20 games)
    const sortedGames = [...allGamesList].sort((a, b) => {
      const dateA = new Date(a.created_at || a.savedAt || a.lastPlayed || 0);
      const dateB = new Date(b.created_at || b.savedAt || b.lastPlayed || 0);
      return dateB - dateA; // Most recent first
    });
    
    const allResults = sortedGames.slice(0, 20).map(game => {
      let userWon = false;
      
      if (game.gameType === 'table') {
        // Table game
        if (game.gameData?.players && game.gameFinished) {
          const userPlayer = game.gameData.players.find(p => 
            p.name?.toLowerCase() === usernameLower
          );
          
          if (userPlayer) {
            const winnerId = game.gameData?.winner_id || game.winner_id;
            
            if (winnerId) {
              // Use the stored winner_id (faster and more reliable)
              userWon = winnerId === userPlayer.id || winnerId === user.id || winnerId === user.$id;
            } else {
              // Fallback: calculate winner by score (for old games without winner_id)
              const players = game.gameData.players;
              const lowIsBetter = game.gameData.lowIsBetter || game.lowIsBetter || false;
              
              const playersWithScores = players.map(player => {
                const total = player.points?.reduce((sum, val) => sum + (Number.parseInt(val, 10) || 0), 0) || 0;
                return { ...player, total };
              });
              
              const userWithScore = playersWithScores.find(p => p.name === userPlayer.name);
              const userScore = userWithScore?.total || 0;
              
              userWon = playersWithScores.every(p => {
                if (p.name === userPlayer.name) return true;
                return lowIsBetter ? userScore <= p.total : userScore >= p.total;
              });
            }
          }
        }
      } else {
        // Wizard game
        if (game.gameState?.players) {
          const userPlayer = game.gameState.players.find(p => {
            const playerNameLower = p.name?.toLowerCase();
            const playerUsernameLower = p.username?.toLowerCase();
            
            return playerNameLower === usernameLower ||
                   playerUsernameLower === usernameLower ||
                   userIdentifiers.includes(p.id) ||
                   userIdentifiers.includes(p.userId);
          });
          
          const winnerId = game.winner_id || game.gameState?.winner_id;
          userWon = userPlayer ? 
            (winnerId === userPlayer.id || winnerId === userPlayer.userId || winnerId === user.id) :
            userIdentifiers.includes(winnerId);
        }
      }
      
      return userWon ? 'W' : 'L';
    });

    return { gameTypes, recentResults: allResults };
  }, [savedGames, savedTableGames, user]);

  // Get all games for stats tab
  const allGamesForStats = useMemo(() => {
    const wizardGames = Object.values(savedGames);
    const tableGames = savedTableGames;
    
    if (statsGameType === 'wizard') {
      return wizardGames;
    } else {
      // Filter by specific table game type
      return tableGames.filter(game => 
        (game.gameTypeName || game.name) === statsGameType
      );
    }
  }, [savedGames, savedTableGames, statsGameType]);

  // Get available game types for stats selector
  const availableGameTypes = useMemo(() => {
    const types = [];
    
    if (Object.keys(savedGames).length > 0) {
      types.push({ value: 'wizard', label: 'Wizard' });
    }
    
    // Add table game types
    const tableGameTypes = new Set();
    savedTableGames.forEach(game => {
      const gameType = game.gameTypeName || game.name;
      if (gameType) {
        tableGameTypes.add(gameType);
      }
    });
    
    tableGameTypes.forEach(type => {
      types.push({ value: type, label: type });
    });
    
    return types;
  }, [savedGames, savedTableGames]);

  // Auto-select first available game type if 'all' or invalid selection
  React.useEffect(() => {
    if (availableGameTypes.length > 0 && (statsGameType === 'all' || !availableGameTypes.find(t => t.value === statsGameType))) {
      setStatsGameType(availableGameTypes[0].value);
    }
  }, [availableGameTypes, statsGameType]);

  // Create current player object for stats
  const currentPlayer = useMemo(() => {
    if (user) {
      return {
        id: user.id,
        name: user.name || user.username || 'User',
        username: user.username
      };
    }
    return null;
  }, [user]);

  return (
      <div className="settings-container">
        {/* Profile Header */}
        <div className="settings-section" style={{border: '1px solid var(--border)'}}>          
          {/* Profile Picture Section */}
            <div className="settings-option">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <img
                    src={sanitizeImageUrl(avatarUrl, defaultAvatar)}
                    alt="Profile"
                    style={{
                        width: '64px',
                        height: '64px',
                      borderRadius: '25%',
                      cursor: 'pointer',
                    }}
                  />
                <div>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>{user?.username || 'Guest'}</p>
                  <Link 
                    to={user ? "/account/edit" : "/login"}
                    style={{ fontSize: '14px', color: 'var(--primary)' }}
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
                    padding: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--error-color)',
                    border: 'none',
                    boxShadow: 'none'
                  }}
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOutIcon size={20} />
                </button>
              )}
              </div>
            </div>
        </div>

        {/* Tab Navigation */}
        <div className="account-tabs">
          <button 
            className={`account-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`account-tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            Stats
          </button>
          <button 
            className={`account-tab ${activeTab === 'games' ? 'active' : ''}`}
            onClick={() => setActiveTab('games')}
          >
            Games
          </button>
          <button 
            className={`account-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            {!user ? (
              <div className="settings-section">
                <p style={{ textAlign: 'center', padding: '40px 20px' }}>
                  Please <Link to="/login">login</Link> to view your game statistics
                </p>
              </div>
            ) : overviewStats.gameTypes.length === 0 ? (
              <div className="settings-section">
                <p style={{ textAlign: 'center', padding: '40px 20px' }}>
                  No games played yet. Start a new game to see your stats!
                </p>
              </div>
            ) : (
              <>
                {/* Game Types Grid */}
                <div className="overview-grid">
                  {overviewStats.gameTypes.map(gameType => (
                    <div 
                      key={gameType.name} 
                      className="game-type-card"
                      onClick={() => {
                        setStatsGameType(gameType.name.toLowerCase() === 'wizard' ? 'wizard' : gameType.name);
                        setActiveTab('stats');
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <h3 className="game-type-name">{gameType.name}</h3>
                      <div className="game-type-stats">
                        <div className="stat-item">
                          <span className="stat-label">Win%:</span>
                          <span className="stat-value win-rate">
                            {Math.round((gameType.wins / gameType.matches) * 100)}
                          </span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Matches:</span>
                          <span className="stat-value">{gameType.matches}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Overall Recent Results */}
                {overviewStats.recentResults.length > 0 && (
                  <div className="settings-section">
                    <h3 className="settings-section-title">Recent Performance</h3>
                    <div className="overall-recent-results">
                      <div className="results-string large">
                        {overviewStats.recentResults.map((result, idx) => (
                          <span key={idx} className={`result-letter ${result === 'W' ? 'win' : 'loss'}`}>
                            {result}
                          </span>
                        ))}
                      </div>
                      <p className="results-description">Last 20 games</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="tab-content">
            {!user ? (
              <div className="settings-section">
                <p style={{ textAlign: 'center', padding: '40px 20px' }}>
                  Please <Link to="/login">login</Link> to view detailed statistics
                </p>
              </div>
            ) : allGamesForStats.length > 0 || (Object.keys(savedGames).length > 0 || savedTableGames.length > 0) ? (
              <>
                {/* Game Type Selector */}
                {availableGameTypes.length > 1 && (
                  <div className="settings-section" style={{ padding: '0', backgroundColor: 'transparent', border: 'none', marginBottom: 'var(--spacing-sm)' }}>
                    <select 
                      className="game-type-selector"
                      value={statsGameType}
                      onChange={(e) => setStatsGameType(e.target.value)}
                      style={{
                        
                      }}
                    >
                      {availableGameTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                {allGamesForStats.length > 0 ? (
                  <PerformanceStatsEnhanced 
                    games={allGamesForStats} 
                    currentPlayer={currentPlayer} 
                    isWizardGame={statsGameType === 'wizard'}
                  />
                ) : (
                  <div className="settings-section">
                    <p style={{ textAlign: 'center', padding: '40px 20px' }}>
                      No games available for {statsGameType === 'all' ? 'any game type' : statsGameType}. Play some games to see your performance!
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="settings-section">
                <p style={{ textAlign: 'center', padding: '40px 20px' }}>
                  No games available for statistics. Play some games to see your performance!
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'games' && (
          <div className="tab-content">
            <div className="settings-section">
          {cloudSyncStatus.uploading && (
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
            {user && (
              <div className="cloud-sync-actions">
                <button 
                  className={`settings-button cloud-sync-button ${cloudSyncStatus.uploading ? 'loading' : ''}`}
                  onClick={handleBulkCloudSync}
                  disabled={
                    cloudSyncStatus.uploading || 
                    !syncStatusLoaded || // Disable until sync status is loaded
                    (
                      // Check wizard games
                      Object.values(savedGames).filter(game => !game.isPaused).length === 0 &&
                      // Check table games
                      savedTableGames.filter(game => game.gameFinished && !LocalTableGameStorage.isGameUploaded(game.id)).length === 0
                    ) ||
                    (
                      syncStatusLoaded && (
                        // All wizard games are synced
                        Object.entries(savedGames)
                          .filter(([, game]) => !game.isPaused)
                          .every(([gameId]) => gameSyncStatuses[gameId]?.status === 'Synced') &&
                        // All table games are synced
                        savedTableGames.every(game => LocalTableGameStorage.isGameUploaded(game.id) || !game.gameFinished)
                      )
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
            {!user && (
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

        <div className="settings-section" style={{background: 'transparent', border: 'none', padding: '0'}}>
          <div className="section-header" >
            <h2>Wizard Games ({filteredGames.length}) </h2>
            
            {/* <button 
              className="filter-button"
              onClick={() => setShowFilterModal(true)}
              aria-label="Filter games"
              style={{
                background: 'var(--primary)',
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
                  border: '2px solid var(--card-bg)'
                }} />
              )}
            </button> */}
          </div>
          {filteredGames.length > 0 ? (
            <div className="game-history">
              {filteredGames.map((game) => {
                const syncStatus = gameSyncStatuses[game.id];
                const status = syncStatus?.status || (game.isUploaded ? 'Synced' : 'Local');
                const isGameSynced = status === 'Synced';
                const needsUpload = status === 'Local';
                const isImportedGame = game.isImported || game.isShared || game.originalGameId;
                const isUploaded = LocalGameStorage.isGameUploaded(game.id);
                const badgeClass = status.toLowerCase().replace(' ', '-');

                // Determine which actions to show
                const showSync = needsUpload && !isImportedGame;
                const showShare = isGameSynced && !isImportedGame;

                return (
                  <SwipeableGameCard
                    key={game.id}
                    onDelete={() => handleDeleteGame(game.id)}
                    onSync={showSync ? async () => {
                      if (uploadingGames.has(game.id) || isUploaded) return;
                      
                      if (!user) {
                        navigate('/login');
                        return;
                      }
                      
                      setUploadingGames(prev => new Set([...prev, game.id]));
                      try {
                        const result = await uploadSingleGameToCloud(game.id, game);
                        setMessage({ text: result.isDuplicate ? `Game was already uploaded - marked as synced!` : `Game uploaded to cloud successfully!`, type: 'success' });
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
                    } : undefined}
                    onShare={showShare ? () => {
                      if (!user) {
                        navigate('/login');
                        return;
                      }
                      handleShareGame(game.id, game);
                    } : undefined}
                    detailsPath={`/game/${game.id}`}
                    isUploading={uploadingGames.has(game.id)}
                    isSharing={sharingGames.has(game.id)}
                    showSync={showSync}
                    showShare={showShare}
                    syncTitle={
                      uploadingGames.has(game.id) ? 'Uploading game...' :
                      isUploaded ? 'Already uploaded' :
                      game.isPaused ? 'Cannot upload paused games' :
                      !user ? 'Click to sign in and upload to cloud' :
                      'Upload to cloud'
                    }
                    disableSync={game.isPaused || uploadingGames.has(game.id) || isUploaded}
                    disableShare={game.isPaused || sharingGames.has(game.id)}
                  >
                    <div className={`game-card ${game.isImported ? 'imported-game' : ''}`}>
                      <div className="settings-card-header">
                        <div className="game-info">
                          <div className="game-name">
                            Wizard
                            {game.isPaused ? ' | Paused' : ''}
                          </div>
                          <span className={`mode-badge ${badgeClass}`}>
                            {status}
                          </span>
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
                    </div>
                  </SwipeableGameCard>
                );
              })}
            </div>
          ) : Object.keys(savedGames).length > 0 ? (
            <p className="no-games">No games match your filters.</p>
          ) : (
            <p className="no-games">No saved games found.</p>
          )}
        </div>

        {/* Table Games Section */}
        <div className="settings-section" style={{background: 'transparent', border: 'none', padding: '0'}}>
          <div className="section-header">
            <h2>Table Games ({savedTableGames.length})</h2>
          </div>
          {savedTableGames.length > 0 ? (
            <div className="game-history">
              {savedTableGames.map((game) => {
                const isUploaded = LocalTableGameStorage.isGameUploaded(game.id);
                const showSync = !isUploaded && game.gameFinished;
                
                return (
                  <SwipeableGameCard
                    key={game.id}
                    onDelete={() => handleDeleteGame(game.id, true)}
                    onSync={showSync ? async () => {
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
                    } : undefined}
                    detailsPath={`/table/${game.id}`}
                    isUploading={uploadingGames.has(game.id)}
                    showSync={showSync}
                    syncTitle={
                      uploadingGames.has(game.id) ? 'Uploading table game...' :
                      !game.gameFinished ? 'Cannot upload unfinished table games' :
                      !user ? 'Click to sign in and upload to cloud' :
                      'Upload to cloud'
                    }
                    disableSync={uploadingGames.has(game.id)}
                  >
                    <div className="game-card table-game-card">
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
                    </div>
                  </SwipeableGameCard>
                );
              })}
            </div>
          ) : (
            <p className="no-games">No table games found.</p>
          )}
        </div>

        {/* End of Games Tab */}
        </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="tab-content">
            {/* Theme Settings */}
            <div className="settings-section">
              <h3 className="settings-section-title">Theme Settings</h3>
              <div className="settings-option">
                <button 
                  className="settings-button"
                  onClick={toggleTheme}
                  disabled={useSystemTheme}
                >
                  {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
                </button>
              </div>
              <div className="settings-option">
                <label style={{display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center'}}>
                  <input
                    type="checkbox"
                    checked={useSystemTheme}
                    onChange={(e) => setUseSystemTheme(e.target.checked)}
                    style={{
                      width: '15px', 
                      height: '15px',
                      cursor: 'pointer'
                    }}
                  />
                  <div>
                    <p style={{margin: 0}}>Automatically match your device's theme</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Update Settings */}
            <div className="settings-section">
              <h3 className="settings-section-title">Update Settings</h3>
              <div className="settings-option">
                <label style={{display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center'}}>
                  <input
                    type="checkbox"
                    checked={autoUpdate}
                    onChange={(e) => handleAutoUpdateChange(e.target.checked)}
                    style={{
                      width: '15px', 
                      height: '15px',
                      cursor: 'pointer'
                    }}
                  />
                  <div>
                    <p>
                      {autoUpdate 
                        ? 'Updates will install automatically' 
                        : 'You will be prompted before installing updates'}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* App Information */}
            <div className="settings-section">
              <h3 className="settings-section-title">App Information</h3>
              <div className="settings-card info-card">
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Version:</span>
                    <span className="info-value">{import.meta.env.VITE_APP_VERSION || '1.10.13'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Build Date:</span>
                    <span className="info-value">
                      {formatDate(import.meta.env.VITE_BUILD_DATE || new Date().toISOString())}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{display: 'flex', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-md)', flexDirection: 'row'}}>
                <button 
                  className={`settings-button-update`}
                  onClick={handleCheckForUpdates}
                  disabled={checkingForUpdates || forcingUpdate}
                  title="Check for app updates"
                >
                  <RefreshIcon size={18} />Check for Updates
                </button>
                <button 
                  className={`settings-button-update`}
                  onClick={handleForceUpdate}
                  disabled={forcingUpdate || checkingForUpdates}
                  title="Force clear cache and reload (use if stuck in update loop)"
                  style={{backgroundColor: 'var(--primary)'}}
                >
                  <TrashIcon size={18} />Force Update
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
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

export default Account;
