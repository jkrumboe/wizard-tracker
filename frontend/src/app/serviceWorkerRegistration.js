// Enhanced service worker registration with custom update UI
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

        // Check for updates every 60 seconds when the page is visible (less frequent to avoid constant prompts)
        setInterval(() => {
          if (document.visibilityState === 'visible') {
            registration.update();
          }
        }, 60000);

        // Listen for updates - the UpdateNotification component will handle the UI
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.debug('New version available - UpdateNotification component will handle the prompt.');
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
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isReloading) {
      return;
    }

    isReloading = true;
    console.debug('New service worker activated - reloading...');
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
