// Enhanced service worker registration with custom update UI
let isReloading = false;
let updateCheckInProgress = false;

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
    const swUrl = `${window.location.origin}/service-worker.js`

    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        console.debug("ServiceWorker registration successful with scope: ", registration.scope)

        // Check for updates only once every 5 minutes when page is visible
        // This prevents constant update checks that cause multiple prompts
        setInterval(() => {
          if (document.visibilityState === 'visible' && !updateCheckInProgress) {
            updateCheckInProgress = true;
            registration.update().finally(() => {
              // Reset after 10 seconds to prevent rapid successive checks
              setTimeout(() => {
                updateCheckInProgress = false;
              }, 10000);
            });
          }
        }, 300000); // 5 minutes

        // Listen for updates - the UpdateNotification component will handle the UI
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.debug('New version available - UpdateNotification component will handle the update.');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error("ServiceWorker registration failed: ", error)
      })
  })

  // Listen for controller change and reload once the update has been applied
  // Use a flag to ensure we only reload once
  let controllerChangeHandled = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isReloading || controllerChangeHandled) {
      return;
    }

    // Skip automatic reload if UpdateNotification component is handling the update
    if (window.__PWA_UPDATE_IN_PROGRESS) {
      console.debug('Update in progress via UpdateNotification - skipping automatic reload');
      return;
    }

    controllerChangeHandled = true;
    isReloading = true;
    console.debug('New service worker activated - reloading...');
    
    // Small delay to allow the loading screen to show
    setTimeout(() => {
      window.location.reload();
    }, 500);
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
