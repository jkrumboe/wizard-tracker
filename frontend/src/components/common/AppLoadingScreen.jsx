import React, { useState, useEffect } from 'react';
import '@/styles//utils/splash.css';

const AppSplashScreen = ({
  isLoading,
  children,
  appName = "Wizard Tracker",
  appSubtitle = "Track your Wizard Games",
  minLoadingTime = 2000,
  showOnAppOpen = true,
  appOpenThreshold = 30 * 60 * 1000,
  storageKey = 'appLastUsed'
}) => {
  const [showContent, setShowContent] = useState(!isLoading);
  const [internalLoading, setInternalLoading] = useState(isLoading);
  const [animationPhase, setAnimationPhase] = useState('enter');

  // Steuerung Ein-/Ausblenden & Timing
  useEffect(() => {
    const checkAppOpen = () => {
      if (!showOnAppOpen) return true;
      const last = localStorage.getItem(storageKey);
      if (!last) return true;
      return Date.now() - parseInt(last, 10) > appOpenThreshold;
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
            setInternalLoading(false);
            setShowContent(true);
            showOnAppOpen && localStorage.setItem(storageKey, Date.now().toString());
        }, minLoadingTime);
        return () => clearTimeout(timer);
      } else {
        setInternalLoading(false);
        setShowContent(true);
        showOnAppOpen && localStorage.setItem(storageKey, Date.now().toString());
      }
    }
  }, [isLoading, minLoadingTime, showOnAppOpen, appOpenThreshold, storageKey]);

  // Letzte Aktivität updaten
  useEffect(() => {
    if (!showOnAppOpen) return;
    const update = () => localStorage.setItem(storageKey, Date.now().toString());
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
    ['click','keydown','scroll','mousemove']
      .forEach(e => document.addEventListener(e, throttled));
    return () => ['click','keydown','scroll','mousemove']
      .forEach(e => document.removeEventListener(e, throttled));
  }, [showOnAppOpen, storageKey]);

  // Splash-Screen
  if (internalLoading) {
    return (
      <div className={`splash-screen ${animationPhase}`}>
        <div className="splash-background">
          <div className="background-particles">
            {[...Array(20)].map((_, i) => (
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

          {/* Neuer Loading-Wirbel */}
          <div className="loading-indicator">
            <div className="magic-spinner" />
          </div>
        </div>
      </div>
    );
  }

  // Main Content
  // Hauptinhalt mit einfachem Fade-In
  return (
    <div className={`page-content ${showContent ? 'visible' : ''}`} style={{ overflowY: 'auto' }}>
      {children}
    </div>
  );
};

export default AppSplashScreen;
