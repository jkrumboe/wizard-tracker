import React, { useState, useEffect, useRef } from 'react';
import '@/styles/components/update-notification.css';

/**
 * UpdateNotification Component
 * 
 * Shows a loading screen during PWA updates to prevent multiple reload prompts.
 * Automatically applies updates without user interaction for a smoother experience.
 * 
 * Uses localStorage to track update state across page reloads to prevent infinite loops.
 */

// Storage keys for tracking update state
const UPDATE_STATE_KEY = 'pwa_update_state';
const LAST_VERSION_KEY = 'pwa_last_version';
const UPDATE_TIMESTAMP_KEY = 'pwa_update_timestamp';

const UpdateNotification = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const updateInProgressRef = useRef(false);
  const hasShownUpdateRef = useRef(false);
  const controllerChangeHandledRef = useRef(false);

  useEffect(() => {
    // Only run in production
    if (import.meta.env.DEV) {
      return;
    }

    // Check if we just completed an update (prevents infinite loop)
    const updateState = localStorage.getItem(UPDATE_STATE_KEY);
    const updateTimestamp = localStorage.getItem(UPDATE_TIMESTAMP_KEY);
    const now = Date.now();
    
    // If an update was applied less than 10 seconds ago, skip this check
    if (updateState === 'completed' && updateTimestamp) {
      const timeSinceUpdate = now - parseInt(updateTimestamp, 10);
      if (timeSinceUpdate < 10000) {
        console.debug('Update recently completed, skipping update check');
        // Clear the state after cooldown
        setTimeout(() => {
          localStorage.removeItem(UPDATE_STATE_KEY);
          localStorage.removeItem(UPDATE_TIMESTAMP_KEY);
        }, 10000 - timeSinceUpdate);
        return;
      }
    }

    // Prevent multiple updates from being processed
    if (updateInProgressRef.current || hasShownUpdateRef.current) {
      return;
    }

    const getCurrentSWVersion = async () => {
      if (!navigator.serviceWorker.controller) {
        return null;
      }
      
      try {
        const messageChannel = new MessageChannel();
        return new Promise((resolve) => {
          messageChannel.port1.onmessage = (event) => {
            resolve(event.data.version);
          };
          navigator.serviceWorker.controller.postMessage(
            { type: 'GET_VERSION' },
            [messageChannel.port2]
          );
          // Timeout after 1 second
          setTimeout(() => resolve(null), 1000);
        });
      } catch (error) {
        console.debug('Could not get SW version:', error);
        return null;
      }
    };

    const handleUpdateFound = async (registration) => {
      // Prevent duplicate update handling
      if (updateInProgressRef.current || hasShownUpdateRef.current) {
        return;
      }

      const worker = registration.waiting || registration.installing;
      if (!worker) {
        return;
      }

      // Get the version from the new service worker
      const getWorkerVersion = async (worker) => {
        try {
          const messageChannel = new MessageChannel();
          return new Promise((resolve) => {
            messageChannel.port1.onmessage = (event) => {
              resolve(event.data.version);
            };
            worker.postMessage(
              { type: 'GET_VERSION' },
              [messageChannel.port2]
            );
            // Timeout after 1 second
            setTimeout(() => resolve(null), 1000);
          });
        } catch (error) {
          console.debug('Could not get worker version:', error);
          return null;
        }
      };

      // Check if this is actually a new version
      const currentVersion = await getCurrentSWVersion();
      const newVersion = await getWorkerVersion(worker);
      
      console.debug(`Update check - Current: ${currentVersion}, New: ${newVersion}`);

      // Only proceed if we have a new version that's different from the current one
      if (!newVersion || (currentVersion && newVersion === currentVersion)) {
        console.debug('No new version detected, skipping update');
        return;
      }

      // Mark that we're handling an update
      updateInProgressRef.current = true;
      hasShownUpdateRef.current = true;

      const applyUpdate = async () => {
        // Set state to 'updating' in localStorage
        localStorage.setItem(UPDATE_STATE_KEY, 'updating');
        
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
          // Clear the flags on error
          window.__PWA_UPDATE_IN_PROGRESS = false;
          localStorage.removeItem(UPDATE_STATE_KEY);
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
      navigator.serviceWorker.getRegistration().then(async (registration) => {
        if (registration) {
          // Check if there's already a waiting worker
          if (registration.waiting && !hasShownUpdateRef.current) {
            // Verify it's actually a new version before showing update
            await handleUpdateFound(registration);
          }

          // Listen for new updates
          registration.addEventListener('updatefound', async () => {
            if (!hasShownUpdateRef.current) {
              // Wait a moment for the new worker to be ready
              await new Promise(resolve => setTimeout(resolve, 100));
              await handleUpdateFound(registration);
            }
          });
        }
      });

      // Listen for controller change (when new service worker takes over)
      navigator.serviceWorker.addEventListener('controllerchange', async () => {
        // Prevent multiple controllerchange events
        if (controllerChangeHandledRef.current) {
          console.debug('Controller change already handled, ignoring');
          return;
        }

        // Only reload if we initiated the update
        if (updateInProgressRef.current || localStorage.getItem(UPDATE_STATE_KEY) === 'updating') {
          controllerChangeHandledRef.current = true;
          
          console.debug('Service worker updated, reloading page...');
          
          // Mark update as completed before reload
          localStorage.setItem(UPDATE_STATE_KEY, 'completed');
          localStorage.setItem(UPDATE_TIMESTAMP_KEY, Date.now().toString());
          
          // Get and store the new version
          const newVersion = await getCurrentSWVersion();
          if (newVersion) {
            localStorage.setItem(LAST_VERSION_KEY, newVersion);
          }
          
          // Small delay to show the loading screen, then reload
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }
      });

      // Store the current version on first load
      getCurrentSWVersion().then(version => {
        if (version && !localStorage.getItem(LAST_VERSION_KEY)) {
          localStorage.setItem(LAST_VERSION_KEY, version);
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
