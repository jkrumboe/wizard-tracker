"use client"

import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom"
import Home from "@/pages/Home"
import Profile from "@/pages/profile/Profile"
import Leaderboard from "@/pages/profile/Leaderboard"
import Stats from "@/pages/profile/Stats"
import Settings from "@/pages/Settings"
import { NewGame, GameDetails, GameInProgress, Lobby, MultiplayerGame } from "@/pages/game"
import AdminDashboard from "@/pages/admin/AdminDashboard.jsx"
import Login from "@/pages/auth/Login"
import SharedGamePage from "@/pages/shared/SharedGamePage"
import RealtimeTest from "@/pages/RealtimeTest"
import { Navbar } from "@/components/layout"
import { OnlineProtectedRoute, AuthProtectedRoute } from "@/components/common"
import AppLoadingScreen from "@/components/common/AppLoadingScreen"
import AutoLogoutHandler from "@/components/common/AutoLogoutHandler"
import { register } from "./serviceWorkerRegistration"
import { GameStateProvider } from "@/shared/hooks/useGameState"
import { UserProvider, OnlineStatusProvider, ThemeProvider } from "@/shared/contexts"
import { authService } from "@/shared/api/authService"
import { LocalGameStorage } from "@/shared/api/localGameStorage"
import "@/styles/base/theme.css"
import "@/styles/devices/tablet.css"
import "@/shared/utils/devUpdateHelper"

// Component to handle URL imports
function URLImportHandler() {
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleUrlImport = () => {
      const currentPath = window.location.pathname;
      const urlParams = new URLSearchParams(window.location.search);
      const importGameParam = urlParams.get('importGame');
      const importGamesParam = urlParams.get('importGames');
      const shareKeyParam = urlParams.get('shareKey');
      
      // Check if this is a shared game link pattern
      if (currentPath.startsWith('/shared/')) {
        // Let React Router handle shared game links
        return;
      }
      
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

function App() {
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Show loading screen for minimum time, then hide it
    const timer = setTimeout(() => {
      setIsAppLoading(false);
    }, 1500);

    // Listen for beforeunload to show loading during updates/refreshes
    const handleBeforeUnload = () => {
      setIsUpdating(true);
    };

    // Don't set isUpdating on visibility change - let AppLoadingScreen handle this logic
    // This was causing the loading screen to show on every tab switch

    window.addEventListener('beforeunload', handleBeforeUnload);
    // Removed visibilitychange listener that was causing the issue

    // Register service worker for PWA functionality
    register()
    
    // Initialize authentication service
    authService.initialize()

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Removed visibilitychange cleanup
    };
  }, []);
  
  return (
    <AppLoadingScreen
      isLoading={isAppLoading || isUpdating}
      appName="Wizard Tracker"
      appSubtitle="Track your Wizard card game stats"
      minLoadingTime={600}
      showOnAppOpen={true}
      appOpenThreshold={15 * 60 * 1000}
      storageKey="wizardAppLastUsed"
      appVersion={import.meta.env.VITE_APP_VERSION || '1.1.8'}
      versionKey="wizardAppVersion"
    >
      <Router>
        <ThemeProvider>
          <OnlineStatusProvider>
            <UserProvider>
              <AutoLogoutHandler />
              <GameStateProvider>
                <URLImportHandler />
                <Navbar />
                <div className="main-container">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/profile" element={
                    <AuthProtectedRoute>
                      <Profile />
                    </AuthProtectedRoute>
                  } />
                  <Route path="/profile/:id" element={
                    <AuthProtectedRoute>
                      <Profile />
                    </AuthProtectedRoute>
                  } />
                  <Route path="/account" element={<Navigate to="/profile" replace />} />
                  <Route path="/leaderboard" element={
                    <OnlineProtectedRoute>
                      <Leaderboard />
                    </OnlineProtectedRoute>
                  } />
                  <Route path="/stats/:name" element={<Stats />} />
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
                  <Route path="/shared/:shareId" element={<SharedGamePage />} />
                  <Route path="/realtime-test" element={<RealtimeTest />} />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute roles={["admin"]}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
              </Routes>
                </div>
              </GameStateProvider>
            </UserProvider>
          </OnlineStatusProvider>
        </ThemeProvider>
      </Router>
    </AppLoadingScreen>
  )
}

export default App