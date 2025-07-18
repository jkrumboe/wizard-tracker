// Enhanced service worker registration with automatic updates
export function register() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      const swUrl = `${window.location.origin}/service-worker.js`

      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          console.log("ServiceWorker registration successful with scope: ", registration.scope)
          
          // Check for updates every 30 seconds when the page is visible
          setInterval(() => {
            if (document.visibilityState === 'visible') {
              registration.update();
            }
          }, 30000);

          // Listen for updates and automatically trigger update
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New version available - updating automatically...');
                  
                  // Clear all caches immediately
                  clearAllCachesAndUpdate(registration);
                }
              });
            }
          });

          // Check if there's already a waiting service worker
          if (registration.waiting) {
            console.log('Update available on page load - updating automatically...');
            clearAllCachesAndUpdate(registration);
          }
        })
        .catch((error) => {
          console.error("ServiceWorker registration failed: ", error)
        })
    })

    // Listen for controller change and reload immediately
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('New service worker activated - reloading...');
      window.location.reload();
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
      console.log('All caches cleared');
    }

    // Clear CSS cache by invalidating stylesheets
    const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
    cssLinks.forEach(link => {
      const href = link.href;
      const separator = href.includes('?') ? '&' : '?';
      link.href = `${href}${separator}v=${Date.now()}`;
    });

    // Tell the waiting service worker to skip waiting
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    
    // The controllerchange event will trigger a reload
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
  
  