// Service Worker for KeepWiz PWA
const CACHE_NAME = "keep-wiz-v1.18.4"
const SW_VERSION = "1.11.0" // Separate version for easier tracking
const urlsToCache = ["/", "/index.html", "/manifest.json", "/icons/logo-192.png", "/icons/logo-512.png"]

const logPrefix = '[KeepWiz][serviceWorker:legacy]';
const swLogger = {
  debug(message, meta) {
    if (meta !== undefined) {
      console.debug(`${logPrefix} ${message}`, meta);
      return;
    }
    console.debug(`${logPrefix} ${message}`);
  },
  info(message, meta) {
    if (meta !== undefined) {
      console.info(`${logPrefix} ${message}`, meta);
      return;
    }
    console.info(`${logPrefix} ${message}`);
  },
};

// Install event - cache assets
self.addEventListener("install", (event) => {
  swLogger.debug('Installing service worker', { version: SW_VERSION });
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      swLogger.debug('Opened cache', { cacheName: CACHE_NAME })
      return cache.addAll(urlsToCache)
    }),
  )
})

// Fetch event - serve from cache if available
self.addEventListener("fetch", (event) => {
  // Skip cross-origin requests (like Google Analytics, external APIs, etc.)
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Cache hit - return response
      if (response) {
        return response
      }
      return fetch(event.request).then((response) => {
        // Check if we received a valid response
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response
        }

        // Clone the response
        const responseToCache = response.clone()

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache)
        })

        return response
      })
    }),
  )
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  swLogger.info('Activating service worker', { version: SW_VERSION });
  // Take control of all clients immediately
  event.waitUntil(
    clients.claim().then(() => {
      swLogger.info('Claimed all clients', { version: SW_VERSION });
      const cacheWhitelist = [CACHE_NAME];
      return caches.keys().then((cacheNames) => {
        const deletePromises = cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            swLogger.debug('Deleting old cache', { cacheName });
            return caches.delete(cacheName)
          }
        });
        return Promise.all(deletePromises);
      }).then(() => {
        // Notify all clients that a new version is active
        return self.clients.matchAll().then(clients => {
          swLogger.debug('Notifying clients of activation', { clientCount: clients.length, version: SW_VERSION });
          clients.forEach(client => {
            client.postMessage({
              type: 'SW_ACTIVATED',
              version: SW_VERSION,
              cacheName: CACHE_NAME
            });
          });
        });
      });
    })
  );
})

// Message handler for version checks and skip waiting
self.addEventListener('message', (event) => {
  swLogger.debug('Received message', { data: event.data });
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    // Respond with current version
    event.ports[0].postMessage({ version: SW_VERSION });
  }
});


