import React, { useState, useEffect, useRef } from 'react';
import { RefreshIcon, XIcon } from '@/components/ui/Icon';

const RELOAD_COOLDOWN_MS = 10000; // 10 seconds between reloads
const LAST_RELOAD_KEY = 'last_sw_reload';
const LAST_SW_VERSION_KEY = 'last_sw_version';
const UPDATE_IN_PROGRESS_KEY = 'sw_update_in_progress';
const MAX_RELOAD_ATTEMPTS = 3;
const RELOAD_ATTEMPTS_KEY = 'sw_reload_attempts';

const UpdateNotification = () => {
  const [showNotification, setShowNotification] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [newVersion, setNewVersion] = useState(null);
  const updateHandledRef = useRef(false);
  const controllerChangeHandledRef = useRef(false);

  // Check if we can safely reload (not in cooldown, not too many attempts)
  const canReload = () => {
    const lastReload = parseInt(localStorage.getItem(LAST_RELOAD_KEY) || '0');
    const timeSinceReload = Date.now() - lastReload;
    const reloadAttempts = parseInt(localStorage.getItem(RELOAD_ATTEMPTS_KEY) || '0');
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
  const getServiceWorkerVersion = async () => {
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
  };

  // Check if version actually changed
  const hasVersionChanged = async () => {
    const currentVersion = await getServiceWorkerVersion();
    const lastVersion = localStorage.getItem(LAST_SW_VERSION_KEY);
    
    if (!currentVersion) {
      console.debug('⚠️ Could not determine service worker version');
      return false; // Don't reload if we can't verify version change
    }
    
    if (!lastVersion) {
      // First time tracking version
      console.debug(`📌 Initial version: ${currentVersion}`);
      localStorage.setItem(LAST_SW_VERSION_KEY, currentVersion);
      return false;
    }
    
    const changed = currentVersion !== lastVersion;
    console.debug(`🔍 Version check: ${lastVersion} -> ${currentVersion} (Changed: ${changed})`);
    
    return changed;
  };

  // Perform reload with safety checks
  const performReload = async () => {
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
      console.debug('❌ Version unchanged, skipping reload');
      sessionStorage.removeItem('sw_update_ready');
      sessionStorage.removeItem(UPDATE_IN_PROGRESS_KEY);
      return;
    }
    
    updateHandledRef.current = true;
    
    // Get new version for tracking
    const currentVersion = await getServiceWorkerVersion();
    if (currentVersion) {
      setNewVersion(currentVersion);
    }
    
    // Track reload attempt
    const attempts = parseInt(localStorage.getItem(RELOAD_ATTEMPTS_KEY) || '0');
    localStorage.setItem(RELOAD_ATTEMPTS_KEY, (attempts + 1).toString());
    localStorage.setItem(LAST_RELOAD_KEY, Date.now().toString());
    sessionStorage.setItem(UPDATE_IN_PROGRESS_KEY, 'true');
    
    console.debug(`🔄 Reloading for update (attempt ${attempts + 1}/${MAX_RELOAD_ATTEMPTS})...`);
    
    // Update stored version before reload
    if (currentVersion) {
      localStorage.setItem(LAST_SW_VERSION_KEY, currentVersion);
    }
    
    setTimeout(() => {
      sessionStorage.removeItem('sw_update_ready');
      globalThis.location.reload();
    }, 500);
  };

  useEffect(() => {
    // Clear update-in-progress flag on mount (in case of crash/manual reload)
    if (sessionStorage.getItem(UPDATE_IN_PROGRESS_KEY) === 'true') {
      const lastReload = parseInt(localStorage.getItem(LAST_RELOAD_KEY) || '0');
      if (Date.now() - lastReload > 30000) { // 30 seconds
        console.debug('🧹 Clearing stale update-in-progress flag');
        sessionStorage.removeItem(UPDATE_IN_PROGRESS_KEY);
        // Reset attempts if old reload completed successfully
        localStorage.removeItem(RELOAD_ATTEMPTS_KEY);
      } else {
        // Recent reload - check if version actually changed
        const checkRecentUpdate = async () => {
          const currentVersion = await getServiceWorkerVersion();
          const lastVersion = localStorage.getItem(LAST_SW_VERSION_KEY);
          
          if (currentVersion && lastVersion && currentVersion !== lastVersion) {
            // Update was successful!
            console.debug(`✅ Update completed successfully: ${lastVersion} → ${currentVersion}`);
            localStorage.setItem(LAST_SW_VERSION_KEY, currentVersion);
            localStorage.removeItem(RELOAD_ATTEMPTS_KEY);
            sessionStorage.removeItem(UPDATE_IN_PROGRESS_KEY);
            
            // Show success message
            const event = new CustomEvent('show-toast', {
              detail: { 
                message: `Updated to version ${currentVersion}`, 
                type: 'success' 
              }
            });
            globalThis.dispatchEvent(event);
          }
        };
        
        // Check after a short delay to let service worker stabilize
        setTimeout(checkRecentUpdate, 2000);
      }
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
      
      setUpdateReady(true);
      
      if (autoUpdateEnabled) {
        // Auto-reload if setting is enabled and safety checks pass
        console.debug('🔄 Auto-update enabled - checking if reload is safe');
        await performReload();
      } else {
        // Show notification if auto-update is disabled
        const versionChanged = await hasVersionChanged();
        if (versionChanged) {
          const currentVersion = await getServiceWorkerVersion();
          setNewVersion(currentVersion);
          setShowNotification(true);
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
            const currentVersion = await getServiceWorkerVersion();
            setNewVersion(currentVersion);
            setShowNotification(true);
          }
        }
      };
      
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      
      return () => {
        globalThis.removeEventListener('sw-update-ready', handleUpdateReady);
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };
    }

    return () => {
      globalThis.removeEventListener('sw-update-ready', handleUpdateReady);
    };
  }, []);

  const handleUpdate = async () => {
    if (!canReload()) {
      alert('Please wait a moment before trying again. If the issue persists, try using the "Force Update" option in Settings.');
      return;
    }
    
    await performReload();
  };

  const handleDismiss = () => {
    setShowNotification(false);
    // Still keep the flag so user can update later via Settings
  };

  if (!showNotification || !updateReady) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        left: '20px',
        maxWidth: '400px',
        margin: '0 auto',
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--primary)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-md)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        zIndex: 10000,
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-sm)' }}>
        <RefreshIcon size={24} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 var(--spacing-xs) 0', fontSize: '1rem', fontWeight: 600 }}>
            Update Available{newVersion ? ` (v${newVersion})` : ''}
          </h3>
          <p style={{ margin: '0 0 var(--spacing-md) 0', fontSize: '0.9rem', color: 'var(--text-light)' }}>
            A new version of the app is ready. Update now to get the latest features and improvements.
          </p>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <button
              onClick={handleUpdate}
              style={{
                flex: 1,
                padding: 'var(--spacing-sm) var(--spacing-md)',
                backgroundColor: 'var(--primary)',
                color: 'var(--text)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              Update Now
            </button>
            <button
              onClick={handleDismiss}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                backgroundColor: 'transparent',
                color: 'var(--text-light)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Later
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: 'var(--text-light)',
            flexShrink: 0,
          }}
          aria-label="Dismiss"
        >
          <XIcon size={20} />
        </button>
      </div>
    </div>
  );
};

export default UpdateNotification;
