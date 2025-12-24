// Enhanced service worker registration with custom update UI
let isReloading = false;
let updateCheckInProgress = false;
let lastUpdateCheck = 0;
const UPDATE_CHECK_INTERVAL = 300000; // 5 minutes
const MIN_UPDATE_CHECK_DELAY = 10000; // 10 seconds minimum between checks
const LAST_SW_VERSION_KEY = 'last_sw_version';
const VERSION_MISMATCH_KEY = 'sw_version_mismatch_detected';

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
  console.warn(`🔄 Forcing clean install: ${reason}`);
  
  try {
    // Unregister all service workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(reg => reg.unregister()));
    console.debug(`Unregistered ${registrations.length} service workers`);
    
    // Clear all caches
    if ('caches' in globalThis) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.debug(`Cleared ${cacheNames.length} caches`);
    }
    
    // Mark that we're doing a clean install
    sessionStorage.setItem('sw_clean_install', 'true');
    
    // Hard reload to get fresh service worker
    globalThis.location.reload();
  } catch (error) {
    console.error('Force clean install failed:', error);
  }
};

// Verify SW version matches app version
const verifyVersionMatch = async (registration) => {
  const appVersion = getAppVersion();
  if (!appVersion) {
    console.debug('App version not available, skipping verification');
    return true;
  }
  
  const worker = registration.active || registration.waiting || registration.installing;
  if (!worker) {
    console.debug('No service worker available for version check');
    return true;
  }
  
  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();
    const timeout = setTimeout(() => {
      console.warn('SW version check timed out');
      resolve(true); // Don't block on timeout
    }, 3000);
    
    messageChannel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      const swVersion = event.data?.version;
      
      if (!swVersion) {
        console.warn('SW did not report version');
        resolve(true);
        return;
      }
      
      console.debug(`📋 Version check: App=${appVersion}, SW=${swVersion}`);
      
      if (swVersion !== appVersion) {
        console.warn(`⚠️ Version mismatch detected! App=${appVersion}, SW=${swVersion}`);
        
        // Check if we already tried to fix this recently
        const lastMismatch = sessionStorage.getItem(VERSION_MISMATCH_KEY);
        const now = Date.now();
        
        if (lastMismatch && (now - Number.parseInt(lastMismatch, 10)) < 30000) {
          // Already tried within 30 seconds, don't loop
          console.warn('Version mismatch persists after recent fix attempt, manual intervention needed');
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
      console.debug('✅ Version verified: SW matches App');
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
    console.debug('Skipping service worker registration in development');
    return;
  }
  
  // Check if this is a clean install recovery
  if (sessionStorage.getItem('sw_clean_install') === 'true') {
    sessionStorage.removeItem('sw_clean_install');
    console.debug('✅ Clean install completed');
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
        console.debug("ServiceWorker ready with scope: ", registration.scope)
        
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
                console.debug(`📌 Initializing version tracking: ${event.data.version}`);
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
            console.debug(`📦 New service worker v${event.data.version} is installing...`);
            dispatchUpdateProgress({ status: 'downloading', version: event.data.version });
          }
        });

        // Throttled update checker
        const checkForUpdate = () => {
          const now = Date.now();
          const timeSinceLastCheck = now - lastUpdateCheck;
          
          // Skip if checked recently or if update is in progress
          if (timeSinceLastCheck < MIN_UPDATE_CHECK_DELAY || updateCheckInProgress) {
            console.debug('Skipping update check - too soon or already in progress');
            return;
          }
          
          // Skip if page is not visible
          if (document.visibilityState !== 'visible') {
            return;
          }
          
          // Skip if an update is already being processed
          const updateState = localStorage.getItem('pwa_update_state');
          if (updateState === 'updating' || updateState === 'completed') {
            console.debug('Skipping update check - update already in progress or completed');
            return;
          }
          
          updateCheckInProgress = true;
          lastUpdateCheck = now;
          
          console.debug('Checking for service worker updates...');
          
          registration.update()
            .then(() => {
              console.debug('Update check completed');
            })
            .catch((error) => {
              console.error('Update check failed:', error);
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
            console.debug('New service worker detected, installing...');
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.debug('New version available - UpdateNotification component will handle the update.');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error("ServiceWorker ready failed: ", error)
      })
  })

  // Listen for controller change - dispatch event for UpdateNotification to handle
  let controllerChangeHandled = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controllerChangeHandled) {
      console.debug('Controller change already handled, skipping');
      return;
    }

    controllerChangeHandled = true;
    console.debug('New service worker activated - ready to reload');
    
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
        console.error(error.message)
      })
  }
}
