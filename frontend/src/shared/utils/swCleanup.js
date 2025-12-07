// Service Worker Cleanup Utility
// Handles cleanup of old service workers and caches to prevent precache errors

/**
 * Unregister all service workers and clear all caches
 * Use this when there are persistent SW issues
 */
export async function unregisterAllServiceWorkers() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
      console.log('Unregistered service worker:', registration.scope);
    }
  } catch (error) {
    console.error('Error unregistering service workers:', error);
  }
}

/**
 * Clear all caches
 */
export async function clearAllCaches() {
  if (!('caches' in window)) {
    return;
  }

  try {
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      await caches.delete(cacheName);
      console.log('Deleted cache:', cacheName);
    }
  } catch (error) {
    console.error('Error clearing caches:', error);
  }
}

/**
 * Clean up old service workers and caches, then reload
 * This is useful when SW precache errors occur
 */
export async function forceServiceWorkerUpdate() {
  try {
    await unregisterAllServiceWorkers();
    await clearAllCaches();
    
    // Set flag to prevent infinite loop
    sessionStorage.setItem('sw_force_updated', 'true');
    
    // Reload the page
    globalThis.location.reload();
  } catch (error) {
    console.error('Error forcing service worker update:', error);
  }
}

/**
 * Check if SW force update was just performed
 */
export function wasServiceWorkerForceUpdated() {
  return sessionStorage.getItem('sw_force_updated') === 'true';
}

/**
 * Clear the force update flag
 */
export function clearServiceWorkerUpdateFlag() {
  sessionStorage.removeItem('sw_force_updated');
}
