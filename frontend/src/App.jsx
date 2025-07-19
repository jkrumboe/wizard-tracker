"use client"

import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom"
import Home from "@/pages/Home"
import Profile from "@/pages/Profile"
import Leaderboard from "@/pages/Leaderboard"
import Stats from "@/pages/Stats"
import NewGame from "@/pages/NewGame"
import GameDetails from "@/pages/GameDetails"
import GameInProgress from "@/pages/GameInProgress"
import Lobby from "@/pages/Lobby"
import MultiplayerGame from "@/pages/MultiplayerGame"
import Settings from "@/pages/Settings"
import Navbar from "@/components/Navbar"
import OnlineProtectedRoute from "@/components/OnlineProtectedRoute"
import AdminDashboard from "@/pages/admin/AdminDashboard.jsx";
import Login from "@/pages/Login";
import { register } from "@/serviceWorkerRegistration"
import { GameStateProvider } from "@/hooks/useGameState"
import { UserProvider } from "@/contexts/UserContext"
import { OnlineStatusProvider } from "@/contexts/OnlineStatusContext"
import { ThemeProvider } from "@/contexts/ThemeContext"
import authService from "@/services/authService"
import { LocalGameStorage } from "@/services/localGameStorage"
import "@/styles/theme.css"
import "@/utils/devUpdateHelper" // Development update testing helper

// Component to handle URL imports
function URLImportHandler() {
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleUrlImport = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const importGameParam = urlParams.get('importGame');
      const importGamesParam = urlParams.get('importGames');
      const shareKeyParam = urlParams.get('shareKey');
      
      if (importGameParam) {
        try {
          const jsonData = decodeURIComponent(escape(atob(importGameParam)));
          const compactGameData = JSON.parse(jsonData);
          
          // Convert compact data back to full game format - make it consistent with self-created games
          const fullGameData = {
            [compactGameData.id]: {
              id: compactGameData.id,
              name: `Imported Game - ${new Date(compactGameData.created_at).toLocaleDateString()}`,
              gameState: {
                id: compactGameData.id,
                players: compactGameData.players,
                winner_id: compactGameData.winner_id,
                final_scores: compactGameData.final_scores,
                round_data: compactGameData.round_data,
                total_rounds: compactGameData.total_rounds,
                created_at: compactGameData.created_at,
                game_mode: compactGameData.game_mode,
                duration_seconds: compactGameData.duration_seconds,
                currentRound: compactGameData.total_rounds,
                maxRounds: compactGameData.total_rounds,
                roundData: compactGameData.round_data,
                gameStarted: true,
                gameFinished: true,
                mode: compactGameData.game_mode,
                isLocal: true,
                isPaused: false,
                referenceDate: compactGameData.created_at,
                gameId: compactGameData.id,
                player_ids: compactGameData.players.map(p => p.id)
              },
              savedAt: compactGameData.created_at,
              lastPlayed: compactGameData.created_at,
              playerCount: compactGameData.players.length,
              roundsCompleted: compactGameData.total_rounds,
              totalRounds: compactGameData.total_rounds,
              mode: compactGameData.game_mode,
              gameFinished: true,
              isPaused: false,
              isImported: true,
              // Add top-level fields that are needed for game history consistency
              winner_id: compactGameData.winner_id,
              final_scores: compactGameData.final_scores,
              created_at: compactGameData.created_at,
              player_ids: compactGameData.players.map(p => p.id),
              round_data: compactGameData.round_data,
              total_rounds: compactGameData.total_rounds,
              duration_seconds: compactGameData.duration_seconds,
              is_local: true
            }
          };
          
          const success = LocalGameStorage.importGames(JSON.stringify(fullGameData));
          
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          if (success) {
            // Add a temporary flag to localStorage to show success message
            localStorage.setItem('import_success', 'true');
            // Navigate to settings to show the imported game
            navigate('/settings');
          }
          
        } catch (error) {
          console.error('Error importing game from URL:', error);
          // Clean up URL even on error
          window.history.replaceState({}, document.title, window.location.pathname);
          // Add error flag
          localStorage.setItem('import_error', 'true');
          navigate('/settings');
        }
      } else if (importGamesParam || shareKeyParam) {
        navigate('/settings');
      }
    };

    handleUrlImport();
  }, [navigate]);

  return null;
}

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
              <URLImportHandler />
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
                <Route path="/settings" element={<Settings />} />
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