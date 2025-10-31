import React, { useState, useEffect } from 'react';
import '@/styles/components/update-notification.css';

/**
 * UpdateNotification Component
 * 
 * Displays a custom update prompt when a new version of the PWA is available.
 * This replaces the default browser update confirmation dialog.
 */
const UpdateNotification = () => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);

  useEffect(() => {
    // Only run in production
    if (import.meta.env.DEV) {
      return;
    }

    let updatePromptActive = false;

    const handleUpdateFound = (registration) => {
      if (updatePromptActive) {
        return;
      }

      const worker = registration.waiting || registration.installing;
      if (!worker) {
        return;
      }

      updatePromptActive = true;
      setWaitingWorker(worker);
      
      // If worker is already installed, show prompt immediately
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        setShowUpdate(true);
      } else {
        // Otherwise wait for state change
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            setShowUpdate(true);
          }
        });
      }
    };

    // Check for existing service worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          // Check if there's already a waiting worker
          if (registration.waiting) {
            handleUpdateFound(registration);
          }

          // Listen for new updates
          registration.addEventListener('updatefound', () => {
            handleUpdateFound(registration);
          });
        }
      });
    }

    return () => {
      updatePromptActive = false;
    };
  }, []);

  const handleUpdate = async () => {
    if (!waitingWorker) {
      return;
    }

    try {
      // Clear all caches for a clean update
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
        console.debug('Caches cleared for update');
      }

      // Tell the waiting service worker to skip waiting
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      
      // The page will reload automatically when the new service worker takes control
      setShowUpdate(false);
    } catch (error) {
      console.error('Update failed:', error);
      // Force reload as fallback
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
    // User can manually refresh later to get the update
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div className="update-notification-overlay">
      <div className="update-notification">
        <div className="update-notification-content">
          <h3 className="update-notification-title">Update verfügbar</h3>
          <p className="update-notification-message">
            Eine neue Version von Wizard Tracker ist verfügbar. Jetzt neu laden?
          </p>
        </div>
        <div className="update-notification-actions">
          <button
            onClick={handleDismiss}
            className="update-notification-button update-notification-button-secondary"
            aria-label="Abbrechen"
          >
            Abbrechen
          </button>
          <button
            onClick={handleUpdate}
            className="update-notification-button update-notification-button-primary"
            aria-label="Aktualisieren"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
