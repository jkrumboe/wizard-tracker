import { useEffect } from 'react';

/**
 * Custom hook to handle cache invalidation for CSS and other assets
 * This ensures that when the app updates, users get fresh styles
 */
export const useCacheInvalidation = () => {
  useEffect(() => {
    const handleCacheInvalidation = async () => {
      // Force reload CSS files by adding cache-busting parameters
      const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
      
      cssLinks.forEach(link => {
        const href = link.href;
        const separator = href.includes('?') ? '&' : '?';
        link.href = `${href}${separator}v=${Date.now()}`;
      });
    };

    // Listen for cache invalidation events
    globalThis.addEventListener('cacheInvalidation', handleCacheInvalidation);
    
    return () => {
      globalThis.removeEventListener('cacheInvalidation', handleCacheInvalidation);
    };
  }, []);
};

/**
 * Utility function to trigger cache invalidation
 */
export const invalidateCache = () => {
  globalThis.dispatchEvent(new CustomEvent('cacheInvalidation'));
};

/**
 * Utility function to clear all caches
 */
export const clearAllCaches = async () => {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      const deletionPromises = cacheNames.map(cacheName => caches.delete(cacheName));
      await Promise.all(deletionPromises);
      console.debug('All caches cleared successfully');
      return true;
    } catch (error) {
      console.error('Failed to clear caches:', error);
      return false;
    }
  }
  return false;
};

/**
 * Utility function to refresh specific cache
 */
export const refreshCache = async (cacheName) => {
  if ('caches' in window) {
    try {
      await caches.delete(cacheName);
      console.debug(`Cache ${cacheName} cleared successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to clear cache ${cacheName}:`, error);
      return false;
    }
  }
  return false;
};
