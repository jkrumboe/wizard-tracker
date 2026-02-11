import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * ServiceWorkerErrorRecovery Component
 * 
 * Detects and recovers from service worker precaching errors.
 * Shows a user-friendly message when old SW needs to be cleared.
 */
export default function ServiceWorkerErrorRecovery() {
  const [showRecovery, setShowRecovery] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    // Check if we need to show recovery UI
    const needsRecovery = localStorage.getItem('sw_precache_error') === 'true';
    if (needsRecovery) {
      setShowRecovery(true);
    }

    // Listen for new precache errors
    const handleError = (event) => {
      const error = event.reason || event.error;
      
      // Detect Workbox precaching errors (old or new format)
      const isPrecacheError = error && (
        error.message?.includes('bad-precaching-response') ||
        error.name === 'bad-precaching-response' ||
        (typeof error === 'string' && error.includes('bad-precaching-response'))
      );

      if (isPrecacheError) {
        console.warn('Service worker precaching error detected');
        event.preventDefault?.(); // Prevent error propagation
        
        // Mark that we need recovery
        localStorage.setItem('sw_precache_error', 'true');
        setShowRecovery(true);
      }
    };

    // Listen for both error types
    globalThis.addEventListener('unhandledrejection', handleError);
    globalThis.addEventListener('error', handleError);

    // Also check console for workbox errors (for old SW)
    const originalConsoleError = console.error;
    console.error = function(...args) {
      const message = args.join(' ');
      if (message.includes('bad-precaching-response') || message.includes('workbox')) {
        localStorage.setItem('sw_precache_error', 'true');
        setShowRecovery(true);
      }
      originalConsoleError.apply(console, args);
    };

    return () => {
      globalThis.removeEventListener('unhandledrejection', handleError);
      globalThis.removeEventListener('error', handleError);
      console.error = originalConsoleError;
    };
  }, []);

  const handleRecovery = async () => {
    setIsRecovering(true);
    
    try {
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log(`Unregistering ${registrations.length} service worker(s)...`);
        
        await Promise.all(
          registrations.map(registration => registration.unregister())
        );
      }

      // Clear all caches
      const cacheNames = await caches.keys();
      console.log(`Clearing ${cacheNames.length} cache(s)...`);
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );

      // Clear the error flag
      localStorage.removeItem('sw_precache_error');
      localStorage.removeItem('sw_needs_cleanup');
      
      console.log('Service worker recovery complete - reloading...');
      
      // Force a hard reload
      globalThis.location.reload(true);
    } catch (error) {
      console.error('Recovery failed:', error);
      // Still try to reload
      globalThis.location.reload(true);
    }
  };

  if (!showRecovery) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#1f2937',
        color: '#f9fafb',
        padding: '32px',
        borderRadius: '12px',
        maxWidth: '500px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '16px'
        }}>
          🔄
        </div>
        
        <h2 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          marginBottom: '12px',
          color: '#f9fafb'
        }}>
          {t('serviceWorker.appUpdateRequired')}
        </h2>
        
        <p style={{
          color: '#d1d5db',
          marginBottom: '24px',
          lineHeight: '1.6'
        }}>
          {t('serviceWorker.updateDescription')}
          {' '}
          <span style={{ fontSize: '14px', display: 'block', marginTop: '8px', color: '#9ca3af' }}>
            {t('serviceWorker.updateHint')}
          </span>
        </p>
        
        <button
          onClick={handleRecovery}
          disabled={isRecovering}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '12px 32px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '16px',
            fontWeight: '600',
            cursor: isRecovering ? 'not-allowed' : 'pointer',
            opacity: isRecovering ? 0.6 : 1,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!isRecovering) e.target.style.backgroundColor = '#2563eb';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3b82f6';
          }}
        >
          {isRecovering ? t('serviceWorker.updating') : t('serviceWorker.updateNow')}
        </button>
        
        {isRecovering && (
          <div style={{
            marginTop: '16px',
            color: '#9ca3af',
            fontSize: '14px'
          }}>
            {t('serviceWorker.pleaseWait')}
          </div>
        )}
      </div>
    </div>
  );
}
