// Enhanced service worker registration with automatic updates
let updatePromptActive = false;
let isReloading = false;

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

        // Check for updates every 30 seconds when the page is visible
        setInterval(() => {
          if (document.visibilityState === 'visible') {
            registration.update();
          }
        }, 30000);

        // Listen for updates and prompt the user before activating
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.debug('New version available - awaiting user confirmation to update.');
                promptForUpdate(registration);
              }
            });
          }
        });

        // Check if there's already a waiting service worker
        if (registration.waiting) {
          console.debug('Update available on page load - awaiting user confirmation to update.');
          promptForUpdate(registration);
        }
      })
      .catch((error) => {
        console.error("ServiceWorker registration failed: ", error)
      })
  })

  // Listen for controller change and reload once the update has been applied
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isReloading) {
      return;
    }

    isReloading = true;
    console.debug('New service worker activated - reloading...');
    window.location.reload();
  });
}

function promptForUpdate(registration) {
  if (updatePromptActive) {
    return;
  }

  const waitingWorker = registration.waiting;
  if (!waitingWorker) {
    return;
  }

  updatePromptActive = true;

  const shouldUpdate = window.confirm('A new version of Wizard Tracker is available. Reload now to update?');

  if (shouldUpdate) {
    applyUpdate(waitingWorker);
  } else {
    updatePromptActive = false;
  }
}

// Helper function to clear caches and trigger update
async function applyUpdate(waitingWorker) {
  try {
    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
      console.debug('All caches cleared');
    }

    // Clear CSS cache by invalidating stylesheets
    const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
    cssLinks.forEach(link => {
      const href = link.href;
      const separator = href.includes('?') ? '&' : '?';
      link.href = `${href}${separator}v=${Date.now()}`;
    });

    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  } catch (error) {
    console.error('Auto-update failed:', error);
    updatePromptActive = false;
  }
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
