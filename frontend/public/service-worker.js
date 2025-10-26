// Service Worker for KeepWiz PWA - Automatic Updates + Offline Sync
const CACHE_NAME = "keep-wiz-v1.2.8.3" // Increment version for updates
const API_CACHE_NAME = "keep-wiz-api-v1"
const urlsToCache = [
  "/", 
  "/index.html", 
  "/manifest.json",
  "/manifest.webmanifest", 
  "/icons/logo-192.png?v=2",
  "/icons/logo-512.png?v=2",
  "/logo.png"
]

// API endpoints that should be cached for offline access
const API_CACHE_PATTERNS = [
  /\/api\/games\/\w+$/,  // GET game details
  /\/api\/users\/me$/     // User profile
];

// API endpoints for write operations (POST, PUT, DELETE)
const WRITE_API_PATTERNS = [
  /\/api\/games\/\w+\/events$/,
  /\/api\/games\/\w+\/snapshots$/,
  /\/api\/games\/\w+$/
];

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
    })
  );
  // Immediately activate the new service worker
  self.skipWaiting();
});

// Activate event - clean up old caches and take control immediately
self.addEventListener("activate", (event) => {
  console.debug('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
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

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.debug('Received SKIP_WAITING message');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.debug('Clearing cache');
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
      })
    );
  }
});

// Check if URL matches API cache patterns
function shouldCacheAPI(url) {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(url));
}

// Check if URL is a write operation
function isWriteOperation(url, method) {
  return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) &&
         WRITE_API_PATTERNS.some(pattern => pattern.test(url));
}

// Fetch event - network first for API, cache first for assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle write operations when offline
  if (isWriteOperation(url.pathname, request.method)) {
    event.respondWith(handleWriteOperation(request));
    return;
  }
  
  // Handle API requests with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }
  
  // Handle static assets with cache-first strategy
  event.respondWith(cacheFirstStrategy(request));
});

// Cache-first strategy for static assets
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    
    if (response && response.status === 200 && response.type === "basic") {
      const responseToCache = response.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, responseToCache);
    }
    
    return response;
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
}

// Network-first strategy for API requests
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful GET requests
    if (response && response.status === 200 && request.method === 'GET') {
      const url = new URL(request.url);
      if (shouldCacheAPI(url.pathname)) {
        const responseToCache = response.clone();
        const cache = await caches.open(API_CACHE_NAME);
        await cache.put(request, responseToCache);
      }
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.debug('Serving from cache (offline):', request.url);
      return cachedResponse;
    }
    
    // No cache available
    throw error;
  }
}

// Handle write operations when offline
async function handleWriteOperation(request) {
  try {
    // Try network first
    const response = await fetch(request);
    return response;
  } catch (error) {
    // Network failed - queue for background sync
    console.debug('Write operation failed, will retry when online:', request.url);
    
    // Return synthetic 202 Accepted response
    return new Response(JSON.stringify({
      status: 'pending',
      message: 'Request queued for sync when online',
      offline: true
    }), {
      status: 202,
      statusText: 'Accepted',
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Background Sync event - sync pending changes when back online
self.addEventListener('sync', (event) => {
  console.debug('Background sync event:', event.tag);
  
  if (event.tag.startsWith('sync-game-')) {
    const gameId = event.tag.replace('sync-game-', '');
    event.waitUntil(syncGame(gameId));
  }
  
  if (event.tag === 'sync-all-games') {
    event.waitUntil(syncAllGames());
  }
});

// Sync a specific game
async function syncGame(gameId) {
  try {
    console.debug('Syncing game:', gameId);
    
    // Notify all clients that sync is starting
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_START',
        gameId
      });
    });
    
    // The actual sync logic is handled by SyncManager in the client
    // This event just triggers the sync process
    
    return true;
  } catch (error) {
    console.error('Sync failed for game:', gameId, error);
    throw error;
  }
}

// Sync all games with pending changes
async function syncAllGames() {
  try {
    console.debug('Syncing all games');
    
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_ALL'
      });
    });
    
    return true;
  } catch (error) {
    console.error('Sync all failed:', error);
    throw error;
  }
}

// Periodic Background Sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-games') {
    event.waitUntil(syncAllGames());
  }
});

// Push notification event (for future use)
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }
  
  const data = event.data.json();
  
  if (data.type === 'game-updated') {
    // Notify clients of game update
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'GAME_UPDATED',
            gameId: data.gameId
          });
        });
      })
    );
  }
});

