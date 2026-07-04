"use client"

import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { useTheme } from '@/shared/hooks/useTheme';
import { useUser } from '@/shared/hooks/useUser';

import { sanitizeImageUrl } from '@/shared/utils/urlSanitizer';
import { LocalGameStorage, LocalTableGameStorage, LocalScoreboardGameStorage } from '@/shared/api';
import { ShareValidator } from '@/shared/utils/shareValidator';
import { migrateLocalStorageGames, getMigrationStatus, hasGamesNeedingMigration } from '@/shared/utils/localStorageMigration';
import { TrashIcon, RefreshIcon, LogOutIcon, KeyIcon, XIcon, CheckMarkIcon, ChevronRightIcon } from '@/components/ui/Icon';
import { supportedLanguages } from '@/shared/i18n/i18n';
import DeleteConfirmationModal from '@/components/modals/DeleteConfirmationModal';

import ProfilePictureModal from '@/components/modals/ProfilePictureModal';
import authService from '@/shared/api/authService';
import userService from '@/shared/api/userService';
import avatarService from '@/shared/api/avatarService';
import defaultAvatar from "@/assets/default-avatar.png";
import { batchCheckGamesSyncStatus } from '@/shared/utils/syncChecker';
import { createLogger } from '@/shared/utils/logger';
const PerformanceStatsEnhanced = lazy(() => import('@/pages/profile/PerformanceStatsEnhanced'));
import StatsOverview from '@/components/stats/StatsOverview';
import '@/styles/pages/account.css';

const logger = createLogger('account');
const syncLogger = logger.child('sync');
const autoSyncLogger = syncLogger.child('auto');

const Account = () => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview'); // overview, stats, settings
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

  const [avatarUrl, setAvatarUrl] = useState(defaultAvatar); // Avatar URL state
  const [showProfilePictureModal, setShowProfilePictureModal] = useState(false); // Profile picture modal

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

  const getCombinedLocalTableGames = useCallback(() => {
    const tableGames = LocalTableGameStorage.getSavedTableGamesList().map((game) => ({
      ...game,
      storageType: 'table',
    }));

    const scoreboardGames = LocalScoreboardGameStorage.getSavedTableGamesList().map((game) => ({
      ...game,
      storageType: 'scoreboard',
    }));

    return [...tableGames, ...scoreboardGames].sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed));
  }, []);

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
    const tableGames = getCombinedLocalTableGames();
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
                syncLogger.debug('Table game missing on server, clearing upload status', { gameId: game.id });
                LocalTableGameStorage.clearUploadStatus(game.id);
                // Reload games to reflect changes
                const updatedTableGames = getCombinedLocalTableGames();
                setSavedTableGames(updatedTableGames);
              } else {
                syncLogger.debug('Error checking table game on server', { gameId: game.id, error: error.message });
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
            await batchCheckGamesSyncStatus(gameIds);
          }
        } catch (error) {
          syncLogger.debug('Error checking batch sync status', { error: error.message });
        }
      }, 1000); // Reduced delay since batch check is much faster

      // Auto-sync: download cloud games that don't exist locally
      // This ensures cross-device visibility without manual download
      setTimeout(async () => {
        try {
          autoSyncLogger.debug('Starting automatic cloud game sync');
          let totalDownloaded = 0;

          // Auto-download wizard games from cloud
          const { getUserCloudGamesList, downloadSelectedCloudGames } = await import('@/shared/api/gameService');
          const cloudWizardGames = await getUserCloudGamesList();
          const missingWizardGames = cloudWizardGames.filter(g => !g.existsLocally);
          
          if (missingWizardGames.length > 0) {
            autoSyncLogger.info('Wizard games queued for download', { count: missingWizardGames.length });
            const wizardResult = await downloadSelectedCloudGames(missingWizardGames.map(g => g.cloudId));
            totalDownloaded += wizardResult.downloaded || 0;
          }

          // Auto-download table games from cloud
          const { getUserCloudTableGamesList, downloadSelectedCloudTableGames } = await import('@/shared/api/tableGameService');
          const cloudTableGames = await getUserCloudTableGamesList();
          const missingTableGames = cloudTableGames.filter(g => !g.existsLocally);
          
          if (missingTableGames.length > 0) {
            autoSyncLogger.info('Table games queued for download', { count: missingTableGames.length });
            const tableResult = await downloadSelectedCloudTableGames(missingTableGames.map(g => g.cloudId));
            totalDownloaded += tableResult.downloaded || 0;
          }

          if (totalDownloaded > 0) {
            autoSyncLogger.info('Downloaded games from cloud', { totalDownloaded });
            // Refresh local games to include newly downloaded ones
            const updatedGames = LocalGameStorage.getAllSavedGames();
            setSavedGames(updatedGames);
            const updatedTableGames = getCombinedLocalTableGames();
            setSavedTableGames(updatedTableGames);
          } else {
            autoSyncLogger.debug('All cloud games already exist locally');
          }
        } catch (error) {
          autoSyncLogger.warn('Auto-sync failed (local games remain available)', { error: error.message });
        }
      }, 2000); // Wait 2 seconds to avoid rate limiting with other checks

      // Auto-upload: upload local games (all types) scored while not logged in
      setTimeout(async () => {
        try {
          const { createGame } = await import('@/shared/api/gameService');
          const { createTableGame } = await import('@/shared/api/tableGameService');
          let totalUploaded = 0;

          // Upload unsynced wizard games
          const localGames = LocalGameStorage.getAllSavedGames();
          const unsyncedWizard = Object.entries(localGames).filter(([, game]) =>
            game.gameFinished && !game.isUploaded && !game.isImported && !game.isShared && !game.originalGameId
          );
          for (let i = 0; i < unsyncedWizard.length; i++) {
            const [gameId, gameData] = unsyncedWizard[i];
            try {
              if (i > 0) await new Promise(resolve => setTimeout(resolve, 300));
              const result = await createGame(gameData, gameId);
              if (result?.game?.id) {
                LocalGameStorage.markGameAsUploaded(gameId, result.game.id);
                totalUploaded++;
              }
            } catch (uploadError) {
              autoSyncLogger.warn('Failed to upload wizard game', { gameId, error: uploadError.message });
            }
          }

          // Upload unsynced table games
          const allTableGames = LocalTableGameStorage.getAllSavedTableGamesAllUsers();
          const unsyncedTable = Object.entries(allTableGames).filter(([, game]) =>
            game.gameFinished && !game.isUploaded
          );
          for (let i = 0; i < unsyncedTable.length; i++) {
            const [gameId, record] = unsyncedTable[i];
            try {
              if (i > 0) await new Promise(resolve => setTimeout(resolve, 300));
              const gameData = record.gameData?.gameData || record.gameData || record;
              const result = await createTableGame(gameData, gameId);
              if (result?.game?._id) {
                LocalTableGameStorage.markGameAsUploaded(gameId, result.game._id);
                totalUploaded++;
              }
            } catch (uploadError) {
              autoSyncLogger.warn('Failed to upload table game', { gameId, error: uploadError.message });
            }
          }

          // Upload unsynced scoreboard games
          const allScoreboardGames = LocalScoreboardGameStorage.getAllSavedTableGamesAllUsers();
          const unsyncedScoreboard = Object.entries(allScoreboardGames).filter(([, game]) =>
            game.gameFinished && !game.isUploaded
          );
          for (let i = 0; i < unsyncedScoreboard.length; i++) {
            const [gameId, record] = unsyncedScoreboard[i];
            try {
              if (i > 0) await new Promise(resolve => setTimeout(resolve, 300));
              const gameData = record.gameData?.gameData || record.gameData || record;
              const result = await createTableGame(gameData, gameId);
              if (result?.game?._id) {
                LocalScoreboardGameStorage.markGameAsUploaded(gameId, result.game._id);
                totalUploaded++;
              }
            } catch (uploadError) {
              autoSyncLogger.warn('Failed to upload scoreboard game', { gameId, error: uploadError.message });
            }
          }

          if (totalUploaded > 0) {
            autoSyncLogger.info('Uploaded pending local games to cloud', { totalUploaded });
            setSavedGames(LocalGameStorage.getAllSavedGames());
            setSavedTableGames(getCombinedLocalTableGames());
          } else {
            autoSyncLogger.debug('No unsynced local games to upload');
          }
        } catch (error) {
          autoSyncLogger.warn('Auto-upload of local games failed', { error: error.message });
        }
      }, 3000); // Wait 3 seconds after the download sync
    }
  }, [user, getCombinedLocalTableGames]);

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
      syncLogger.debug('Fetching cloud games', { userId: user.id });
      const userService = (await import('@/shared/api/userService')).default;
      const data = await userService.getUserPublicProfile(user.id);
      
      syncLogger.info('Fetched cloud games from API', {
        username: data.username,
        identities: data.identities,
        totalGames: data.totalGames,
        gamesCount: data.games?.length || 0
      });
      
      setProfileData(data);
      setCloudGames(data.games || []);
    } catch (error) {
      syncLogger.error('Failed to fetch cloud games', { error });
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
        if (gameToDelete.storageType === 'scoreboard') {
          LocalScoreboardGameStorage.deleteTableGame(gameToDelete.id);
        } else {
          LocalTableGameStorage.deleteTableGame(gameToDelete.id);
        }
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
      logger.info('Cleared caches during force update', { count: cacheNames.length });
      
      // Unregister service workers
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
      logger.info('Unregistered service workers during force update', { count: registrations.length });
      
      setMessage({ text: t('accountMessages.cachesCleared'), type: 'success' });
      
      // Hard reload after a short delay
      setTimeout(() => {
        globalThis.location.reload(true);
      }, 1000);
    } catch (error) {
      logger.error('Error forcing update', { error });
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
    const wizardGames = gamesSource.filter(g => g.gameType !== 'table' && g.gameType !== 'scoreboard');
    const tableGames = gamesSource.filter(g => g.gameType === 'table' || g.gameType === 'scoreboard');
    
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
    const wizardGames = gamesSource.filter(g => g.gameType !== 'table' && g.gameType !== 'scoreboard');
    if (wizardGames.length > 0) {
      types.push({ value: 'wizard', label: 'Wizard' });
    }
    
    // Add table game types
    const tableGameTypes = new Set();
    gamesSource
      .filter(g => g.gameType === 'table' || g.gameType === 'scoreboard')
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
                      width: '80px',
                      height: '80px',
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
                  <Trans i18nKey="account.loginToViewStats" components={{ loginLink: <Link to="/login" /> }} />
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
                  <Suspense fallback={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                      <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    </div>
                  }>
                    <PerformanceStatsEnhanced
                      games={allGamesForStats}
                      currentPlayer={currentPlayer}
                      isWizardGame={statsGameType === 'wizard'}
                      gameType={statsGameType}
                    />
                  </Suspense>
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

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="tab-content settings-tab">

            {/* Appearance & Language */}
            <div className="settings-group">
              <div className="settings-group-content">
                <div className="settings-row">
                  <div className="settings-row-left">
                    <span>{t('account.systemThemeLabel')}</span>
                  </div>
                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      checked={useSystemTheme}
                      onChange={(e) => setUseSystemTheme(e.target.checked)}
                    />
                    <span className="settings-switch-slider"></span>
                  </label>
                </div>
                {!useSystemTheme && (
                  <>
                    <button
                      className={`settings-row settings-row-clickable settings-theme-row ${theme === 'dark' ? 'settings-theme-active' : ''}`}
                      onClick={() => { if (theme !== 'dark') toggleTheme(); }}
                    >
                      <div className="settings-row-left">
                        <span>{t('account.themeDark')}</span>
                      </div>
                      {theme === 'dark' && (
                        <CheckMarkIcon size={18} className="settings-lang-check" />
                      )}
                    </button>
                    <button
                      className={`settings-row settings-row-clickable settings-theme-row ${theme === 'light' ? 'settings-theme-active' : ''}`}
                      onClick={() => { if (theme !== 'light') toggleTheme(); }}
                    >
                      <div className="settings-row-left">
                        <span>{t('account.themeLight')}</span>
                      </div>
                      {theme === 'light' && (
                        <CheckMarkIcon size={18} className="settings-lang-check" />
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Language */}
            <div className="settings-group">
              <div className="settings-group-content">
                {supportedLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    className={`settings-row settings-row-clickable settings-lang-row ${i18n.resolvedLanguage === lang.code ? 'settings-lang-active' : ''}`}
                    onClick={() => i18n.changeLanguage(lang.code)}
                  >
                    <div className="settings-row-left">
                      <span className="settings-lang-flag">{lang.flag}</span>
                      <span>{lang.name}</span>
                    </div>
                    {i18n.resolvedLanguage === lang.code && (
                      <CheckMarkIcon size={18} className="settings-lang-check" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Updates */}
            <div className="settings-group">
              <div className="settings-group-content">
                <div className="settings-row">
                  <div className="settings-row-left">
                    <span>{t('account.autoUpdates')}</span>
                  </div>
                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      checked={autoUpdate}
                      onChange={handleAutoUpdateChange}
                    />
                    <span className="settings-switch-slider"></span>
                  </label>
                </div>
                <button 
                  className="settings-row settings-row-clickable"
                  onClick={handleCheckForUpdates}
                  disabled={checkingForUpdates || forcingUpdate}
                  title={t('account.checkForUpdatesTitle')}
                >
                  <div className="settings-row-left">
                    <RefreshIcon size={18} className="settings-row-icon" />
                    <span>{t('account.checkForUpdates')}</span>
                  </div>
                </button>
                <button 
                  className="settings-row settings-row-clickable"
                  onClick={handleForceUpdate}
                  disabled={forcingUpdate || checkingForUpdates}
                  title={t('account.forceUpdateTitle')}
                >
                  <div className="settings-row-left">
                    <RefreshIcon size={18} className="settings-row-icon" />
                    <span>{t('account.forceUpdate')}</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Account */}
            {user && (
              <div className="settings-group">
                <div className="settings-group-content">
                  <button 
                    className="settings-row settings-row-clickable" 
                    onClick={() => setShowPasswordChangeModal(true)}
                  >
                    <div className="settings-row-left">
                      <KeyIcon size={18} className="settings-row-icon" />
                      <span>{t('account.changePassword')}</span>
                    </div>
                    <ChevronRightIcon size={18} className="settings-row-chevron" />
                  </button>
                </div>
              </div>
            )}

            {/* App Information */}
            <div className="settings-group">
              <div className="settings-group-content">
                <div className="settings-row">
                  <span className="settings-row-label">{t('account.versionLabel')}</span>
                  <span className="settings-row-value">{import.meta.env.VITE_APP_VERSION || '1.10.13'}</span>
                </div>
                <div className="settings-row">
                  <span className="settings-row-label">{t('account.buildDateLabel')}</span>
                  <span className="settings-row-value">
                    {formatDate(import.meta.env.VITE_BUILD_DATE || new Date().toISOString())}
                  </span>
                </div>
              </div>
            </div>

            {/* Data Management */}
            <div className="settings-group">
              <div className="settings-group-content">
                <div className="settings-row">
                  <span className="settings-row-label">{t('account.storageFormat')}</span>
                  <span className="settings-row-value">
                    {migrationStatus && migrationStatus.version === '3.0' ? t('account.storageFormatV3') : t('account.storageFormatLegacy')}
                  </span>
                </div>
                {migrationStatus && migrationStatus.lastMigration && (
                  <div className="settings-row">
                    <span className="settings-row-label">{t('account.lastMigration')}</span>
                    <span className="settings-row-value">
                      {formatDate(migrationStatus.lastMigration)}
                    </span>
                  </div>
                )}
                {needsMigration && (
                  <div className="settings-row settings-row-warning">
                    <span>⚠️ {t('account.needsMigrationWarning')}</span>
                  </div>
                )}
                <button 
                  className="settings-row settings-row-clickable"
                  onClick={handleMigrateGames}
                  disabled={migrating || (!needsMigration && migrationStatus?.version === '3.0')}
                  title={t('account.migrateTitle')}
                >
                  <div className="settings-row-left">
                    <RefreshIcon size={18} className="settings-row-icon" />
                    <span>{migrating ? t('account.migrating') : needsMigration ? t('account.migrateGamesToV3') : t('account.allGamesUpToDate')}</span>
                  </div>
                </button>
                {migrationStatus && migrationStatus.stats && (
                  <div className="settings-row settings-row-muted">
                    <span>{t('account.lastMigrationStats', { migrated: migrationStatus.stats.migrated, alreadyV3: migrationStatus.stats.alreadyV3 })}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="settings-group settings-group-danger">
              <div className="settings-group-content">
                <button 
                  className="settings-row settings-row-clickable settings-row-danger"
                  onClick={handleDeleteAllData}
                >
                  <div className="settings-row-left">
                    <TrashIcon size={18} className="settings-row-icon" />
                    <span>{t('account.clearAllData')}</span>
                  </div>
                  <ChevronRightIcon size={18} className="settings-row-chevron" />
                </button>
                {user && user.role !== 'admin' && (
                  <button 
                    className="settings-row settings-row-clickable settings-row-danger"
                    onClick={() => setShowAccountDeleteModal(true)}
                  >
                    <div className="settings-row-left">
                      <TrashIcon size={18} className="settings-row-icon" />
                      <span>{t('account.deleteAccount')}</span>
                    </div>
                    <ChevronRightIcon size={18} className="settings-row-chevron" />
                  </button>
                )}
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

        <ProfilePictureModal
          isOpen={showProfilePictureModal}
          onClose={() => setShowProfilePictureModal(false)}
          imageUrl={sanitizeImageUrl(avatarUrl, defaultAvatar)}
          altText="Profile Picture"
        />

        {/* Password Change Modal */}
        {showPasswordChangeModal && (
          <div className="modal-overlay" onClick={() => setShowPasswordChangeModal(false)}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{t('passwordModal.title')}</h2>
                <button className="modal-close-btn" onClick={() => setShowPasswordChangeModal(false)}>
                  <XIcon size={18} />
                </button>
              </div>
              <div className="modal-content">
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
          </div>
        )}

        {/* Account Deletion Modal */}
        {showAccountDeleteModal && (
          <div className="modal-overlay" onClick={() => setShowAccountDeleteModal(false)}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 style={{ color: 'var(--danger-color)' }}>{t('deleteAccountModal.title')}</h2>
                <button className="modal-close-btn" onClick={() => setShowAccountDeleteModal(false)}>
                  <XIcon size={18} />
                </button>
              </div>
              <div className="modal-content">
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
          </div>
        )}


      </div>
  );
};

export default Account;
