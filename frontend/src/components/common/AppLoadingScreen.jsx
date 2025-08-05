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
  appVersion = import.meta.env.VITE_APP_VERSION || '1.1.5.2',
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
        const last = localStorage.getItem(storageKey);
        const lastVersion = localStorage.getItem(versionKey);
        const timeExceeded = !last || Date.now() - parseInt(last, 10) > appOpenThreshold;
        const versionChanged = lastVersion !== appVersion;
        return timeExceeded || versionChanged;
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

  // Update last activity timestamp
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
    ['click', 'keydown', 'scroll', 'mousemove']
      .forEach(e => document.addEventListener(e, throttled));
    
    return () => ['click', 'keydown', 'scroll', 'mousemove']
      .forEach(e => document.removeEventListener(e, throttled));
  }, [showOnAppOpen, storageKey, versionKey, appVersion]);

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
