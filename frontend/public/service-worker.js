// Service Worker for KeepWiz PWA - Automatic Updates + Offline Sync
// Uses Workbox for precaching with error recovery
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

// Version is injected during build process
const APP_VERSION = "__APP_VERSION__" // Will be replaced during build
const API_CACHE_NAME = `keep-wiz-api-v${APP_VERSION}`

// Precache and route assets with error recovery
try {
  // This will be replaced by Vite PWA plugin with the actual manifest
  precacheAndRoute(self.__WB_MANIFEST || []);
  cleanupOutdatedCaches();
  console.debug(`Service Worker v${APP_VERSION} precaching complete`);
} catch (error) {
  console.error('Precaching failed:', error);
  // Clear potentially corrupted caches
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        console.warn('Clearing all caches due to precache error');
        return Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
      })
    );
  });
}

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

// Workbox Runtime Caching Strategies

// Cache Google Fonts with CacheFirst strategy
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 }), // 1 year
    ],
  })
);

// Cache images with CacheFirst strategy
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }), // 30 days
    ],
  })
);

// Install event - Workbox handles precaching, we just skip waiting
self.addEventListener("install", (event) => {
  console.debug(`Service Worker installing version ${APP_VERSION}...`);
  // Skip waiting immediately to activate the new service worker
  self.skipWaiting();
});

// Activate event - clean up old caches and take control immediately
self.addEventListener("activate", (event) => {
  console.debug(`Service Worker activating version ${APP_VERSION}...`);
  event.waitUntil(
    Promise.all([
      // Workbox cleanupOutdatedCaches handles most cleanup, but we also clean our custom API cache
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Keep current API cache and Workbox caches
              return cacheName.startsWith('keep-wiz-api-') && cacheName !== API_CACHE_NAME;
            })
            .map((cacheName) => {
              console.debug('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      }),
    ]).then(() => {
      // Take control of all clients immediately
      console.debug(`Service Worker v${APP_VERSION} taking control of all clients`);
      return self.clients.claim();
    })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.debug(`Received SKIP_WAITING message for version ${APP_VERSION}`);
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    console.debug(`Sending version ${APP_VERSION}`);
    event.ports[0].postMessage({ version: APP_VERSION });
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

// Fetch event - Custom handling for API requests (Workbox handles precached assets)
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip cross-origin requests (like Google Analytics, external APIs, etc.)
  if (url.origin !== location.origin) {
    return;
  }
  
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
  
  // Let Workbox handle precached assets (static files)
  // No need to explicitly handle them here
});

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

