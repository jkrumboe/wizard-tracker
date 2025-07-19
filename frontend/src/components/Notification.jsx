import React, { useState, useEffect } from 'react';
import { XIcon } from '@/components/Icon';
import '@/styles/notification.css';

const Notification = ({ message, type = 'info', duration = 5000, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  // Use effect to animate in
  useEffect(() => {
    // Small delay to ensure CSS transition works properly
    const animationTimer = setTimeout(() => {
      setIsVisible(true);
    }, 50);
    
    return () => clearTimeout(animationTimer);
  }, []);
  
  // Set up automatic dismissal if duration is provided
  useEffect(() => {
    if (!duration) return;

    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onClose) setTimeout(onClose, 300); // Wait for fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) setTimeout(onClose, 300); // Wait for fade out animation
  };

  // Handle keyboard accessibility
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  return (
    <div 
      className={`notification ${type} ${isVisible ? 'visible' : 'hidden'}`}
      role="alert"
      aria-live="polite"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="notification-content">{message}</div>
      <button 
        className="notification-close" 
        onClick={handleClose} 
        aria-label="Close notification"
      >
        <XIcon size={16} />
      </button>
    </div>
  );
};

export default Notification;
