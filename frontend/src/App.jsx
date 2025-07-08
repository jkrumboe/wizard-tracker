"use client"

import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Home from "./pages/Home"
import Profile from "./pages/Profile"
import Leaderboard from "./pages/Leaderboard"
import Stats from "./pages/Stats"
import NewGame from "./pages/NewGame"
import GameDetails from "./pages/GameDetails"
import GameInProgress from "./pages/GameInProgress"
import Lobby from "./pages/Lobby"
import MultiplayerGame from "./pages/MultiplayerGame"
import Navbar from "./components/Navbar"
import OnlineProtectedRoute from "./components/OnlineProtectedRoute"
import AdminDashboard from "./pages/AdminDashboard";
import Login from "./pages/Login";
import { register } from "./serviceWorkerRegistration"
import { GameStateProvider } from "./hooks/useGameState"
import { UserProvider } from "./contexts/UserContext"
import { OnlineStatusProvider } from "./contexts/OnlineStatusContext"
import { ThemeProvider } from "./contexts/ThemeContext"
import authService from "./services/authService"
import "./styles/theme.css"

function ProtectedRoute({ children, roles }) {
  const [userRole, setUserRole] = useState(null);
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split(".")[1]));
        console.debug("Decoded token:", decoded); // Debugging line
        setUserRole(decoded.role);
      } catch (error) {
        console.error("Error decoding token:", error);
        // Clear invalid token
        localStorage.removeItem("token");
        setUserRole(null);
      }
    }
  }, []);

  if (!userRole) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(userRole)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {  useEffect(() => {
    // Register service worker for PWA functionality
    register()
    
    // Initialize authentication service
    authService.initialize()
  }, []);
  
  return (
    <Router>
      <ThemeProvider>
        <UserProvider>
          <OnlineStatusProvider>
            <GameStateProvider>
              <Navbar />
              <div className="main-container">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/profile/:id" element={<Profile />} />
                <Route path="/leaderboard" element={
                  <OnlineProtectedRoute>
                    <Leaderboard />
                  </OnlineProtectedRoute>
                } />
                <Route path="/stats/:id" element={<Stats />} />
                <Route path="/new-game" element={<NewGame />} />
                <Route path="/game/:id" element={<GameDetails />} />
                <Route path="/game/current" element={<GameInProgress />} />
                <Route path="/lobby" element={
                  <OnlineProtectedRoute>
                    <Lobby />
                  </OnlineProtectedRoute>
                } />
                <Route path="/multiplayer/:roomId" element={
                  <OnlineProtectedRoute>
                    <MultiplayerGame />
                  </OnlineProtectedRoute>
                } />
                <Route path="/multiplayer/new" element={
                  <OnlineProtectedRoute>
                    <MultiplayerGame />
                  </OnlineProtectedRoute>
                } />
                <Route path="/login" element= {
                  <OnlineProtectedRoute>
                    <Login />
                  </OnlineProtectedRoute>
                }/>
                <Route path="/settings" element={<Home />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
            </Routes>            </div>
            </GameStateProvider>
          </OnlineStatusProvider>
        </UserProvider>
      </ThemeProvider>
    </Router>
  )
}

export default App