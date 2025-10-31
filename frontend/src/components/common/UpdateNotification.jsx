import React, { useState, useEffect, useRef } from 'react';
import '@/styles/components/update-notification.css';

/**
 * UpdateNotification Component
 * 
 * Shows a loading screen during PWA updates to prevent multiple reload prompts.
 * Automatically applies updates without user interaction for a smoother experience.
 */
const UpdateNotification = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const updateInProgressRef = useRef(false);
  const hasShownUpdateRef = useRef(false);

  useEffect(() => {
    // Only run in production
    if (import.meta.env.DEV) {
      return;
    }

    // Prevent multiple updates from being processed
    if (updateInProgressRef.current || hasShownUpdateRef.current) {
      return;
    }

    const handleUpdateFound = async (registration) => {
      // Prevent duplicate update handling
      if (updateInProgressRef.current || hasShownUpdateRef.current) {
        return;
      }

      const worker = registration.waiting || registration.installing;
      if (!worker) {
        return;
      }

      // Mark that we're handling an update
      updateInProgressRef.current = true;
      hasShownUpdateRef.current = true;

      const applyUpdate = async () => {
        // Show loading screen
        setIsUpdating(true);

        // Set global flag to signal update is in progress
        window.__PWA_UPDATE_IN_PROGRESS = true;

        try {
          // Wait a moment to ensure the service worker is ready
          await new Promise(resolve => setTimeout(resolve, 500));

          // Clear all caches for a clean update
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
            console.debug('Caches cleared for update');
          }

          // Tell the waiting service worker to skip waiting
          worker.postMessage({ type: 'SKIP_WAITING' });
          
          // Wait for the new service worker to take control
          // The controllerchange event will trigger the reload
        } catch (error) {
          console.error('Update failed:', error);
          // Clear the flag on error
          window.__PWA_UPDATE_IN_PROGRESS = false;
          // Force reload as fallback after a delay
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      };
      
      // If worker is already installed, apply update immediately
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        await applyUpdate();
      } else {
        // Otherwise wait for state change
        worker.addEventListener('statechange', async () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            await applyUpdate();
          }
        });
      }
    };

    // Check for existing service worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          // Check if there's already a waiting worker
          if (registration.waiting && !hasShownUpdateRef.current) {
            handleUpdateFound(registration);
          }

          // Listen for new updates
          registration.addEventListener('updatefound', () => {
            if (!hasShownUpdateRef.current) {
              handleUpdateFound(registration);
            }
          });
        }
      });

      // Listen for controller change (when new service worker takes over)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Only reload if we initiated the update
        if (updateInProgressRef.current) {
          console.debug('Service worker updated, reloading page...');
          // Small delay to show the loading screen
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }
      });
    }

    return () => {
      // Cleanup if component unmounts
    };
  }, []);

  if (!isUpdating) {
    return null;
  }

  return (
    <div className="update-loading-overlay">
      <div className="update-loading-content">
        <div className="update-loading-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        <h2 className="update-loading-title">Update wird installiert...</h2>
        <p className="update-loading-message">
          Bitte warten Sie einen Moment
        </p>
      </div>
    </div>
  );
};

export default UpdateNotification;
