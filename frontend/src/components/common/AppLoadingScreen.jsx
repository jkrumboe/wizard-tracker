import React, { useState, useEffect } from 'react';
import '@/styles/utils/splash.css';

const AppLoadingScreen = ({
  isLoading,
  children,
  appName = "Wizard Tracker",
  appSubtitle = "Track your Wizard Games",
  minLoadingTime = 1200,
  showOnAppOpen = true,
  appOpenThreshold = 30 * 60 * 1000, // 30 minutes
  storageKey = 'appLastUsed',
  appVersion = import.meta.env.VITE_APP_VERSION || '1.1.7',
  versionKey = 'appVersion'
}) => {
  const [showContent, setShowContent] = useState(!isLoading);
  const [internalLoading, setInternalLoading] = useState(isLoading);
  const [animationPhase, setAnimationPhase] = useState('enter');

  // Main loading control effect
  useEffect(() => {
    // Check if app should show splash screen on open
    const checkAppOpen = () => {
      if (!showOnAppOpen) return true;
      
      try {
        // Use sessionStorage to detect if this is the same session (tab switch) or new session (app reopen)
        const sessionId = sessionStorage.getItem('wizardAppSession');
        const lastAppClose = localStorage.getItem('wizardAppLastClose');
        const lastVersion = localStorage.getItem(versionKey);
        
        // If session exists, this is just a tab switch - don't show loading
        if (sessionId) {
          return false;
        }
        
        // Mark this as a new session
        sessionStorage.setItem('wizardAppSession', Date.now().toString());
        
        // Check if version changed (app update)
        const versionChanged = lastVersion !== appVersion;
        if (versionChanged) {
          localStorage.setItem(versionKey, appVersion);
          return true;
        }
        
        // Check if app was closed for more than 15 minutes
        if (!lastAppClose) {
          return true; // First time opening
        }
        
        const timeSinceClose = Date.now() - parseInt(lastAppClose, 10);
        const timeExceeded = timeSinceClose > appOpenThreshold;
        
        return timeExceeded;
      } catch {
        // If localStorage is unavailable, default to showing the splash
        return true;
      }
    };

    if (isLoading) {
      setInternalLoading(true);
      setShowContent(false);
      setAnimationPhase('enter');
      return;
    }

    if (!isLoading) {
      if (!showOnAppOpen || checkAppOpen()) {
        const timer = setTimeout(() => {
          setAnimationPhase('exit');
          // Wait for exit animation to complete before hiding
          const exitTimer = setTimeout(() => {
            setInternalLoading(false);
            setShowContent(true);
            if (showOnAppOpen) {
              try {
                localStorage.setItem(storageKey, Date.now().toString());
                localStorage.setItem(versionKey, appVersion);
              } catch {
                // localStorage unavailable
              }
            }
          }, 800); // Match the CSS transition duration
          return () => clearTimeout(exitTimer);
        }, minLoadingTime);
        return () => clearTimeout(timer);
      } else {
        setInternalLoading(false);
        setShowContent(true);
        if (showOnAppOpen) {
          try {
            localStorage.setItem(storageKey, Date.now().toString());
            localStorage.setItem(versionKey, appVersion);
          } catch {
            // localStorage unavailable
          }
        }
      }
    }
  }, [isLoading, minLoadingTime, showOnAppOpen, appOpenThreshold, storageKey, appVersion, versionKey]);

  // Update last activity timestamp and track app close events
  useEffect(() => {
    if (!showOnAppOpen) return;
    
    const update = () => {
      try {
        localStorage.setItem(storageKey, Date.now().toString());
        localStorage.setItem(versionKey, appVersion);
      } catch {
        // localStorage unavailable
      }
    };

    // Track when the app is actually closed (not just tab hidden)
    const handleBeforeUnload = () => {
      // App is being closed/refreshed
      localStorage.setItem('wizardAppLastClose', Date.now().toString());
      sessionStorage.removeItem('wizardAppSession');
    };

    // Track visibility changes to detect potential app closes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App is hidden - could be tab switch or minimize
        localStorage.setItem('wizardAppLastHidden', Date.now().toString());
      } else {
        // App is visible again
        const lastHidden = localStorage.getItem('wizardAppLastHidden');
        if (lastHidden) {
          const hiddenDuration = Date.now() - parseInt(lastHidden, 10);
          // If hidden for more than 15 minutes, consider it closed
          if (hiddenDuration > appOpenThreshold) {
            localStorage.setItem('wizardAppLastClose', lastHidden);
            sessionStorage.removeItem('wizardAppSession');
          }
        }
      }
    };

    const throttle = (fn, limit) => {
      let inThrottle = false;
      return (...args) => {
        if (!inThrottle) {
          fn(...args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    };

    const throttled = throttle(update, 60000);
    
    // Activity tracking
    ['click', 'keydown', 'scroll', 'mousemove']
      .forEach(e => document.addEventListener(e, throttled));
    
    // App close/visibility tracking
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      ['click', 'keydown', 'scroll', 'mousemove']
        .forEach(e => document.removeEventListener(e, throttled));
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showOnAppOpen, storageKey, versionKey, appVersion, appOpenThreshold]);

  // React loading screen (shows after PWA loading)
  if (internalLoading) {
    return (
      <div className={`splash-screen ${animationPhase}`}>
        <div className="splash-background">
          <div className="background-particles">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="particle"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${3 + Math.random() * 2}s`
                }}
              />
            ))}
          </div>
        </div>

        <div className="splash-content">
          <div className="app-info">
            <h1 className="app-name">{appName}</h1>
            <p className="app-subtitle">{appSubtitle}</p>
          </div>

          {/* Enhanced loading indicator */}
          <div className="loading-indicator">
            <div className="magic-spinner" />
          </div>
        </div>
      </div>
    );
  }

  // Main content with fade-in
  return (
    <div className={`page-content ${showContent ? 'visible' : ''}`} style={{ overflowY: 'auto' }}>
      {children}
    </div>
  );
};

export default AppLoadingScreen;
