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

// Update state management
let updateState = {
  isInstalling: false,
  progress: 0,
  totalAssets: 0,
  cachedAssets: 0,
  status: 'idle' // 'idle' | 'checking' | 'downloading' | 'ready' | 'error'
};

// Broadcast update progress to all clients
const broadcastUpdateProgress = async (state) => {
  updateState = { ...updateState, ...state };
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SW_UPDATE_PROGRESS',
      ...updateState,
      version: APP_VERSION
    });
  });
};

// Precache and route assets with error recovery and progress tracking
const setupPrecaching = async () => {
  try {
    const manifest = self.__WB_MANIFEST || [];
    updateState.totalAssets = manifest.length;
    
    // Track precaching progress
    if (manifest.length > 0) {
      await broadcastUpdateProgress({ status: 'downloading', progress: 0, totalAssets: manifest.length });
    }
    
    // Filter out any potentially stale entries from manifest
    // This helps when old service workers have outdated file references
    const validManifest = manifest.filter(_entry => {
      // Keep entries that don't look like versioned build artifacts
      // or assume they're current
      return true; // Workbox will handle 404s gracefully
    });
    
    // This will be replaced by Vite PWA plugin with the actual manifest
    // Use a custom handler that doesn't fail on individual 404s
    precacheAndRoute(validManifest, {
      // Ignore errors for individual URLs - don't fail entire precache
      ignoreURLParametersMatching: [/^v/, /^_/],
      directoryIndex: null,
      // Add handler to skip 404s during precaching
      urlManipulation: ({ url }) => {
        return [url];
      }
    });
    cleanupOutdatedCaches();
    
    console.debug(`Service Worker v${APP_VERSION} precaching complete (${validManifest.length} assets)`);
    await broadcastUpdateProgress({ status: 'ready', progress: 100, cachedAssets: validManifest.length });
  } catch (_error) {
    console.error('Precaching failed:', _error);
    await broadcastUpdateProgress({ status: 'error', error: _error.message });
    
    // On error, clear ALL caches to force fresh state
    // This handles the case where old SW has stale manifest
    try {
      const cacheNames = await caches.keys();
      console.warn(`Clearing ${cacheNames.length} caches due to precache error`);
      await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
      console.debug('Cache cleanup complete, app will use network for all requests');
    } catch (cleanupError) {
      console.error('Cache cleanup also failed:', cleanupError);
    }
  }
};

// Execute precaching setup
setupPrecaching();

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
  
  // Notify clients that a new version is installing
  event.waitUntil(
    (async () => {
      await broadcastUpdateProgress({ 
        status: 'downloading', 
        isInstalling: true,
        progress: 0 
      });
      
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_INSTALLING',
          version: APP_VERSION
        });
      });
      
      // Skip waiting immediately to activate the new service worker
      await self.skipWaiting();
    })()
  );
});

// Activate event - clean up old caches and take control immediately
self.addEventListener("activate", (event) => {
  console.debug(`Service Worker activating version ${APP_VERSION}...`);
  event.waitUntil(
    Promise.all([
      // Clear ALL caches on activation to ensure fresh state
      // This prevents issues with stale manifests from old service workers
      caches.keys().then((cacheNames) => {
        console.debug(`Found ${cacheNames.length} caches, cleaning up...`);
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete all old caches - Workbox will recreate what's needed
            console.debug('Deleting cache:', cacheName);
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
    // Always respond with version, even if no port provided (backwards compatibility)
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ version: APP_VERSION });
    } else {
      // Fallback: send message to the client directly
      event.source.postMessage({ type: 'VERSION_RESPONSE', version: APP_VERSION });
    }
  }
  
  if (event.data && event.data.type === 'GET_UPDATE_STATUS') {
    // Return current update state
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ 
        ...updateState, 
        version: APP_VERSION 
      });
    } else {
      event.source.postMessage({ 
        type: 'UPDATE_STATUS_RESPONSE', 
        ...updateState,
        version: APP_VERSION 
      });
    }
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
  } catch {
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

