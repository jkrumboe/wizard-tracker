// Enhanced service worker registration with automatic updates
export function register() {
  if ("serviceWorker" in navigator) {
    // Track if we're already in the process of updating to prevent loops
    let isUpdating = false;
    
    window.addEventListener("load", () => {
      const swUrl = `${window.location.origin}/service-worker.js`

      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          console.debug("ServiceWorker registration successful with scope: ", registration.scope)
          
          // Check for updates every 60 seconds when the page is visible (increased from 30s)
          setInterval(() => {
            if (document.visibilityState === 'visible' && !isUpdating) {
              registration.update();
            }
          }, 60000);

          // Listen for updates and automatically trigger update
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker && !isUpdating) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.debug('New version available - updating automatically...');
                  isUpdating = true;
                  
                  // Clear all caches immediately
                  clearAllCachesAndUpdate(registration);
                }
              });
            }
          });

          // Check if there's already a waiting service worker
          if (registration.waiting && !isUpdating) {
            console.debug('Update available on page load - updating automatically...');
            isUpdating = true;
            clearAllCachesAndUpdate(registration);
          }
        })
        .catch((error) => {
          console.error("ServiceWorker registration failed: ", error)
        })
    })

    // Listen for controller change and reload immediately (only once)
    let controllerChangeHandled = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!controllerChangeHandled) {
        controllerChangeHandled = true;
        console.debug('New service worker activated - reloading...');
        window.location.reload();
      }
    });
  }
}

// Helper function to clear caches and trigger update
async function clearAllCachesAndUpdate(registration) {
  try {
    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
      console.debug('All caches cleared');
    }

    // Tell the waiting service worker to skip waiting
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    
    // The controllerchange event will trigger a reload
    // Note: We removed CSS cache busting here as it can cause unnecessary reloads
  } catch (error) {
    console.error('Auto-update failed:', error);
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
  
  