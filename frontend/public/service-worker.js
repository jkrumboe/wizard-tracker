// Service Worker for KeepWiz PWA - Automatic Updates
const CACHE_NAME = "keep-wiz-v1.1.10" // Increment version for updates
const urlsToCache = [
  "/", 
  "/index.html", 
  "/manifest.json", 
  "/icons/pwa-logo.png",
  "/vite.svg"
]

// Install event - cache assets and skip waiting for immediate activation
self.addEventListener("install", (event) => {
 console.debug('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
     console.debug("Opened cache")
      // Cache files individually to handle failures gracefully
      return Promise.allSettled(
        urlsToCache.map(url => 
          cache.add(url).catch(err => {
            console.warn(`Failed to cache ${url}:`, err);
            return null;
          })
        )
      );
    }),
  )
  // Immediately activate the new service worker
  self.skipWaiting();
})

// Activate event - clean up old caches and take control immediately
self.addEventListener("activate", (event) => {
 console.debug('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
           console.debug('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients immediately
     console.debug('Service Worker taking control of all clients');
      return self.clients.claim();
    })
  );
});

// Handle messages from clients (for manual skip waiting if needed)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
   console.debug('Received SKIP_WAITING message');
    self.skipWaiting();
  }
});

// Fetch event - serve from cache if available
self.addEventListener("fetch", (event) => {
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
  const cacheWhitelist = [CACHE_NAME]
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName)
          }
        }),
      )
    }),
  )
})

