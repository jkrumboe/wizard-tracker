import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "@/styles/base/index.css"
import "@/styles/components/components.css"
import "@/styles/components/players.css" // Support for 2-6 players
import "@/styles/utils/playerResponsive.css" // Additional responsive styling for 2-6 players
import "@/styles/components/multi-player-scorecard.css" // Enhanced scorecard styles for multiple players

// Initialize offline sync system
import { createSyncManager } from "@/shared/sync/syncManager"
import { syncApiClient } from "@/shared/api"
import { wasServiceWorkerForceUpdated, clearServiceWorkerUpdateFlag, forceServiceWorkerUpdate } from "@/shared/utils/swCleanup"

// Handle service worker precache errors
if (wasServiceWorkerForceUpdated()) {
  // Clear the flag after successful reload
  clearServiceWorkerUpdateFlag();
  console.log('Service worker was force updated and page reloaded');
}

// Listen for unhandled promise rejections (like SW precache errors)
window.addEventListener('unhandledrejection', (event) => {
  // Check if it's a Workbox precaching error
  if (event.reason && 
      (event.reason.message?.includes('bad-precaching-response') || 
       event.reason.name === 'bad-precaching-response')) {
    console.warn('Detected service worker precache error, will force update on next visit');
    event.preventDefault(); // Prevent the error from being logged
    
    // Store flag to force SW update on next visit
    localStorage.setItem('sw_needs_cleanup', 'true');
  }
});

// Check if SW needs cleanup from previous visit
if (localStorage.getItem('sw_needs_cleanup') === 'true') {
  localStorage.removeItem('sw_needs_cleanup');
  console.log('Forcing service worker cleanup due to previous precache error');
  forceServiceWorkerUpdate();
}

// Create and initialize sync manager
let syncManager;
try {
  syncManager = createSyncManager(syncApiClient);
  console.debug('Offline sync manager initialized');
  
  // Add global sync event listener for debugging
  syncManager.addListener((event) => {
    console.debug('Sync event:', event.type, event);
  });
} catch (error) {
  console.warn('Failed to initialize sync manager:', error);
}

// Make sync manager globally available for debugging
if (import.meta.env.DEV) {
  window.__syncManager = syncManager;
  window.__db = import('@/shared/db/database').then(m => m.db);
}

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  // Temporarily disable React.StrictMode to prevent double effect execution
  // that causes immediate room disconnection during development
  <App />
);

// Signal that React app is ready for PWA loading transition
setTimeout(() => {
  window.dispatchEvent(new Event('app-ready'));
}, 100);

