import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./styles/index.css"
import "./styles/components.css"
import "./styles/players.css" // Support for 2-6 players
import "./styles/playerResponsive.css" // Additional responsive styling for 2-6 players
import "./styles/multi-player-scorecard.css" // Enhanced scorecard styles for multiple players

ReactDOM.createRoot(document.getElementById("root")).render(
  // Temporarily disable React.StrictMode to prevent double effect execution
  // that causes immediate room disconnection during development
  <App />
)

