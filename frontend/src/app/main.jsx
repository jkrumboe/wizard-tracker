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

