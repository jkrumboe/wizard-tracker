"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/shared/hooks/useTheme';
import { useUser } from '@/shared/hooks/useUser';

import { sanitizeImageUrl } from '@/shared/utils/urlSanitizer';
import { LocalGameStorage, LocalTableGameStorage } from '@/shared/api';
import { ShareValidator } from '@/shared/utils/shareValidator';
import { migrateLocalStorageGames, getMigrationStatus, hasGamesNeedingMigration } from '@/shared/utils/localStorageMigration';
import { TrashIcon, RefreshIcon, CloudIcon, LogOutIcon, FilterIcon, UsersIcon, TrophyIcon, BarChartIcon, KeyIcon } from '@/components/ui/Icon';
import DeleteConfirmationModal from '@/components/modals/DeleteConfirmationModal';
import CloudGameSelectModal from '@/components/modals/CloudGameSelectModal';
import GameFilterModal from '@/components/modals/GameFilterModal';
import ProfilePictureModal from '@/components/modals/ProfilePictureModal';
import { SwipeableGameCard, LanguageSwitcher } from '@/components/common';
import authService from '@/shared/api/authService';
import userService from '@/shared/api/userService';
import avatarService from '@/shared/api/avatarService';
import defaultAvatar from "@/assets/default-avatar.png";
import { batchCheckGamesSyncStatus } from '@/shared/utils/syncChecker';
import { shareGame } from '@/shared/utils/gameSharing';
import { createSharedGameRecord } from '@/shared/api/sharedGameService';
import { filterGames, getDefaultFilters } from '@/shared/utils/gameFilters';
import PerformanceStatsEnhanced from '@/pages/profile/PerformanceStatsEnhanced';
import StatsOverview from '@/components/stats/StatsOverview';
import '@/styles/pages/account.css';

const Account = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview'); // overview, stats, games
  const [statsGameType, setStatsGameType] = useState('all'); // all, wizard, or specific table game type
  const [savedGames, setSavedGames] = useState({});
  const [savedTableGames, setSavedTableGames] = useState([]);
  const [cloudGames, setCloudGames] = useState([]); // Games from API (includes identity consolidation)
  const [cloudGamesLoading, setCloudGamesLoading] = useState(true); // Track if cloud games are loading
  const [profileData, setProfileData] = useState(null); // Profile data including identities
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [gameToDelete, setGameToDelete] = useState(null);
  const [deleteAll, setDeleteAll] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [cloudSyncStatus, setCloudSyncStatus] = useState({ uploading: false, progress: '', uploadedCount: 0, totalCount: 0 });
  const [uploadingGames, setUploadingGames] = useState(new Set()); // Track which games are currently uploading
  const [gameSyncStatuses, setGameSyncStatuses] = useState({}); // Track sync status for each game
  const [syncStatusLoaded, setSyncStatusLoaded] = useState(false); // Track if sync status has been checked
  const [sharingGames, setSharingGames] = useState(new Set()); // Track which games are currently being shared
  const [debugLogs, setDebugLogs] = useState([]); // Debug logs for mobile debugging
  const [showDebugPanel, setShowDebugPanel] = useState(false); // Show/hide debug panel
  const [showCloudGameSelectModal, setShowCloudGameSelectModal] = useState(false); // Cloud game select modal

  // Helper to add debug logs visible in UI
  const addDebugLog = (message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, message, data };
    console.log(message, data);
    setDebugLogs(prev => [...prev.slice(-20), logEntry]); // Keep last 20 logs
  };
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatar); // Avatar URL state
  const [showProfilePictureModal, setShowProfilePictureModal] = useState(false); // Profile picture modal
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState(getDefaultFilters());
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);
  const [forcingUpdate, setForcingUpdate] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(() => {
    const saved = localStorage.getItem('autoUpdate');
    return saved !== null ? saved === 'true' : true; // Default to true
  });
  const [migrating, setMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [needsMigration, setNeedsMigration] = useState(false);
  const { theme, toggleTheme, useSystemTheme, setUseSystemTheme } = useTheme();
  const { user, clearUserData } = useUser();

  // Password change state
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [passwordChangeData, setPasswordChangeData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);

  // Account deletion state
  const [showAccountDeleteModal, setShowAccountDeleteModal] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [accountDeletionLoading, setAccountDeletionLoading] = useState(false);

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
          text: t('accountMessages.invalidShareLink', { error: validation.error }), 
          type: 'error' 
        });
        globalThis.history.replaceState({}, document.title, globalThis.location.pathname);
        return;
      }
      
      try {
        const success = LocalGameStorage.importGames(JSON.stringify(validation.data));
        if (success) {
          loadSavedGames();
          setMessage({ text: t('accountMessages.gamesImportedSuccess'), type: 'success' });
        } else {
          setMessage({ text: t('accountMessages.gamesImportFailed'), type: 'error' });
        }
      } catch (error) {
        console.error('Error importing games from URL:', error);
        setMessage({ text: t('accountMessages.processShareFailed'), type: 'error' });
      }
      
      globalThis.history.replaceState({}, document.title, globalThis.location.pathname);
    } else if (importGameParam) {
      // Handle single game import with security validation
      const validation = ShareValidator.validateEncodedGameData(importGameParam);
      
      if (!validation.isValid) {
        setMessage({ 
          text: t('accountMessages.invalidShareLink', { error: validation.error }), 
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
          setMessage({ text: t('accountMessages.gameImportedSuccess'), type: 'success' });
        } else {
          setMessage({ text: t('accountMessages.importGameFailed'), type: 'error' });
        }
      } catch (error) {
        console.error('Error importing game from URL:', error);
        setMessage({ text: t('accountMessages.processShareFailed'), type: 'error' });
      }
      
      globalThis.history.replaceState({}, document.title, globalThis.location.pathname);
    } else if (shareKeyParam) {
      // Handle share key import (for large data) with security validation
      
      // First validate the share key format
      if (!ShareValidator.isValidShareKey(shareKeyParam)) {
        setMessage({ 
          text: t('accountMessages.invalidShareLinkFormat'), 
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
            text: t('accountMessages.shareLinkDifferentDevice'), 
            type: 'error' 
          });
          globalThis.history.replaceState({}, document.title, globalThis.location.pathname);
          return;
        }
        
        // Check if expired
        if (expirationTime && Date.now() > parseInt(expirationTime)) {
          localStorage.removeItem(shareKeyParam);
          localStorage.removeItem(shareKeyParam + '_expires');
          setMessage({ text: t('accountMessages.shareLinkExpired'), type: 'error' });
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
          setMessage({ text: t('accountMessages.invalidShareDataFormat'), type: 'error' });
          globalThis.history.replaceState({}, document.title, globalThis.location.pathname);
          return;
        }
        
        // Validate the structure as games data
        const validation = ShareValidator.validateEncodedGamesData(btoa(jsonData));
        if (!validation.isValid) {
          localStorage.removeItem(shareKeyParam);
          localStorage.removeItem(shareKeyParam + '_expires');
          setMessage({ 
            text: t('accountMessages.invalidShareLink', { error: validation.error }), 
            type: 'error' 
          });
          globalThis.history.replaceState({}, document.title, globalThis.location.pathname);
          return;
        }
        
        const success = LocalGameStorage.importGames(JSON.stringify(validation.data));
        
        if (success) {
          loadSavedGames();
          setMessage({ text: t('accountMessages.gameImportedSuccess'), type: 'success' });
          
          // Clean up the temporary storage
          localStorage.removeItem(shareKeyParam);
          localStorage.removeItem(shareKeyParam + '_expires');
        } else {
          setMessage({ text: t('accountMessages.importGameFailed'), type: 'error' });
        }
      } catch (error) {
        console.error('Error importing game from share key:', error);
        setMessage({ text: t('accountMessages.processShareFailed'), type: 'error' });
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

  // Load cloud games from API if user is logged in
  const loadCloudGames = useCallback(async () => {
    if (!user) {
      setCloudGames([]);
      setProfileData(null);
      setCloudGamesLoading(false);
      return;
    }

    try {
      setCloudGamesLoading(true);
      console.log('🔄 [Account] Fetching cloud games for userId:', user.id);
      const userService = (await import('@/shared/api/userService')).default;
      const data = await userService.getUserPublicProfile(user.id);
      
      console.log('✅ [Account] Fetched cloud games from API:', {
        username: data.username,
        identities: data.identities,
        totalGames: data.totalGames,
        gamesCount: data.games?.length || 0
      });
      
      setProfileData(data);
      setCloudGames(data.games || []);
    } catch (error) {
      console.error('[Account] Failed to fetch cloud games:', error);
      setCloudGames([]);
    } finally {
      setCloudGamesLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Always load games from local storage, regardless of login status
    loadSavedGames();
    
    // Load cloud games if user is logged in
    if (user) {
      loadCloudGames();
    }
    
    checkForImportedGames();
    cleanupExpiredShareKeys();
    
    // Check for import success/error flags from URL handler
    if (localStorage.getItem('import_success')) {
      setMessage({ text: t('accountMessages.gameImportedSuccess'), type: 'success' });
      localStorage.removeItem('import_success');
    } else if (localStorage.getItem('import_error')) {
      setMessage({ text: t('accountMessages.importGameFailed'), type: 'error' });
      localStorage.removeItem('import_error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loadCloudGames]); // Re-run when user changes (login/logout)

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
      setMessage({ text: t('accountMessages.allDataCleared'), type: 'success' });
    } else if (gameToDelete) {
      // Delete specific game
      if (gameToDelete.isTableGame) {
        LocalTableGameStorage.deleteTableGame(gameToDelete.id);
      } else {
        LocalGameStorage.deleteGame(gameToDelete.id);
      }
      loadSavedGames();
      setMessage({ text: t('accountMessages.gameDeleted'), type: 'success' });
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

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordChangeData.newPassword !== passwordChangeData.confirmPassword) {
      setMessage({ text: t('accountMessages.passwordsMismatch'), type: 'error' });
      return;
    }

    if (passwordChangeData.newPassword.length < 6) {
      setMessage({ text: t('accountMessages.passwordTooShort'), type: 'error' });
      return;
    }

    setPasswordChangeLoading(true);
    try {
      await userService.changeOwnPassword(
        passwordChangeData.currentPassword,
        passwordChangeData.newPassword
      );
      
      setMessage({ text: t('accountMessages.passwordChanged'), type: 'success' });
      setShowPasswordChangeModal(false);
      setPasswordChangeData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      setMessage({ 
        text: error.message || t('accountMessages.passwordChangeFailed'), 
        type: 'error' 
      });
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  const handleAccountDeletion = async (e) => {
    e.preventDefault();
    
    if (!deleteAccountPassword) {
      setMessage({ text: t('accountMessages.passwordRequired'), type: 'error' });
      return;
    }

    setAccountDeletionLoading(true);
    try {
      await userService.deleteOwnAccount(deleteAccountPassword);
      
      // Clear all local data
      clearUserData();
      await LocalGameStorage.clearAll();
      await LocalTableGameStorage.clearAllGames();
      
      // Show success message briefly before redirect
      setMessage({ text: t('accountMessages.accountDeleted'), type: 'success' });
      
      // Redirect to home after a brief delay
      setTimeout(() => {
        globalThis.location.href = '/';
      }, 1500);
    } catch (error) {
      setMessage({ 
        text: error.message || 'Failed to delete account', 
        type: 'error' 
      });
      setAccountDeletionLoading(false);
    }
  };



  const handleAutoUpdateChange = (e) => {
    const newValue = e.target.checked;
    setAutoUpdate(newValue);
    localStorage.setItem('autoUpdate', newValue.toString());
    setMessage({ 
      text: newValue 
        ? t('accountMessages.autoUpdateOn') 
        : t('accountMessages.autoUpdateOff'), 
      type: 'success' 
    });
  };

  const handleCheckForUpdates = async () => {
    if (!('serviceWorker' in navigator)) {
      setMessage({ text: t('accountMessages.swNotSupported'), type: 'error' });
      return;
    }

    setCheckingForUpdates(true);
    setMessage({ text: t('accountMessages.checkingForUpdates'), type: 'info' });

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (!registration) {
        setCheckingForUpdates(false);
        setMessage({ text: t('accountMessages.noSwRegistered'), type: 'error' });
        return;
      }

      // Check if there's already a waiting service worker
      if (registration.waiting) {
        setCheckingForUpdates(false);
        setMessage({ 
          text: t('accountMessages.updateAvailableApplying'), 
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
          text: t('accountMessages.updateAvailableApplying'), 
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
          text: t('accountMessages.latestVersion'), 
          type: 'success' 
        });
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      setCheckingForUpdates(false);
      setMessage({ 
        text: t('accountMessages.updateCheckFailed'), 
        type: 'error' 
      });
    }
  };

  // Check migration status on load
  useEffect(() => {
    const status = getMigrationStatus();
    setMigrationStatus(status);
    setNeedsMigration(hasGamesNeedingMigration());
  }, [savedGames]);

  // Handle manual migration
  const handleMigrateGames = async () => {
    setMigrating(true);
    try {
      const result = await migrateLocalStorageGames();
      if (result.success) {
        setMessage({ 
          text: result.message, 
          type: 'success' 
        });
        setMigrationStatus(getMigrationStatus());
        setNeedsMigration(false);
        // Reload games to show migrated format
        loadSavedGames();
      } else {
        setMessage({ 
          text: result.message || 'Migration failed', 
          type: 'error' 
        });
      }
    } catch (error) {
      console.error('Migration error:', error);
      setMessage({ 
        text: 'Migration failed: ' + error.message, 
        type: 'error' 
        });
    } finally {
      setMigrating(false);
    }
  };

  const handleForceUpdate = async () => {
    if (!('serviceWorker' in navigator)) {
      setMessage({ text: t('accountMessages.swNotSupported'), type: 'error' });
      return;
    }

    // Confirm action
    if (!confirm(t('accountMessages.forceUpdateConfirm'))) {
      return;
    }

    setForcingUpdate(true);
    setMessage({ text: t('accountMessages.clearingCaches'), type: 'info' });

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
      
      setMessage({ text: t('accountMessages.cachesCleared'), type: 'success' });
      
      // Hard reload after a short delay
      setTimeout(() => {
        globalThis.location.reload(true);
      }, 1000);
    } catch (error) {
      console.error('Error forcing update:', error);
      setForcingUpdate(false);
      setMessage({ 
        text: t('accountMessages.clearCachesFailed'), 
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
    
    addDebugLog(`🆔 Game ID: ${gameId}`, { 
      gameId,
      timestamp: gameData.created_at,
      players: gameData.players?.length || 0
    });
    
    addDebugLog('🔍 Game structure check', {
      hasRoundData: !!gameData.roundData,
      hasRound_data: !!gameData.round_data,
      hasTotalRounds: !!gameData.total_rounds,
      hasMaxRounds: !!gameData.maxRounds,
      gameFinished: gameData.gameFinished,
      hasPlayers: !!(gameData.players && gameData.players.length > 0),
      hasVersion: !!gameData.version
    });
    
    // Sanitize game data before upload (fix round reduction bug on PWA)
    // This prevents validation errors when rounds are reduced but data isn't properly updated
    // Handle both round_data and roundData (internal format)
    const roundDataArray = gameData.round_data || gameData.roundData;
    if (roundDataArray && Array.isArray(roundDataArray)) {
      const actualRounds = roundDataArray.length;
      const declaredRounds = gameData.total_rounds || gameData.maxRounds || actualRounds;
      
      // Check round data quality
      const emptyRounds = roundDataArray.filter(r => !r || !r.players || r.players.length === 0).length;
      const incompleteRounds = roundDataArray.filter(r => {
        if (!r || !r.players) return true;
        return r.players.some(p => p.call === null || p.call === undefined || p.made === null || p.made === undefined);
      }).length;
      
      // Find last complete round (for trimming incomplete rounds at the end)
      let lastCompleteRoundIndex = actualRounds - 1;
      for (let i = actualRounds - 1; i >= 0; i--) {
        const round = roundDataArray[i];
        if (round && round.players && round.players.length > 0) {
          const isComplete = round.players.every(p => 
            p.made !== null && p.made !== undefined && 
            p.score !== null && p.score !== undefined
          );
          if (isComplete) {
            lastCompleteRoundIndex = i;
            break;
          }
        }
      }
      
      addDebugLog('🔍 Round validation', {
        declared: declaredRounds,
        actual: actualRounds,
        finished: gameData.gameFinished,
        emptyRounds,
        incompleteRounds,
        lastCompleteRound: lastCompleteRoundIndex + 1,
        firstRound: roundDataArray[0] ? {
          hasPlayers: !!roundDataArray[0].players,
          playerCount: roundDataArray[0].players?.length || 0
        } : null
      });
      
      // Case 1: Game is finished and has incomplete rounds at the end - trim to last complete round
      if (gameData.gameFinished && incompleteRounds > 0 && lastCompleteRoundIndex < actualRounds - 1) {
        const newRoundCount = lastCompleteRoundIndex + 1;
        addDebugLog(`🔧 Trimming incomplete rounds: ${actualRounds} → ${newRoundCount} (last complete round)`);
        
        if (gameData.round_data) {
          gameData.round_data = gameData.round_data.slice(0, newRoundCount);
        }
        if (gameData.roundData) {
          gameData.roundData = gameData.roundData.slice(0, newRoundCount);
        }
        if (gameData.total_rounds) {
          gameData.total_rounds = newRoundCount;
        }
        if (gameData.maxRounds) {
          gameData.maxRounds = newRoundCount;
        }
      }
      // Case 2: round_data has more entries than total_rounds (old bug)
      else if (actualRounds > declaredRounds) {
        addDebugLog(`🔧 Trimming rounds: ${actualRounds} → ${declaredRounds}`);
        if (gameData.round_data) {
          gameData.round_data = gameData.round_data.slice(0, declaredRounds);
        }
        if (gameData.roundData) {
          gameData.roundData = gameData.roundData.slice(0, declaredRounds);
        }
      }
      
      // Case 3: total_rounds is larger than actual round_data (game finished early after reducing rounds)
      else if (declaredRounds > actualRounds && gameData.gameFinished) {
        addDebugLog(`🔧 Adjusting total_rounds: ${declaredRounds} → ${actualRounds}`);
        if (gameData.total_rounds) {
          gameData.total_rounds = actualRounds;
        }
        if (gameData.maxRounds) {
          gameData.maxRounds = actualRounds;
        }
      }
      
      // Also trim/fix players' rounds arrays if they exist
      if (gameData.players && Array.isArray(gameData.players)) {
        const targetRounds = gameData.total_rounds || gameData.maxRounds || actualRounds;
        gameData.players = gameData.players.map(player => {
          if (player.rounds && player.rounds.length > targetRounds) {
            addDebugLog(`🔧 Trimming ${player.name}'s rounds: ${player.rounds.length} → ${targetRounds}`);
            return {
              ...player,
              rounds: player.rounds.slice(0, targetRounds)
            };
          }
          return player;
        });
      }
    } else {
      addDebugLog('⚠️ No round data found in game', { gameId });
    }
    
    try {
      const { createGame } = await import('@/shared/api/gameService');
      addDebugLog('📤 Attempting upload', { gameId });
      const result = await createGame(gameData, gameId);
      addDebugLog('✅ Upload successful', { gameId, cloudId: result.game?.id });
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
          // Dispatch event to notify leaderboard of new game
          window.dispatchEvent(new CustomEvent('gameUploaded'));
        }
        return { success: true, cloudGameId: result.game.id };
      }
    } catch (error) {
      addDebugLog('❌ Upload failed', { 
        gameId, 
        error: error.message,
        validationErrors: error.message.includes('validation') ? error.message.split('\n') : null
      });
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
      setMessage({ text: t('accountMessages.cannotSharePaused'), type: 'error' });
      return;
    }

    // Check if this is an imported shared game - prevent re-sharing to avoid confusion
    if (gameData.isImported || gameData.isShared || gameData.originalGameId) {
      setMessage({ text: t('accountMessages.cannotShareImported'), type: 'error' });
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
          setMessage({ text: t('accountMessages.syncBeforeShareFailed'), type: 'error' });
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
        setMessage({ text: t('accountMessages.syncBeforeShareError', { error: error.message }), type: 'error' });
        console.error('[SyncDebug] Failed to sync before sharing:', error);
        return;
      }
    }

    if (!isGameOnline) {
      setMessage({ text: t('accountMessages.gameMustBeUploaded'), type: 'error' });
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
          setMessage({ text: t('accountMessages.gameSharedSuccess'), type: 'success' });
        } else {
          setMessage({ text: t('accountMessages.shareLinkCopied'), type: 'success' });
        }
      } else {
        setMessage({ text: t('accountMessages.shareGameFailed'), type: 'error' });
      }
    } catch (error) {
      console.error('Failed to share game:', error);
      setMessage({ text: t('accountMessages.shareFailed', { error: error.message }), type: 'error' });
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
      setMessage({ text: t('accountMessages.noGamesForUpload'), type: 'error' });
      return;
    }

    setCloudSyncStatus({ 
      uploading: true, 
      progress: t('account.startingUpload'), 
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
          progress: t('account.uploadingWizardGame', { current: i + 1, total: uploadableGames.length }),
          uploadedCount: successful
        }));

        try {
          const result = await uploadSingleGameToCloud(gameId, gameData);
          if (result && !result.error) {
            successful++;
          } else {
            failed++;
            const errorMsg = `Game ${gameId}: ${result?.error || 'Unknown error'}`;
            errors.push(errorMsg);
            addDebugLog('❌ Upload failed', { gameId, error: result?.error });
          }
        } catch (error) {
          failed++;
          const errorMsg = `Game ${gameId}: ${error.message}`;
          errors.push(errorMsg);
          addDebugLog('❌ Upload exception', { gameId, error: error.message, stack: error.stack });
        }
      }

      // Upload table games
      for (let i = 0; i < uploadableTableGames.length; i++) {
        const [gameId, gameData] = uploadableTableGames[i];
        
        setCloudSyncStatus(prev => ({
          ...prev,
          progress: t('account.uploadingTableGame', { current: i + 1, total: uploadableTableGames.length }),
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
          text: t('accountMessages.allGamesUploaded', { count: successful }), 
          type: 'success' 
        });
      } else if (successful > 0 && failed > 0) {
        setMessage({ 
          text: t('accountMessages.someGamesUploadFailed', { successful, failed, error: errors[0] || '' }), 
          type: 'warning' 
        });
        addDebugLog('Upload summary', { successful, failed, errors });
      } else {
        setMessage({ 
          text: t('accountMessages.allUploadsFailed', { error: errors[0] || '' }), 
          type: 'error' 
        });
        addDebugLog('All uploads failed', { errors });
      }
    } catch (error) {
      setCloudSyncStatus({ 
        uploading: false, 
        progress: '', 
        uploadedCount: 0, 
        totalCount: 0 
      });
      setMessage({ text: t('accountMessages.uploadFailed', { error: error.message }), type: 'error' });
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
      progress: t('account.downloadingSelectedGames'), 
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
          text: t('accountMessages.downloadedGames', { count: totalDownloaded, skipped: totalSkipped }), 
          type: 'success' 
        });
      } else if (totalSkipped > 0) {
        setMessage({ 
          text: t('accountMessages.allGamesExistLocally', { count: totalSkipped }), 
          type: 'info' 
        });
      } else {
        setMessage({ 
          text: t('accountMessages.noGamesDownloaded'), 
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
      setMessage({ text: t('accountMessages.downloadFailed', { error: error.message }), type: 'error' });
      console.error('Download error:', error);
    }
  };

  // Calculate overview stats from all games using shared hook
  const allGamesForOverview = useMemo(() => {
    // If user is logged in, only use cloud games (which include identity consolidation)
    // Local games are for upload management in the Games tab
    if (user && cloudGames.length > 0) {
      return cloudGames;
    }
    
    // If not logged in, combine local games
    const localWizardGames = Object.values(savedGames);
    const localTableGames = savedTableGames;
    return [...localWizardGames, ...localTableGames];
  }, [savedGames, savedTableGames, cloudGames, user]);

  // Create user object with identities for stats calculation
  const userWithAliases = useMemo(() => {
    if (!user) return null;
    return {
      ...user,
      identities: profileData?.identities || user.identities?.map(i => i.displayName) || [user.username]
    };
  }, [user, profileData]);

  // Handler for game type card clicks
  const handleGameTypeClick = useCallback((gameTypeName) => {
    setStatsGameType(gameTypeName.toLowerCase() === 'wizard' ? 'wizard' : gameTypeName);
    setActiveTab('stats');
  }, []);

  // Get all games for stats tab
  const allGamesForStats = useMemo(() => {
    // If user is logged in, use cloud games (which include identity consolidation)
    // Otherwise use local games
    const gamesSource = user && cloudGames.length > 0 
      ? cloudGames 
      : [...Object.values(savedGames), ...savedTableGames];
    
    if (!gamesSource || gamesSource.length === 0) return [];
    
    // Filter by game type
    const wizardGames = gamesSource.filter(g => g.gameType !== 'table');
    const tableGames = gamesSource.filter(g => g.gameType === 'table');
    
    if (statsGameType === 'wizard') {
      return wizardGames;
    } else {
      // Filter by specific table game type
      return tableGames.filter(game => 
        (game.gameTypeName || game.name) === statsGameType
      );
    }
  }, [savedGames, savedTableGames, cloudGames, user, statsGameType]);

  // Get available game types for stats selector
  const availableGameTypes = useMemo(() => {
    // Use cloud games if user is logged in, otherwise local games
    const gamesSource = user && cloudGames.length > 0 
      ? cloudGames 
      : [...Object.values(savedGames), ...savedTableGames];
    
    const types = [];
    
    // Check for wizard games
    const wizardGames = gamesSource.filter(g => g.gameType !== 'table');
    if (wizardGames.length > 0) {
      types.push({ value: 'wizard', label: 'Wizard' });
    }
    
    // Add table game types
    const tableGameTypes = new Set();
    gamesSource
      .filter(g => g.gameType === 'table')
      .forEach(game => {
        const gameType = game.gameTypeName || game.name;
        if (gameType) {
          tableGameTypes.add(gameType);
        }
      });
    
    tableGameTypes.forEach(type => {
      types.push({ value: type, label: type });
    });
    
    return types;
  }, [savedGames, savedTableGames, cloudGames, user]);

  // Build a map of game ID -> ELO data from cloud games
  const gameEloMap = useMemo(() => {
    const map = new Map();
    cloudGames.forEach(game => {
      if (game.id && (game.eloChange !== undefined || game.eloRating !== undefined)) {
        map.set(game.id.toString(), {
          change: game.eloChange,
          rating: game.eloRating,
          placement: game.eloPlacement
        });
      }
    });
    return map;
  }, [cloudGames]);

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
        <div className="settings-section" id="border">          
          {/* Profile Picture Section */}
            <div className="settings-option">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <img
                    src={sanitizeImageUrl(avatarUrl, defaultAvatar)}
                    alt="Profile"
                    onClick={() => setShowProfilePictureModal(true)}
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '25%',
                      cursor: 'pointer',
                    }}
                    title={t('account.clickToViewFullSize')}
                  />
                <div>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>{user?.username || t('common.guest')}</p>
                  <Link 
                    to={user ? "/account/edit" : "/login"}
                    style={{ fontSize: '14px', color: 'var(--primary)' }}
                  >
                    {user ? t('account.editProfile') : t('account.login')}
                  </Link>
                </div>
              </div>
              {user && (
                <button
                  onClick={handleLogout}
                  style={{
                    background: 'none',
                    cursor: 'pointer',
                    padding: '0 var(--spacing-xs) 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--error-color)',
                    border: 'none',
                    boxShadow: 'none'
                  }}
                  title={t('account.signOut')}
                  aria-label={t('account.signOut')}
                >
                  <LogOutIcon size={24} />
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
            {t('account.overviewTab')}
          </button>
          <button 
            className={`account-tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            {t('account.statsTab')}
          </button>
          <button 
            className={`account-tab ${activeTab === 'games' ? 'active' : ''}`}
            onClick={() => setActiveTab('games')}
          >
            {t('account.gamesTab')}
          </button>
          <button 
            className={`account-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            {t('account.settingsTab')}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            {cloudGamesLoading && user ? (
              <div className="overview-grid">
                <div className="game-type-card" style={{ cursor: 'default' }}>
                  <div className="game-type-header">
                    <div className="skeleton" style={{ width: '80px', height: '20px', borderRadius: '4px' }}></div>
                    <div className="game-type-stats">
                      <div className="stat-item">
                        <span className="stat-label">{t('account.winRateLabel')}</span>
                        <span className="skeleton" style={{ width: '30px', height: '16px', borderRadius: '4px', display: 'inline-block' }}></span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">{t('account.matchesLabel')}</span>
                        <span className="skeleton" style={{ width: '20px', height: '16px', borderRadius: '4px', display: 'inline-block' }}></span>
                      </div>
                    </div>
                  </div>
                  <div className="game-type-recent-results">
                    <div className="results-string">
                      {Array.from({ length: 10 }).map((_, idx) => (
                        <span key={idx} className="result-letter empty"></span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <StatsOverview 
                games={allGamesForOverview} 
                user={userWithAliases || user} 
                onGameTypeClick={handleGameTypeClick}
              />
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="tab-content">
            {!user ? (
              <div className="settings-section">
                <p style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <Link to="/login">{t('account.login')}</Link> {t('account.loginToViewStats')}
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
                    gameType={statsGameType}
                  />
                ) : (
                  <div className="settings-section">
                    <p style={{ textAlign: 'center', padding: '40px 20px' }}>
                      {t('account.noGamesForType', { type: statsGameType === 'all' ? t('common.all') : statsGameType })}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="settings-section">
                <p style={{ textAlign: 'center', padding: '40px 20px' }}>
                  {t('account.noGamesForStats')}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'games' && (
          <div className="tab-content">
            <div 
              className="settings-section"
              style={{background: 'transparent', border: 'none', padding: '0'}}
            >
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
                {t('account.uploadProgress', { uploaded: cloudSyncStatus.uploadedCount, total: cloudSyncStatus.totalCount })}
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
                  {cloudSyncStatus.uploading ? t('account.uploading') : t('account.uploadAll')}
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
                  {cloudSyncStatus.uploading ? t('account.downloading') : t('account.download')}
                </button>
                {user && user.role === 'admin' && (
                  <button 
                    className="settings-button"
                    onClick={() => setShowDebugPanel(!showDebugPanel)}
                    style={{ border: '1px solid var(--primary)' }}
                  >
                    {showDebugPanel ? '✓' : '🐛'} {t('account.debugLog')}
                  </button>
                )}
              </div>
            )}
            {!user && (
              <button 
                className="settings-button cloud-sync-button"
                onClick={() => navigate('/login')}
              >
                <CloudIcon size={18} />
                {t('auth.signInToUpload')}
              </button>
            )}
            <button className="settings-button danger-button" onClick={handleDeleteAllData}>
              <TrashIcon size={18} />
              {t('account.clearAllData')}
            </button>
          </div>
        </div>

        {!user && (
          <div style={{
            // padding: 'var(--spacing-sm) var(--spacing-md)',
            // background: 'rgba(79, 70, 229, 0.1)',
            // border: '1px solid rgba(79, 70, 229, 0.3)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--spacing-sm)',
            fontSize: '1rem',
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            textAlign: 'center',
            justifyContent: 'center',
            gap: 'var(--spacing-sm)'
          }}>
            <span>{t('auth.signInToShareGames')}</span>
          </div>
        )}

        <div className="settings-section" style={{background: 'transparent', border: 'none', padding: '0'}}>
          <div className="section-header" >
            <h2>{t('account.wizardGamesTitle', { count: filteredGames.length })} </h2>
            
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

                // Get ELO data for synced games
                const cloudGameId = syncStatus?.cloudGameId || game.cloudGameId;
                const eloData = cloudGameId ? gameEloMap.get(cloudGameId.toString()) : null;

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
                        setMessage({ text: result.isDuplicate ? t('accountMessages.gameAlreadyUploadedMarked') : t('accountMessages.gameUploadedSuccess'), type: 'success' });
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
                        setMessage({ text: t('accountMessages.signInToShare'), type: 'error' });
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
                      uploadingGames.has(game.id) ? t('account.syncTitleUploading') :
                      isUploaded ? t('account.syncTitleAlreadyUploaded') :
                      game.isPaused ? t('account.syncTitleCannotUploadPaused') :
                      !user ? t('account.syncTitleSignInToUpload') :
                      t('account.syncTitleUploadToCloud')
                    }
                    shareTitle={
                      !user ? t('account.shareTitleSignIn') :
                      game.isPaused ? t('account.shareTitleCannotSharePaused') :
                      sharingGames.has(game.id) ? t('account.shareTitleSharing') :
                      t('account.shareTitleShareGame')
                    }
                    disableSync={game.isPaused || uploadingGames.has(game.id) || isUploaded}
                    disableShare={!user || game.isPaused || sharingGames.has(game.id)}
                  >
                    <div className={`game-card ${game.isImported ? 'imported-game' : ''}`}>
                      <div className="settings-card-header">
                        <div className="game-info">
                          <div className="game-name">
                            {t('common.wizard')}
                            {game.isPaused ? ' | ' + t('common.paused') : ''}
                          </div>
                          <div className="game-badges">
                            {eloData && eloData.change !== undefined && (
                              <span className={`mode-badge ${eloData.change >= 0 ? 'elo-positive' : 'elo-negative'}`}>
                                {eloData.change >= 0 ? '+' : ''}{Math.round(eloData.change)} ELO
                              </span>
                            )}
                            <span className={`mode-badge ${badgeClass}`}>
                              {status}
                            </span>
                          </div>
                        </div>
                        <div className="game-players">
                          <UsersIcon size={12} />{" "}
                          {game.players && game.players.length > 0
                            ? (Array.isArray(game.players[0]) || typeof game.players[0] === 'string'
                                ? game.players.join(", ")
                                : game.players.map(p => p.name || t('common.unknownPlayer')).join(", "))
                            : t('common.noPlayers')}
                        </div>
                        <div className="actions-game-history">
                          <div className="bottom-actions-game-history">
                            <div className="game-rounds">{t('common.rounds')}: {(() => {
                              const rounds = game.gameFinished 
                                ? (game.total_rounds || game.totalRounds || game.roundsCompleted || "N/A") 
                                : (game._internalState?.currentRound || game.roundsCompleted !== undefined ? (game._internalState?.currentRound || game.roundsCompleted + 1) : "N/A");
                              return rounds;
                            })()}</div>
                            <div className="game-date">
                              {(() => {
                                const dateToUse = game.created_at || game.lastPlayed;
                                return formatDate(dateToUse);
                              })()}
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
            <p className="no-games">{t('account.noGamesMatchFilters')}</p>
          ) : (
            <p className="no-games">{t('account.noSavedGames')}</p>
          )}
        </div>

        {/* Table Games Section */}
        <div className="settings-section" style={{background: 'transparent', border: 'none', padding: '0'}}>
          <div className="section-header">
            <h2>{t('account.tableGamesTitle', { count: savedTableGames.length })}</h2>
          </div>
          {savedTableGames.length > 0 ? (
            <div className="game-history">
              {savedTableGames.map((game) => {
                const isUploaded = LocalTableGameStorage.isGameUploaded(game.id);
                const showSync = !isUploaded && game.gameFinished;
                
                // Get ELO data for synced games
                const cloudGameId = game.cloudGameId;
                const eloData = cloudGameId ? gameEloMap.get(cloudGameId.toString()) : null;
                
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
                            ? t('accountMessages.tableGameAlreadyUploadedMarked') 
                            : t('accountMessages.tableGameUploadedSuccess'), 
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
                      uploadingGames.has(game.id) ? t('account.syncTitleUploadingTableGame') :
                      !game.gameFinished ? t('account.syncTitleCannotUploadUnfinished') :
                      !user ? t('account.syncTitleSignInToUpload') :
                      t('account.syncTitleUploadToCloud')
                    }
                    disableSync={uploadingGames.has(game.id)}
                  >
                    <div className="game-card table-game-card">
                      <div className="settings-card-header">
                        <div className="game-info">
                          <div className="game-name">
                            {game.name}
                          </div>
                          <div className="game-badges">
                            {eloData && eloData.change !== undefined && (
                              <span className={`mode-badge ${eloData.change >= 0 ? 'elo-positive' : 'elo-negative'}`}>
                                {eloData.change >= 0 ? '+' : ''}{Math.round(eloData.change)} ELO
                              </span>
                            )}
                            {isUploaded && (
                              <span className="mode-badge synced" title={t('account.syncedToCloud')}>
                                {t('common.synced')}
                              </span>
                            )}
                            {!isUploaded && (
                              <span className="mode-badge table">
                                {t('common.local')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="game-players">
                          <UsersIcon size={12} />{" "}
                          {game.players.join(", ")}
                        </div>
                        <div className="actions-game-history">
                          <div className="bottom-actions-game-history">
                            <div>{t('common.rounds')}: {game.totalRounds}</div>
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
            <p className="no-games">{t('account.noTableGames')}</p>
          )}
        </div>

        {/* End of Games Tab */}
        </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="tab-content">
            {/* Account Settings */}
            {user && (
              <div className="settings-section account-settings-section">
                <h3 className="settings-section-title">{t('account.accountSettings')}</h3>
                <div className="settings-option">
                  <button 
                    className="settings-button" 
                    onClick={() => setShowPasswordChangeModal(true)}
                  >
                    <KeyIcon size={18} />
                    {t('account.changePassword')}
                  </button>
                </div>
                {user.role !== 'admin' && (
                  <div className="settings-option">
                    <button 
                      className="settings-button danger-button" 
                      onClick={() => setShowAccountDeleteModal(true)}
                    >
                      <TrashIcon size={18} />
                      {t('account.deleteAccount')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Theme Settings */}
            <div className="settings-section">
              <h3 className="settings-section-title">{t('account.themeSettings')}</h3>
              <div className="settings-option">
                <button 
                  className="settings-button"
                  onClick={toggleTheme}
                  disabled={useSystemTheme}
                >
                  {theme === 'dark' ? t('account.themeDark') : t('account.themeLight')}
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
                    <p style={{margin: 0}}>{t('account.systemThemeLabel')}</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Language Settings */}
            <div className="settings-section">
              <h3 className="settings-section-title">{t('account.languageSettings')}</h3>
              <div className="settings-option">
                <LanguageSwitcher />
              </div>
            </div>

            {/* Update Settings */}
            <div className="settings-section">
              <h3 className="settings-section-title">{t('account.updateSettings')}</h3>
              <div className="settings-option">
                <label style={{display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center'}}>
                  <input
                    type="checkbox"
                    checked={autoUpdate}
                    onChange={handleAutoUpdateChange}
                    style={{
                      width: '15px', 
                      height: '15px',
                      cursor: 'pointer'
                    }}
                  />
                  <div>
                    <p>
                      {autoUpdate 
                        ? t('account.autoUpdateEnabled') 
                        : t('account.autoUpdateDisabled')}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Data Management */}
            <div className="settings-section">
              <h3 className="settings-section-title">{t('account.dataManagement')}</h3>
              <div className="settings-card info-card">
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">{t('account.storageFormat')}</span>
                    <span className="info-value">
                      {migrationStatus && migrationStatus.version === '3.0' ? t('account.storageFormatV3') : t('account.storageFormatLegacy')}
                    </span>
                  </div>
                  {migrationStatus && migrationStatus.lastMigration && (
                    <div className="info-item">
                      <span className="info-label">{t('account.lastMigration')}</span>
                      <span className="info-value">
                        {formatDate(migrationStatus.lastMigration)}
                      </span>
                    </div>
                  )}
                  {needsMigration && (
                    <div className="info-item" style={{gridColumn: '1 / -1'}}>
                      <span style={{color: 'var(--warning)', fontSize: '0.9rem'}}>
                        ⚠️ {t('account.needsMigrationWarning')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <button 
                className="settings-button-update"
                onClick={handleMigrateGames}
                disabled={migrating || (!needsMigration && migrationStatus?.version === '3.0')}
                title={t('account.migrateTitle')}
                style={{marginTop: 'var(--spacing-md)', width: '100%'}}
              >
                <RefreshIcon size={18} />
                {migrating ? t('account.migrating') : needsMigration ? t('account.migrateGamesToV3') : t('account.allGamesUpToDate')}
              </button>
              {migrationStatus && migrationStatus.stats && (
                <div style={{fontSize: '0.85rem', color: 'var(--text-light)', marginTop: 'var(--spacing-sm)'}}>
                  {t('account.lastMigrationStats', { migrated: migrationStatus.stats.migrated, alreadyV3: migrationStatus.stats.alreadyV3 })}
                </div>
              )}
            </div>

            {/* App Information */}
            <div className="settings-section">
              <h3 className="settings-section-title">{t('account.appInformation')}</h3>
              <div className="settings-card info-card">
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">{t('account.versionLabel')}</span>
                    <span className="info-value">{import.meta.env.VITE_APP_VERSION || '1.10.13'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">{t('account.buildDateLabel')}</span>
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
                  title={t('account.checkForUpdatesTitle')}
                >
                  <RefreshIcon size={18} />{t('account.checkForUpdates')}
                </button>
                <button 
                  className={`settings-button-update`}
                  onClick={handleForceUpdate}
                  disabled={forcingUpdate || checkingForUpdates}
                  title={t('account.forceUpdateTitle')}
                  style={{backgroundColor: 'var(--primary)'}}
                >
                  <TrashIcon size={18} />{t('account.forceUpdate')}
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

        <ProfilePictureModal
          isOpen={showProfilePictureModal}
          onClose={() => setShowProfilePictureModal(false)}
          imageUrl={sanitizeImageUrl(avatarUrl, defaultAvatar)}
          altText="Profile Picture"
        />

        {/* Password Change Modal */}
        {showPasswordChangeModal && (
          <div className="modal-overlay" onClick={() => setShowPasswordChangeModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>{t('passwordModal.title')}</h2>
              <form onSubmit={handlePasswordChange}>
                <div className="form-group">
                  <label htmlFor="currentPassword">{t('passwordModal.currentPassword')}</label>
                  <input
                    type="password"
                    id="currentPassword"
                    value={passwordChangeData.currentPassword}
                    onChange={(e) => setPasswordChangeData({
                      ...passwordChangeData,
                      currentPassword: e.target.value
                    })}
                    required
                    disabled={passwordChangeLoading}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="newPassword">{t('passwordModal.newPassword')}</label>
                  <input
                    type="password"
                    id="newPassword"
                    value={passwordChangeData.newPassword}
                    onChange={(e) => setPasswordChangeData({
                      ...passwordChangeData,
                      newPassword: e.target.value
                    })}
                    required
                    minLength={6}
                    disabled={passwordChangeLoading}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="confirmPassword">{t('passwordModal.confirmNewPassword')}</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={passwordChangeData.confirmPassword}
                    onChange={(e) => setPasswordChangeData({
                      ...passwordChangeData,
                      confirmPassword: e.target.value
                    })}
                    required
                    minLength={6}
                    disabled={passwordChangeLoading}
                  />
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowPasswordChangeModal(false)}
                    disabled={passwordChangeLoading}
                  >
                    {t('passwordModal.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={passwordChangeLoading}
                  >
                    {passwordChangeLoading ? t('passwordModal.changing') : t('passwordModal.changePassword')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Account Deletion Modal */}
        {showAccountDeleteModal && (
          <div className="modal-overlay" onClick={() => setShowAccountDeleteModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2 style={{ color: 'var(--danger-color)' }}>{t('deleteAccountModal.title')}</h2>
              <p style={{ marginBottom: 'var(--spacing-md)' }}>
                {t('deleteAccountModal.permanentWarning')}
              </p>
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <strong>{t('deleteAccountModal.willBeRemovedTitle')}</strong>
                <ul style={{ marginTop: '0.5rem', paddingLeft: 'var(--spacing-md)' }}>
                  <li>{t('deleteAccountModal.removedUsername')}</li>
                  <li>{t('deleteAccountModal.removedFriends')}</li>
                  <li>{t('deleteAccountModal.removedIdentities')}</li>
                </ul>
              </div>
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <strong>{t('deleteAccountModal.willBePreservedTitle')}</strong>
                <ul style={{ marginTop: '0.5rem', paddingLeft: 'var(--spacing-md)' }}>
                  <li>{t('deleteAccountModal.preservedGames')}</li>
                  <li>{t('deleteAccountModal.preservedTemplates')}</li>
                  <li>{t('deleteAccountModal.preservedHistory')}</li>
                </ul>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  {t('deleteAccountModal.preservedNote')}
                </p>
              </div>
              <form onSubmit={handleAccountDeletion}>
                <div className="form-group">
                  <label htmlFor="deletePassword">{t('deleteAccountModal.confirmLabel')}</label>
                  <input
                    type="password"
                    id="deletePassword"
                    value={deleteAccountPassword}
                    onChange={(e) => setDeleteAccountPassword(e.target.value)}
                    required
                    disabled={accountDeletionLoading}
                    placeholder={t('deleteAccountModal.passwordPlaceholder')}
                  />
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowAccountDeleteModal(false)}
                    disabled={accountDeletionLoading}
                  >
                    {t('deleteAccountModal.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn-danger"
                    disabled={accountDeletionLoading}
                  >
                    {accountDeletionLoading ? t('deleteAccountModal.deleting') : t('deleteAccountModal.deleteMyAccount')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Debug Panel for Mobile (Admin Only) */}
        {showDebugPanel && user && user.role === 'admin' && (
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: '50vh',
            background: 'var(--card-bg)',
            border: '2px solid var(--primary-color)',
            borderRadius: '12px 12px 0 0',
            padding: 'var(--spacing-md)',
            overflow: 'auto',
            zIndex: 1000,
            boxShadow: '0 -4px 20px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>🐛 {t('account.debugLog')}</h3>
              <button 
                onClick={() => setDebugLogs([])}
                style={{ 
                  padding: '4px 8px', 
                  fontSize: '0.8rem',
                  background: 'var(--danger-color)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                {t('account.clearDebugLogs')}
              </button>
            </div>
            <div style={{ 
              fontSize: '0.75rem', 
              fontFamily: 'monospace',
              maxHeight: '40vh',
              overflow: 'auto'
            }}>
              {debugLogs.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>{t('account.noDebugLogs')}</p>
              ) : (
                debugLogs.map((log, idx) => (
                  <div key={idx} style={{ 
                    marginBottom: 'var(--spacing-xs)', 
                    padding: 'var(--spacing-xs)',
                    background: 'var(--secondary-bg)',
                    borderRadius: '4px',
                    borderLeft: log.message.includes('🆔 Game ID') ? '3px solid var(--success-color)' : '3px solid var(--primary-color)'
                  }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                      {log.timestamp}
                    </div>
                    <div style={{ 
                      marginTop: '2px',
                      fontWeight: log.message.includes('🆔 Game ID') ? 'bold' : 'normal',
                      fontSize: log.message.includes('🆔 Game ID') ? '0.85rem' : '0.75rem'
                    }}>
                      {log.message}
                    </div>
                    {log.data && (
                      <pre style={{ 
                        marginTop: '4px', 
                        fontSize: '0.7rem', 
                        background: 'var(--bg-color)', 
                        padding: '4px',
                        borderRadius: '2px',
                        overflow: 'auto',
                        maxHeight: '150px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                      }}>
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
  );
};

export default Account;
