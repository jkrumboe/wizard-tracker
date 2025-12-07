import React, { useState, useEffect } from 'react';
import { RefreshIcon, XIcon } from '@/components/ui/Icon';

const UpdateNotification = () => {
  const [showNotification, setShowNotification] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    // Check if auto-update is enabled
    const autoUpdate = localStorage.getItem('autoUpdate');
    const autoUpdateEnabled = autoUpdate === null || autoUpdate === 'true'; // Default to true

    // Listen for update events
    const handleUpdateReady = () => {
      setUpdateReady(true);
      
      if (autoUpdateEnabled) {
        // Auto-reload if setting is enabled
        console.debug('🔄 Auto-update enabled - reloading automatically');
        setTimeout(() => {
          globalThis.location.reload();
        }, 1000); // Small delay to avoid jarring experience
      } else {
        // Show notification if auto-update is disabled
        setShowNotification(true);
      }
    };

    // Listen for the custom event from service worker
    globalThis.addEventListener('sw-update-ready', handleUpdateReady);

    // Also check on mount if update is already ready
    if (sessionStorage.getItem('sw_update_ready') === 'true') {
      handleUpdateReady();
    }

    // Listen for service worker update found
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!autoUpdateEnabled) {
          setShowNotification(true);
        }
      });
    }

    return () => {
      globalThis.removeEventListener('sw-update-ready', handleUpdateReady);
    };
  }, []);

  const handleUpdate = () => {
    sessionStorage.removeItem('sw_update_ready');
    globalThis.location.reload();
  };

  const handleDismiss = () => {
    setShowNotification(false);
    // Still keep the flag so user can update later via Settings
  };

  if (!showNotification || !updateReady) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        left: '20px',
        maxWidth: '400px',
        margin: '0 auto',
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--primary)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-md)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        zIndex: 10000,
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-sm)' }}>
        <RefreshIcon size={24} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 var(--spacing-xs) 0', fontSize: '1rem', fontWeight: 600 }}>
            Update Available
          </h3>
          <p style={{ margin: '0 0 var(--spacing-md) 0', fontSize: '0.9rem', color: 'var(--text-light)' }}>
            A new version of the app is ready. Update now to get the latest features and improvements.
          </p>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <button
              onClick={handleUpdate}
              style={{
                flex: 1,
                padding: 'var(--spacing-sm) var(--spacing-md)',
                backgroundColor: 'var(--primary)',
                color: 'var(--text)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              Update Now
            </button>
            <button
              onClick={handleDismiss}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                backgroundColor: 'transparent',
                color: 'var(--text-light)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Later
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: 'var(--text-light)',
            flexShrink: 0,
          }}
          aria-label="Dismiss"
        >
          <XIcon size={20} />
        </button>
      </div>
    </div>
  );
};

export default UpdateNotification;
