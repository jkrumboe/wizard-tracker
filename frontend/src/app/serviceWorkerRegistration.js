// Enhanced service worker registration with custom update UI
let isReloading = false;
let updateCheckInProgress = false;
let lastUpdateCheck = 0;
const UPDATE_CHECK_INTERVAL = 300000; // 5 minutes
const MIN_UPDATE_CHECK_DELAY = 10000; // 10 seconds minimum between checks

export function register() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
  if (isDev) {
    console.debug('Skipping service worker registration in development');
    return;
  }

  window.addEventListener("load", () => {
    // VitePWA with injectManifest registers service-worker.js automatically
    // We just need to listen for the registration and handle updates
    navigator.serviceWorker.ready
      .then((registration) => {
        console.debug("ServiceWorker ready with scope: ", registration.scope)

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

  // Listen for controller change and reload once the update has been applied
  let controllerChangeHandled = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isReloading || controllerChangeHandled) {
      console.debug('Controller change already handled, skipping');
      return;
    }

    controllerChangeHandled = true;
    isReloading = true;
    console.debug('New service worker activated - reloading...');
    
    // Immediate reload to show new version
    window.location.reload();
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
