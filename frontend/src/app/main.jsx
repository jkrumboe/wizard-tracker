import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "@/styles/base/index.css"
import "@/styles/components/components.css"
import "@/styles/components/players.css" // Support for 2-6 players
import "@/styles/utils/playerResponsive.css" // Additional responsive styling for 2-6 players
import "@/styles/components/multi-player-scorecard.css" // Enhanced scorecard styles for multiple players

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

