import React, { useState, useEffect, useRef, useCallback } from 'react';
import { XIcon } from '@/components/ui/Icon';
import { useTranslation } from 'react-i18next';

const RELOAD_COOLDOWN_MS = 10000; // 10 seconds between reloads
const LAST_RELOAD_KEY = 'last_sw_reload';
const LAST_SW_VERSION_KEY = 'last_sw_version';
const UPDATE_IN_PROGRESS_KEY = 'sw_update_in_progress';
const MAX_RELOAD_ATTEMPTS = 3;
const RELOAD_ATTEMPTS_KEY = 'sw_reload_attempts';
const SNOOZE_KEY = 'sw_update_snoozed_until';
const SNOOZE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours
const DISMISSED_KEY = 'sw_update_dismissed_version'; // Track dismissed version for session

// Semantic version comparison utilities
const parseVersion = (version) => {
  if (!version) return null;
  const clean = version.replace(/^v/, '');
  const [major, minor, patch] = clean.split('.').map(n => Number.parseInt(n, 10) || 0);
  return { major, minor, patch, raw: clean };
};

const compareVersions = (v1, v2) => {
  const parsed1 = parseVersion(v1);
  const parsed2 = parseVersion(v2);
  
  if (!parsed1 || !parsed2) return 0;
  
  if (parsed1.major !== parsed2.major) return parsed1.major - parsed2.major;
  if (parsed1.minor !== parsed2.minor) return parsed1.minor - parsed2.minor;
  return parsed1.patch - parsed2.patch;
};

const getUpdateType = (oldVersion, newVersion) => {
  const oldParsed = parseVersion(oldVersion);
  const newParsed = parseVersion(newVersion);
  
  if (!oldParsed || !newParsed) return 'unknown';
  
  if (newParsed.major > oldParsed.major) return 'major';
  if (newParsed.minor > oldParsed.minor) return 'minor';
  if (newParsed.patch > oldParsed.patch) return 'patch';
  return 'none';
};

const UpdateNotification = () => {
  const [showNotification, setShowNotification] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [newVersion, setNewVersion] = useState(null);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [updateType, setUpdateType] = useState('unknown');
  const [updateProgress, setUpdateProgress] = useState({ status: 'idle', progress: 0 });
  const [isUpdating, setIsUpdating] = useState(false);
  const updateHandledRef = useRef(false);
  const controllerChangeHandledRef = useRef(false);
  const { t } = useTranslation();

  // Check if update was snoozed
  const isUpdateSnoozed = () => {
    const snoozedUntil = localStorage.getItem(SNOOZE_KEY);
    if (!snoozedUntil) return false;
    return Date.now() < Number.parseInt(snoozedUntil, 10);
  };

  // Check if update was dismissed for this version (session-based)
  const isUpdateDismissed = (version) => {
    const dismissedVersion = sessionStorage.getItem(DISMISSED_KEY);
    if (!dismissedVersion) return false;
    return dismissedVersion === version;
  };

  // Check if we can safely reload (not in cooldown, not too many attempts)
  const canReload = () => {
    const lastReload = Number.parseInt(localStorage.getItem(LAST_RELOAD_KEY) || '0', 10);
    const timeSinceReload = Date.now() - lastReload;
    const reloadAttempts = Number.parseInt(localStorage.getItem(RELOAD_ATTEMPTS_KEY) || '0', 10);
    const updateInProgress = sessionStorage.getItem(UPDATE_IN_PROGRESS_KEY);
    
    if (updateInProgress === 'true') {
      console.debug('❌ Update already in progress, skipping reload');
      return false;
    }
    
    if (timeSinceReload < RELOAD_COOLDOWN_MS) {
      console.debug(`❌ In reload cooldown (${Math.ceil((RELOAD_COOLDOWN_MS - timeSinceReload) / 1000)}s remaining)`);
      return false;
    }
    
    if (reloadAttempts >= MAX_RELOAD_ATTEMPTS) {
      console.warn('❌ Max reload attempts reached. Manual intervention required.');
      // Clear attempts after 1 hour
      if (timeSinceReload > 3600000) {
        localStorage.removeItem(RELOAD_ATTEMPTS_KEY);
        return true;
      }
      return false;
    }
    
    return true;
  };

  // Get version from service worker
  const getServiceWorkerVersion = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return null;
    
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return null;
      
      const worker = registration.active || registration.waiting || registration.installing;
      if (!worker) return null;
      
      // Create a message channel to get version
      return new Promise((resolve) => {
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data?.version || null);
        };
        
        worker.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2]);
        
        // Timeout after 2 seconds
        setTimeout(() => resolve(null), 2000);
      });
    } catch (error) {
      console.error('Error getting service worker version:', error);
      return null;
    }
  }, []);

  // Check if version actually changed
  const hasVersionChanged = useCallback(async () => {
    const newSWVersion = await getServiceWorkerVersion();
    const lastVersion = localStorage.getItem(LAST_SW_VERSION_KEY);
    
    if (!newSWVersion) {
      console.debug('⚠️ Could not determine service worker version');
      return false; // Don't reload if we can't verify version change
    }
    
    if (!lastVersion) {
      // First time tracking version
      console.debug(`📌 Initial version: ${newSWVersion}`);
      localStorage.setItem(LAST_SW_VERSION_KEY, newSWVersion);
      setCurrentVersion(newSWVersion);
      return false;
    }
    
    // Use semantic version comparison
    const comparison = compareVersions(newSWVersion, lastVersion);
    const changed = comparison > 0;
    
    if (changed) {
      const type = getUpdateType(lastVersion, newSWVersion);
      setUpdateType(type);
      setCurrentVersion(lastVersion);
      console.debug(`🔍 Version check: ${lastVersion} -> ${newSWVersion} (${type} update)`);
    } else {
      console.debug(`🔍 Version check: ${lastVersion} -> ${newSWVersion} (No update needed)`);
    }
    
    return changed;
  }, [getServiceWorkerVersion]);

  // Perform reload with safety checks
  const performReload = useCallback(async () => {
    if (updateHandledRef.current) {
      console.debug('❌ Update already handled');
      return;
    }
    
    if (!canReload()) {
      console.debug('❌ Cannot reload - safety check failed');
      setShowNotification(true); // Show notification instead
      return;
    }
    
    const versionChanged = await hasVersionChanged();
    if (!versionChanged) {
      console.debug('❌ Version unchanged or not newer, skipping reload');
      sessionStorage.removeItem('sw_update_ready');
      sessionStorage.removeItem(UPDATE_IN_PROGRESS_KEY);
      return;
    }
    
    updateHandledRef.current = true;
    setIsUpdating(true);
    
    // Get new version for tracking
    const newSWVersion = await getServiceWorkerVersion();
    if (newSWVersion) {
      setNewVersion(newSWVersion);
    }
    
    // Track reload attempt
    const attempts = Number.parseInt(localStorage.getItem(RELOAD_ATTEMPTS_KEY) || '0', 10);
    localStorage.setItem(RELOAD_ATTEMPTS_KEY, (attempts + 1).toString());
    localStorage.setItem(LAST_RELOAD_KEY, Date.now().toString());
    sessionStorage.setItem(UPDATE_IN_PROGRESS_KEY, 'true');
    
    // Clear snooze on successful update
    localStorage.removeItem(SNOOZE_KEY);
    
    console.debug(`🔄 Reloading for update (attempt ${attempts + 1}/${MAX_RELOAD_ATTEMPTS})...`);
    
    // Update stored version before reload
    if (newSWVersion) {
      localStorage.setItem(LAST_SW_VERSION_KEY, newSWVersion);
    }
    
    setTimeout(() => {
      sessionStorage.removeItem('sw_update_ready');
      globalThis.location.reload();
    }, 500);
  }, [hasVersionChanged, getServiceWorkerVersion]);

  useEffect(() => {
    // Clear update-in-progress flag on mount (in case of crash/manual reload)
    if (sessionStorage.getItem(UPDATE_IN_PROGRESS_KEY) === 'true') {
      const lastReload = Number.parseInt(localStorage.getItem(LAST_RELOAD_KEY) || '0', 10);
      if (Date.now() - lastReload > 30000) { // 30 seconds
        console.debug('🧹 Clearing stale update-in-progress flag');
        sessionStorage.removeItem(UPDATE_IN_PROGRESS_KEY);
        // Reset attempts if old reload completed successfully
        localStorage.removeItem(RELOAD_ATTEMPTS_KEY);
      } else {
        // Recent reload - check if version actually changed
        const checkRecentUpdate = async () => {
          const newSWVersion = await getServiceWorkerVersion();
          const lastVersion = localStorage.getItem(LAST_SW_VERSION_KEY);
          
          if (newSWVersion && lastVersion && compareVersions(newSWVersion, lastVersion) > 0) {
            // Update was successful!
            const type = getUpdateType(lastVersion, newSWVersion);
            console.debug(`✅ Update completed successfully: ${lastVersion} → ${newSWVersion} (${type})`);
            localStorage.setItem(LAST_SW_VERSION_KEY, newSWVersion);
            localStorage.removeItem(RELOAD_ATTEMPTS_KEY);
            sessionStorage.removeItem(UPDATE_IN_PROGRESS_KEY);
            
            // Show success message with update type
            const getToastMessage = (updateType, version) => {
              if (updateType === 'major') return t('updateNotification.toastMajorUpdate', { version });
              if (updateType === 'minor') return t('updateNotification.toastMinorUpdate', { version });
              return t('updateNotification.toastPatchUpdate', { version });
            };
            const event = new CustomEvent('show-toast', {
              detail: { 
                message: getToastMessage(type, newSWVersion), 
                type: 'success',
                duration: 5000
              }
            });
            globalThis.dispatchEvent(event);
          } else if (newSWVersion === lastVersion) {
            // Same version - update completed
            console.debug(`✅ Update confirmed: v${newSWVersion}`);
            localStorage.removeItem(RELOAD_ATTEMPTS_KEY);
            sessionStorage.removeItem(UPDATE_IN_PROGRESS_KEY);
          }
        };
        
        // Check after a short delay to let service worker stabilize
        setTimeout(checkRecentUpdate, 2000);
      }
    }
    
    // Listen for SW update progress messages (from actual SW or dev helper)
    const handleSWMessage = (event) => {
      if (event.data?.type === 'SW_UPDATE_PROGRESS') {
        setUpdateProgress({
          status: event.data.status,
          progress: event.data.progress || 0,
          totalAssets: event.data.totalAssets || 0,
          cachedAssets: event.data.cachedAssets || 0
        });
        
        if (event.data.version) {
          setNewVersion(event.data.version);
        }
      }
      
      if (event.data?.type === 'SW_INSTALLING') {
        setUpdateProgress(prev => ({ ...prev, status: 'downloading' }));
        if (event.data.version) {
          setNewVersion(event.data.version);
        }
      }
    };
    
    // Handle progress events from dev helper (CustomEvent)
    const handleDevProgress = (event) => {
      const data = event.detail;
      if (data?.type === 'SW_UPDATE_PROGRESS') {
        setUpdateProgress({
          status: data.status,
          progress: data.progress || 0,
          totalAssets: data.totalAssets || 0,
          cachedAssets: data.cachedAssets || 0
        });
        
        if (data.version) {
          setNewVersion(data.version);
        }
        
        // Show notification when downloading starts (unless dismissed or snoozed)
        if (data.status === 'downloading' || data.status === 'ready') {
          setUpdateReady(true);
          // Only show if not snoozed and not dismissed for this version
          if (!isUpdateSnoozed() && !isUpdateDismissed(data.version)) {
            setShowNotification(true);
          }
        }
      }
    };
    
    // Listen for dev helper events
    globalThis.addEventListener('sw-update-progress', handleDevProgress);
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }
    
    // Check if auto-update is enabled
    const autoUpdate = localStorage.getItem('autoUpdate');
    const autoUpdateEnabled = autoUpdate === null || autoUpdate === 'true'; // Default to true

    // Listen for update events
    const handleUpdateReady = async () => {
      if (updateHandledRef.current) {
        console.debug('❌ Update already handled, ignoring event');
        return;
      }
      
      // Check if snoozed
      if (isUpdateSnoozed()) {
        console.debug('💤 Update snoozed, skipping notification');
        return;
      }
      
      setUpdateReady(true);
      setUpdateProgress(prev => ({ ...prev, status: 'ready' }));
      
      if (autoUpdateEnabled) {
        // Auto-reload if setting is enabled and safety checks pass
        console.debug('🔄 Auto-update enabled - checking if reload is safe');
        await performReload();
      } else {
        // Show notification if auto-update is disabled
        const versionChanged = await hasVersionChanged();
        if (versionChanged) {
          const newSWVersion = await getServiceWorkerVersion();
          setNewVersion(newSWVersion);
          // Only show if not dismissed for this version
          if (!isUpdateDismissed(newSWVersion)) {
            setShowNotification(true);
          } else {
            console.debug('❌ Update dismissed by user for this version, skipping notification');
          }
        } else {
          console.debug('❌ No version change detected, hiding notification');
          sessionStorage.removeItem('sw_update_ready');
        }
      }
    };

    // Listen for the custom event from service worker
    globalThis.addEventListener('sw-update-ready', handleUpdateReady);

    // Also check on mount if update is already ready
    if (sessionStorage.getItem('sw_update_ready') === 'true') {
      handleUpdateReady();
    }

    // Listen for service worker controller change (with guard)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const handleControllerChange = async () => {
        if (controllerChangeHandledRef.current) {
          console.debug('❌ Controller change already handled');
          return;
        }
        
        controllerChangeHandledRef.current = true;
        console.debug('🔄 Service worker controller changed');
        
        if (!autoUpdateEnabled) {
          const versionChanged = await hasVersionChanged();
          if (versionChanged) {
            const newSWVersion = await getServiceWorkerVersion();
            setNewVersion(newSWVersion);
            // Only show if not dismissed for this version
            if (!isUpdateDismissed(newSWVersion)) {
              setShowNotification(true);
            }
          }
        }
      };
      
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      
      return () => {
        globalThis.removeEventListener('sw-update-ready', handleUpdateReady);
        globalThis.removeEventListener('sw-update-progress', handleDevProgress);
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.removeEventListener('message', handleSWMessage);
        }
      };
    }

    return () => {
      globalThis.removeEventListener('sw-update-ready', handleUpdateReady);
      globalThis.removeEventListener('sw-update-progress', handleDevProgress);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
    };
  }, [hasVersionChanged, performReload, getServiceWorkerVersion]);

  const handleUpdate = async () => {
    if (!canReload()) {
      alert(t('updateNotification.reloadCooldown'));
      return;
    }
    
    await performReload();
  };

  const handleDismiss = () => {
    // Save dismissed version to prevent re-showing until next session or new version
    if (newVersion) {
      sessionStorage.setItem(DISMISSED_KEY, newVersion);
    }
    setShowNotification(false);
    // Still keep the flag so user can update later via Settings
  };
  
  const handleSnooze = () => {
    const snoozeUntil = Date.now() + SNOOZE_DURATION_MS;
    localStorage.setItem(SNOOZE_KEY, snoozeUntil.toString());
    setShowNotification(false);
    console.debug(`💤 Update snoozed for 4 hours`);
  };

  // Get update type label and styling
  const getUpdateInfo = () => {
    switch (updateType) {
      case 'major':
        return { 
          label: t('updateNotification.majorUpdateLabel'), 
          description: t('updateNotification.majorUpdateDescription'),
          color: 'var(--primary)'
        };
      case 'minor':
        return { 
          label: t('updateNotification.minorUpdateLabel'), 
          description: t('updateNotification.minorUpdateDescription'),
          color: 'var(--success, #22c55e)'
        };
      case 'patch':
        return { 
          label: t('updateNotification.patchUpdateLabel'), 
          description: t('updateNotification.patchUpdateDescription'),
          color: 'var(--text-light)'
        };
      default:
        return { 
          label: t('updateNotification.unknownUpdateLabel'), 
          description: t('updateNotification.unknownUpdateDescription'),
          color: 'var(--primary)'
        };
    }
  };

  if (!showNotification || !updateReady) {
    return null;
  }
  
  const updateInfo = getUpdateInfo();
  const showProgress = updateProgress.status === 'downloading' && !isUpdating;
  
  // Map 0-75% progress to 0-100% of border fill, then stay at 100%
  const mappedProgress = Math.min(100, (updateProgress.progress / 75) * 100);
  const progressDeg = (mappedProgress / 100) * 360;

  return (
    <div
      className="update-notification"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        left: '20px',
        maxWidth: '420px',
        margin: '0 auto',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-md)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        zIndex: 10000,
        animation: 'slideUp 0.3s ease-out',
        // Use CSS custom property for smooth animation
        '--progress-deg': `${progressDeg}deg`,
        '--update-color': updateInfo.color,
        backgroundColor: 'var(--card-bg)',
        border: showProgress ? '3px solid transparent' : `2px solid ${updateInfo.color}`,
        background: showProgress 
          ? `linear-gradient(var(--card-bg), var(--card-bg)) padding-box,
             conic-gradient(
               from 270deg,
               var(--update-color) 0deg,
               var(--update-color) var(--progress-deg),
               var(--border) var(--progress-deg),
               var(--border) 360deg
             ) border-box`
          : 'var(--card-bg)',
      }}
    >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-sm)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-xs)', marginBottom: '4px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
              {updateInfo.label}
            </h3>
            {newVersion && (
              <span style={{ 
                fontSize: '0.75rem', 
                padding: '2px 6px', 
                backgroundColor: 'var(--bg-secondary, rgba(255,255,255,0.1))', 
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-light)'
              }}>
                v{newVersion}
              </span>
            )}
          </div>
          
          {currentVersion && newVersion && (
            <p style={{ 
              margin: '0 0 8px 0', 
              fontSize: '0.75rem', 
              color: 'var(--text-muted, var(--text-light))',
              opacity: 0.7
            }}>
              v{currentVersion} → v{newVersion}
            </p>
          )}
          
          <p style={{ margin: '0 0 var(--spacing-md) 0', fontSize: '0.875rem', color: 'var(--text-light)' }}>
            {isUpdating ? t('updateNotification.applyingUpdate') : updateInfo.description}
          </p>
          
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              style={{
                flex: '1 1 auto',
                minWidth: '100px',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                backgroundColor: updateInfo.color,
                color: 'var(--text)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: isUpdating ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                opacity: isUpdating ? 0.7 : 1,
                transition: 'opacity 0.2s, transform 0.1s',
              }}
            >
              {isUpdating ? t('updateNotification.updating') : t('updateNotification.updateNow')}
            </button>
            <div
              style={{
                display: 'flex',
                gap: 'var(--spacing-sm)',
                flex: '1 1 auto',
                minWidth: '100px',
                justifyContent: 'space-between'
                }}>
              <button
                onClick={handleSnooze}
                disabled={isUpdating}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-light)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: isUpdating ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  opacity: isUpdating ? 0.5 : 1,
                }}
                title={t('updateNotification.snoozeTitle')}
              >
                {t('updateNotification.snooze')}
              </button>
              <button
                onClick={handleDismiss}
                disabled={isUpdating}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-light)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: isUpdating ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  opacity: isUpdating ? 0.5 : 1,
                }}
              >
                {t('updateNotification.later')}
              </button>
            </div>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          disabled={isUpdating}
          className='close-btn'
          aria-label={t('updateNotification.dismiss')}
        >
          <XIcon size={20} />
        </button>
      </div>
      
      <style>{`
        @property --progress-deg {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        
        .update-notification {
          transition: --progress-deg 0.4s ease-out, border 0.3s ease, background 0.3s ease;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default UpdateNotification;
