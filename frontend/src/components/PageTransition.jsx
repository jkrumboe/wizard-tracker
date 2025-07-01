import React, { useState, useEffect } from 'react';

const PageTransition = ({ 
  isLoading, 
  children, 
  loadingTitle = "Loading...", 
  loadingSubtitle = "Please wait while we fetch the data",
  minLoadingTime = 1500 // Minimum time to show loading screen for smooth UX
}) => {
  const [showContent, setShowContent] = useState(false);
  const [internalLoading, setInternalLoading] = useState(true);
  const [animationPhase, setAnimationPhase] = useState('enter');

  useEffect(() => {
    if (!isLoading) {
      // Start exit animation after ensuring minimum loading time
      const timer = setTimeout(() => {
        setAnimationPhase('exit');
        
        // Wait for exit animation to complete before hiding
        setTimeout(() => {
          setInternalLoading(false);
          // Immediate content show for smoother transition
          setShowContent(true);
        }, 400); // Exit animation duration matches CSS
        
      }, minLoadingTime);

      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
      setInternalLoading(true);
      setAnimationPhase('enter');
    }
  }, [isLoading, minLoadingTime]);

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
              </div>
            </div>
            
            {/* Floating cards animation */}
            <div className="floating-cards">
              <div className="card card-1"></div>
              <div className="card card-2"></div>
              <div className="card card-3"></div>
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
