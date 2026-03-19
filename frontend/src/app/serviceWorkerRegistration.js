// Enhanced service worker registration with custom update UI
import { createLogger } from '@/shared/utils/logger';

let updateCheckInProgress = false;
let lastUpdateCheck = 0;
const UPDATE_CHECK_INTERVAL = 300000; // 5 minutes
const MIN_UPDATE_CHECK_DELAY = 10000; // 10 seconds minimum between checks
const LAST_SW_VERSION_KEY = 'last_sw_version';
const VERSION_MISMATCH_KEY = 'sw_version_mismatch_detected';
const logger = createLogger('serviceWorkerRegistration');

// Get app version from build-time constant
const getAppVersion = () => {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null;
};

// Dispatch update progress events to the app
const dispatchUpdateProgress = (data) => {
  globalThis.dispatchEvent(new CustomEvent('sw-update-progress', { detail: data }));
};

// Force unregister all service workers and clear caches
const forceCleanInstall = async (reason) => {
  logger.warn('Forcing clean install', { reason });
  
  try {
    // Unregister all service workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(reg => reg.unregister()));
    logger.info('Unregistered service workers', { count: registrations.length });
    
    // Clear all caches
    if ('caches' in globalThis) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      logger.info('Cleared caches', { count: cacheNames.length });
    }
    
    // Mark that we're doing a clean install
    sessionStorage.setItem('sw_clean_install', 'true');
    
    // Hard reload to get fresh service worker
    globalThis.location.reload();
  } catch (error) {
    logger.error('Force clean install failed', { error });
  }
};

// Verify SW version matches app version
const verifyVersionMatch = async (registration) => {
  const appVersion = getAppVersion();
  if (!appVersion) {
    logger.debug('App version not available, skipping verification');
    return true;
  }
  
  const worker = registration.active || registration.waiting || registration.installing;
  if (!worker) {
    logger.debug('No service worker available for version check');
    return true;
  }
  
  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();
    const timeout = setTimeout(() => {
      logger.warn('SW version check timed out');
      resolve(true); // Don't block on timeout
    }, 3000);
    
    messageChannel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      const swVersion = event.data?.version;
      
      if (!swVersion) {
        logger.warn('Service worker did not report version');
        resolve(true);
        return;
      }
      
      logger.debug('Version check', { appVersion, swVersion });
      
      if (swVersion !== appVersion) {
        logger.warn('Version mismatch detected', { appVersion, swVersion });
        
        // Check if we already tried to fix this recently
        const lastMismatch = sessionStorage.getItem(VERSION_MISMATCH_KEY);
        const now = Date.now();
        
        if (lastMismatch && (now - Number.parseInt(lastMismatch, 10)) < 30000) {
          // Already tried within 30 seconds, don't loop
          logger.warn('Version mismatch persists after recent fix attempt');
          // Show a toast to user
          globalThis.dispatchEvent(new CustomEvent('show-toast', {
            detail: {
              message: 'Update issue detected. Try "Force Update" in Settings.',
              type: 'warning',
              duration: 10000
            }
          }));
          resolve(false);
          return;
        }
        
        sessionStorage.setItem(VERSION_MISMATCH_KEY, now.toString());
        
        // Force update to fix mismatch
        forceCleanInstall(`Version mismatch: App=${appVersion}, SW=${swVersion}`);
        resolve(false);
        return;
      }
      
      // Versions match - clear any mismatch flag
      sessionStorage.removeItem(VERSION_MISMATCH_KEY);
      logger.info('Version verified: service worker matches app');
      resolve(true);
    };
    
    worker.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2]);
  });
};

export function register() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
  if (isDev) {
    logger.debug('Skipping service worker registration in development');
    // Unregister any old service workers from previous production/Docker builds
    // to prevent them from intercepting API requests and bypassing the Vite dev proxy
    navigator.serviceWorker.getRegistrations().then(registrations => {
      if (registrations.length > 0) {
        logger.warn('Unregistering stale service workers from previous build', { count: registrations.length });
        registrations.forEach(reg => reg.unregister());
      }
    });
    return;
  }
  
  // Check if this is a clean install recovery
  if (sessionStorage.getItem('sw_clean_install') === 'true') {
    sessionStorage.removeItem('sw_clean_install');
    logger.info('Clean install completed');
    globalThis.dispatchEvent(new CustomEvent('show-toast', {
      detail: {
        message: 'App updated successfully!',
        type: 'success'
      }
    }));
  }

  globalThis.addEventListener("load", () => {
    // VitePWA with injectManifest registers service-worker.js automatically
    // We just need to listen for the registration and handle updates
    navigator.serviceWorker.ready
      .then(async (registration) => {
        logger.info('Service worker ready', { scope: registration.scope });
        
        // Verify version match on load - auto-fix if mismatched
        const versionOk = await verifyVersionMatch(registration);
        if (!versionOk) {
          return; // Will reload if mismatch detected
        }
        
        // Initialize version tracking on first load
        if (registration.active) {
          const messageChannel = new MessageChannel();
          messageChannel.port1.onmessage = (event) => {
            if (event.data?.version) {
              const lastVersion = localStorage.getItem(LAST_SW_VERSION_KEY);
              if (!lastVersion) {
                logger.debug('Initializing version tracking', { version: event.data.version });
                localStorage.setItem(LAST_SW_VERSION_KEY, event.data.version);
              }
            }
          };
          registration.active.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2]);
        }
        
        // Listen for messages from the service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'SW_UPDATE_PROGRESS') {
            dispatchUpdateProgress(event.data);
          }
          if (event.data?.type === 'SW_INSTALLING') {
            logger.info('New service worker installing', { version: event.data.version });
            dispatchUpdateProgress({ status: 'downloading', version: event.data.version });
          }
        });

        // Throttled update checker
        const checkForUpdate = () => {
          const now = Date.now();
          const timeSinceLastCheck = now - lastUpdateCheck;
          
          // Skip if checked recently or if update is in progress
          if (timeSinceLastCheck < MIN_UPDATE_CHECK_DELAY || updateCheckInProgress) {
            logger.debug('Skipping update check (throttled or in progress)');
            return;
          }
          
          // Skip if page is not visible
          if (document.visibilityState !== 'visible') {
            return;
          }
          
          // Skip if an update is already being processed
          const updateState = localStorage.getItem('pwa_update_state');
          if (updateState === 'updating' || updateState === 'completed') {
            logger.debug('Skipping update check (update already in progress or completed)');
            return;
          }
          
          updateCheckInProgress = true;
          lastUpdateCheck = now;
          
          logger.debug('Checking for service worker updates');
          
          registration.update()
            .then(() => {
              logger.debug('Update check completed');
            })
            .catch((error) => {
              logger.error('Update check failed', { error });
            })
            .finally(() => {
              // Reset after a delay to prevent rapid successive checks
              setTimeout(() => {
                updateCheckInProgress = false;
              }, MIN_UPDATE_CHECK_DELAY);
            });
        };

        // Check for updates periodically (5 minutes)
        setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
        
        // Also check when page becomes visible (e.g., user switches back to tab)
        // but with throttling
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            // Delay slightly to avoid rapid checks
            setTimeout(checkForUpdate, 2000);
          }
        });

        // Listen for updates - the UpdateNotification component will handle the UI
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            logger.info('New service worker detected, installing');
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                logger.info('New version available for activation');
              }
            });
          }
        });
      })
      .catch((error) => {
        logger.error('ServiceWorker ready failed', { error });
      })
  })

  // Listen for controller change - dispatch event for UpdateNotification to handle
  let controllerChangeHandled = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controllerChangeHandled) {
      logger.debug('Controller change already handled, skipping');
      return;
    }

    controllerChangeHandled = true;
    logger.info('New service worker activated and ready to reload');
    
    // Dispatch custom event instead of automatic reload
    globalThis.dispatchEvent(new CustomEvent('sw-update-ready'));
    
    // Store flag that update is ready
    sessionStorage.setItem('sw_update_ready', 'true');
  });
}

export function unregister() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister()
      })
      .catch((error) => {
        logger.error('Service worker unregister failed', { error: error.message });
      })
  }
}
