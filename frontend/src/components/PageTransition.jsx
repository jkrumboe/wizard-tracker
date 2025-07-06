import React, { useState, useEffect } from 'react';

const PageTransition = ({ 
  isLoading, 
  children, 
  loadingTitle = "Loading...", 
  loadingSubtitle = "Please wait while we fetch the data",
  minLoadingTime = 1500, // Minimum time to show loading screen for smooth UX
  showOnAppOpen = false, // New prop to control app open behavior
  appOpenThreshold = 30 * 60 * 1000, // 30 minutes in milliseconds
  storageKey = 'appLastUsed' // Customizable localStorage key
}) => {

  const [showContent, setShowContent] = useState(!isLoading);
  const [internalLoading, setInternalLoading] = useState(isLoading);
  const [animationPhase, setAnimationPhase] = useState('enter');

  useEffect(() => {
    
    // Check if this should be treated as an "app open" for this effect run
    const checkAppOpen = () => {
      if (!showOnAppOpen) {
        return true; // Always show if not using app open logic
      }
      
      const lastUsed = localStorage.getItem(storageKey);
      const now = Date.now();
      
      if (!lastUsed) {
        return true;
      }
      
      const timeSinceLastUse = now - parseInt(lastUsed);
      const shouldShow = timeSinceLastUse > appOpenThreshold;;
      
      return shouldShow;
    };
    
    // Always show loading when component first mounts with isLoading=true
    if (isLoading) {
      setShowContent(false);
      setInternalLoading(true);
      setAnimationPhase('enter');
      return;
    }
    
    // If loading is complete
    if (!isLoading) {
      
      // Only show transition if this is an app open situation OR we're not using app open logic
      if (!showOnAppOpen || checkAppOpen()) {
        
        // Start exit animation
        const timer = setTimeout(() => {
          setAnimationPhase('exit');
          
          // Wait for exit animation to complete before hiding
          setTimeout(() => {
            setInternalLoading(false);
            setShowContent(true);
            
            // Update the last used timestamp
            if (showOnAppOpen) {
              localStorage.setItem(storageKey, Date.now().toString());
            }
          }, 400); // Exit animation duration matches CSS
          
        }, minLoadingTime);

        return () => clearTimeout(timer);
      } else {
        // Skip transition - immediately show content
        setInternalLoading(false);
        setShowContent(true);
        
        // Update timestamp
        if (showOnAppOpen) {
          localStorage.setItem(storageKey, Date.now().toString());
        }
      }
    }
  }, [isLoading, minLoadingTime, showOnAppOpen, storageKey, appOpenThreshold]);

  // Track user activity to update the "last used" timestamp
  useEffect(() => {
    if (!showOnAppOpen) return;
    
    const updateActivity = () => {
      localStorage.setItem(storageKey, Date.now().toString());
    };
    
    // Update timestamp on user interactions
    const events = ['click', 'keydown', 'scroll', 'mousemove'];
    const throttledUpdate = throttle(updateActivity, 60000); // Update at most once per minute
    
    events.forEach(event => {
      document.addEventListener(event, throttledUpdate);
    });
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, throttledUpdate);
      });
    };
  }, [showOnAppOpen, storageKey]);
  
  // Simple throttle function to limit how often we update localStorage
  function throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    }
  }

  if (internalLoading) {
    return (
      <div className={`page-transition-container ${animationPhase}`}>
        <div className="transition-overlay"></div>
        <div className="transition-content">
          <div className="loader-container">
            {/* Animated wizard hat loader */}
            <div className="wizard-hat-loader">
              <div className="hat-base"></div>
              <div className="hat-tip"></div>
              <div className="magic-sparkles">
                <div className="sparkle sparkle-1"></div>
                <div className="sparkle sparkle-2"></div>
                <div className="sparkle sparkle-3"></div>
                <div className="sparkle sparkle-4"></div>
                <div className="sparkle sparkle-5"></div>
                <div className="sparkle sparkle-6"></div>
                <div className="sparkle sparkle-7"></div>
              </div>
            </div>
            
            {/* Floating cards animation */}
            <div className="floating-cards">
              <div className="card card-1" style={{animation: 'cardFloat1 3s ease-in-out infinite'}}></div>
              <div className="card card-2" style={{animation: 'cardFloat2 3.5s ease-in-out infinite 0.2s'}}></div>
              <div className="card card-3" style={{animation: 'cardFloat3 4s ease-in-out infinite 0.4s'}}></div>
            </div>
            
            {/* Progress bar with magical effect */}
            <div className="magic-progress">
              <div className="progress-track">
                <div className="progress-fill"></div>
                <div className="progress-glow"></div>
              </div>
            </div>
          </div>
          
          <div className="loading-text">
            <h2 className="loading-title">{loadingTitle}</h2>
            <p className="loading-subtitle">{loadingSubtitle}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`page-content ${showContent ? 'page-content-visible' : ''}`}>
      {children}
    </div>
  );
  
};

export default PageTransition;
