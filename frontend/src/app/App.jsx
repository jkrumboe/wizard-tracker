"use client"

import { useEffect, lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom"
import Home from "@/pages/Home"
import { Navbar } from "@/components/layout"
import { OnlineProtectedRoute, AuthProtectedRoute, UpdateNotification } from "@/components/common"
import AutoLogoutHandler from "@/components/common/AutoLogoutHandler"

// Lazy load pages for better performance
const Profile = lazy(() => import("@/pages/profile/Profile"))
const ProfileEdit = lazy(() => import("@/pages/profile/ProfileEdit"))
const Leaderboard = lazy(() => import("@/pages/profile/Leaderboard"))
const Stats = lazy(() => import("@/pages/profile/Stats"))
const Settings = lazy(() => import("@/pages/Settings"))
const NewGame = lazy(() => import("@/pages/game").then(module => ({ default: module.NewGame })))
const GameDetails = lazy(() => import("@/pages/game").then(module => ({ default: module.GameDetails })))
const GameInProgress = lazy(() => import("@/pages/game").then(module => ({ default: module.GameInProgress })))
const Lobby = lazy(() => import("@/pages/game").then(module => ({ default: module.Lobby })))
const MultiplayerGame = lazy(() => import("@/pages/game").then(module => ({ default: module.MultiplayerGame })))
const GameRoom = lazy(() => import("@/pages/game").then(module => ({ default: module.GameRoom })))
const TableGame = lazy(() => import("@/pages/game").then(module => ({ default: module.TableGame })))
const Login = lazy(() => import("@/pages/auth/Login"))
const SharedGamePage = lazy(() => import("@/pages/shared/SharedGamePage"))
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

function App() {
  useEffect(() => {
    // Log app version
    // eslint-disable-next-line no-undef
    const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
    console.log(`KeepWiz v${appVersion}`);
    
    // Register service worker for PWA functionality
    register()
    
    // Initialize authentication service
    authService.initialize()
  }, []);
  
  return (
      <Router>
        <ThemeProvider>
          <OnlineStatusProvider>
            <UserProvider>
              <AutoLogoutHandler />
              <UpdateNotification />
              <GameStateProvider>
                <URLImportHandler />
                <Navbar />
                <div className="main-container">
                <Suspense fallback={<div className="loading-spinner">Loading...</div>}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                  <Route path="/profile" element={
                    <AuthProtectedRoute>
                      <Profile />
                    </AuthProtectedRoute>
                  } />
                  <Route path="/profile/edit" element={
                    <AuthProtectedRoute>
                      <ProfileEdit />
                    </AuthProtectedRoute>
                  } />
                  <Route path="/profile/:id" element={
                    <AuthProtectedRoute>
                      <Profile />
                    </AuthProtectedRoute>
                  } />
                  <Route path="/account" element={<Navigate to="/profile" replace />} />
                  {/* <Route path="/leaderboard" element={<Leaderboard />} /> */}
                  <Route path="/stats/:name" element={<Stats />} />
                  <Route path="/profile/stats" element={<Stats />} />
                  <Route path="/new-game" element={<NewGame />} />
                  <Route path="/table" element={<TableGame />} />
                  <Route path="/game/:id" element={<GameDetails />} />
                  <Route path="/game/current" element={<GameInProgress />} />
                  <Route path="/login" element= {
                    <OnlineProtectedRoute>
                      <Login />
                    </OnlineProtectedRoute>
                  }/>
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/shared/:shareId" element={<SharedGamePage />} />
                  </Routes>
                </Suspense>
                </div>
              </GameStateProvider>
            </UserProvider>
          </OnlineStatusProvider>
        </ThemeProvider>
      </Router>
  )
}

export default App