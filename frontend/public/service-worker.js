// Service Worker for KeepWiz PWA - Automatic Updates + Offline Sync
// Uses Workbox for precaching with error recovery
// Chrome 121+ Compliant: Event listeners registered at top level during initial evaluation
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { cacheNames } from 'workbox-core';
import { Queue } from 'workbox-background-sync';

// Version is injected during build process
const APP_VERSION = "__APP_VERSION__" // Will be replaced during build
const API_CACHE_NAME = `keep-wiz-api-v${APP_VERSION}`

const logPrefix = '[KeepWiz][serviceWorker:runtime]';
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
  warn(message, meta) {
    if (meta !== undefined) {
      console.warn(`${logPrefix} ${message}`, meta);
      return;
    }
    console.warn(`${logPrefix} ${message}`);
  },
  error(message, meta) {
    if (meta !== undefined) {
      console.error(`${logPrefix} ${message}`, meta);
      return;
    }
    console.error(`${logPrefix} ${message}`);
  },
};

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

// CRITICAL: Install and Activate event listeners MUST be registered during initial evaluation
// for Chrome 121+ compliance. These are registered BEFORE any async operations.

// Install event - Workbox handles precaching, we just skip waiting
self.addEventListener("install", (event) => {
  swLogger.info('Installing service worker', { version: APP_VERSION });
  self.skipWaiting(); // Force immediate activation
  
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

// Caches this service worker version owns. Anything else is from an older
// build and is safe to drop on activation.
const CURRENT_CACHES = [
  cacheNames.precache,
  cacheNames.runtime,
  'google-fonts-cache',
  'images-cache',
  API_CACHE_NAME,
];

// Activate event - clean up old caches and take control immediately
self.addEventListener("activate", (event) => {
  swLogger.info('Activating service worker', { version: APP_VERSION });
  event.waitUntil(
    // Only drop caches this version does not own. Deleting everything here
    // would wipe the precache that Workbox just populated during install,
    // and precaching never runs again outside install - that would leave the
    // app with no offline assets at all.
    caches.keys().then((existingCacheNames) => {
      const staleCaches = existingCacheNames.filter((name) => !CURRENT_CACHES.includes(name));
      swLogger.debug('Cleaning up stale caches during activation', {
        total: existingCacheNames.length,
        stale: staleCaches.length,
      });
      return Promise.all(staleCaches.map((cacheName) => {
        swLogger.debug('Deleting stale cache', { cacheName });
        return caches.delete(cacheName);
      }));
    }).then(() => {
      // Take control of all clients immediately
      swLogger.info('Taking control of all clients', { version: APP_VERSION });
      return self.clients.claim();
    })
  );
});

// Precache and route assets - Called synchronously at top level AFTER event listeners
// This will be replaced by Vite PWA plugin with the actual manifest
try {
  const manifest = self.__WB_MANIFEST || [];
  updateState.totalAssets = manifest.length;
  
  // Call precacheAndRoute synchronously - Workbox registers its own install handler internally
  // Enhanced error handling for bad-precaching-response errors
  precacheAndRoute(manifest, {
    ignoreURLParametersMatching: [/^v/, /^_/],
    directoryIndex: null,
  });
  
  // Cleanup can happen async
  cleanupOutdatedCaches();

  // SPA navigation fallback. Routes like /games or /game/current are not
  // themselves precached URLs, so an offline deep link or refresh would go to
  // the network and fail. Serve the precached shell instead and let the router
  // resolve the route client-side. API and asset requests are excluded so they
  // keep their own strategies.
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL('/index.html'), {
      denylist: [/^\/api\//, /\/[^/?]+\.[^/]+$/],
    })
  );

  swLogger.info('Initialized precache manifest', { version: APP_VERSION, assetCount: manifest.length });
} catch (error) {
  // Log but don't throw - allow SW to continue functioning
  swLogger.error('Precaching setup failed (possible stale manifest)', { error });
  swLogger.warn('Service worker will continue to function; hard refresh may be required');
}

// GET endpoints whose last successful response is kept, so the screens built on
// them show the most recent known data offline instead of an error. Reads only -
// the network is always tried first, and the cache is only a fallback.
const API_CACHE_PATTERNS = [
  /\/api\/games\/\w+$/,           // GET game details
  /\/api\/wizard-games\/\w+$/,    // GET wizard game details
  /\/api\/table-games\/\w+$/,     // GET table game details
  /\/api\/users\/me$/,            // Signed-in user
  /\/api\/users\/[^/]+\/profile$/, // Profile + stats behind the account screens
  /\/api\/identities\/elo\//      // ELO ratings shown next to each game type
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

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    swLogger.debug('Received SKIP_WAITING message', { version: APP_VERSION });
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    swLogger.debug('Sending service worker version', { version: APP_VERSION });
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
    swLogger.info('Received CLEAR_CACHE request');
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
    
    // Cache successful GET requests. Storing is best-effort: if it fails (quota,
    // an uncacheable request) the page must still get its fresh response, so the
    // write is isolated from the outer catch that falls back to the cache.
    if (response && response.status === 200 && request.method === 'GET') {
      const url = new URL(request.url);
      if (shouldCacheAPI(url.pathname)) {
        try {
          const responseToCache = response.clone();
          const cache = await caches.open(API_CACHE_NAME);
          await cache.put(request, responseToCache);
        } catch (cacheError) {
          swLogger.debug('Could not cache API response', { url: request.url, error: cacheError });
        }
      }
    }

    return response;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      swLogger.debug('Serving API response from cache (offline)', { url: request.url });
      return cachedResponse;
    }
    
    // No cache available
    throw error;
  }
}

// Durable queue for writes made while offline. Backed by IndexedDB, so it
// survives the service worker being torn down and the tab being closed;
// Workbox registers the matching 'sync' listener and replays on reconnect.
const writeQueue = new Queue('keep-wiz-writes', {
  maxRetentionTime: 7 * 24 * 60, // minutes
  onSync: async ({ queue }) => {
    let replayed = 0;
    let entry = await queue.shiftRequest();

    while (entry) {
      try {
        await fetch(entry.request.clone());
        replayed += 1;
      } catch (error) {
        // Put it back at the front and let the browser retry the whole sync
        // later. Re-throwing is what tells the browser this sync failed.
        await queue.unshiftRequest(entry);
        swLogger.warn('Replay failed; write stays queued', { url: entry.request.url, error });
        await notifyClients({ type: 'SYNC_QUEUE_PROGRESS', replayed, pending: true });
        throw error;
      }
      entry = await queue.shiftRequest();
    }

    swLogger.info('Replayed queued writes', { replayed });
    await notifyClients({ type: 'SYNC_QUEUE_DRAINED', replayed });
  },
});

// Post a message to every open client
async function notifyClients(message) {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => client.postMessage(message));
}

// Handle write operations when offline
async function handleWriteOperation(request) {
  // Clone before the fetch attempt - a failed fetch still consumes the body,
  // so the queued copy has to be taken up front.
  const queueableRequest = request.clone();

  try {
    // Try network first
    return await fetch(request);
  } catch (networkError) {
    try {
      await writeQueue.pushRequest({ request: queueableRequest });
    } catch (queueError) {
      // Queuing failed, so this write is genuinely lost. Report a real error
      // rather than a success the client would take as saved.
      swLogger.error('Failed to queue offline write', { url: request.url, error: queueError });
      return new Response(JSON.stringify({
        status: 'failed',
        message: 'Request could not be saved for retry',
        offline: true
      }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      });
    }

    swLogger.warn('Write queued for retry when online', { url: request.url, error: networkError });

    // Accepted, and now actually durable
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
  swLogger.debug('Background sync event', { tag: event.tag });
  
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
    swLogger.info('Syncing game', { gameId });

    // The event replay itself lives in SyncManager on the client, so this can
    // only make progress while a page is open. With no client to hand off to,
    // throw so the browser retries this sync later instead of recording a
    // success that never happened.
    const clients = await self.clients.matchAll();
    if (clients.length === 0) {
      swLogger.warn('No open clients to run game sync; deferring', { gameId });
      throw new Error(`No client available to sync game ${gameId}`);
    }

    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_START',
        gameId
      });
    });

    return true;
  } catch (error) {
    swLogger.error('Sync failed for game', { gameId, error });
    throw error;
  }
}

// Sync all games with pending changes
async function syncAllGames() {
  try {
    swLogger.info('Syncing all games');

    const clients = await self.clients.matchAll();
    if (clients.length === 0) {
      swLogger.warn('No open clients to run sync; deferring');
      throw new Error('No client available to sync games');
    }

    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_ALL'
      });
    });

    return true;
  } catch (error) {
    swLogger.error('Sync all failed', { error });
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

