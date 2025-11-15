"use client"

import { useEffect, lazy, Suspense, Component } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom"
import Home from "@/pages/Home"
import { Navbar } from "@/components/layout"
import { OnlineProtectedRoute, AuthProtectedRoute, UpdateNotification, NetworkRecoveryHandler } from "@/components/common"
import AutoLogoutHandler from "@/components/common/AutoLogoutHandler"

// Eagerly import critical pages that should work offline
import Settings from "@/pages/Settings"
import { NewGame, GameDetails, GameInProgress, TableGame } from "@/pages/game"

// Lazy load less critical pages for better performance
const Profile = lazy(() => import("@/pages/profile/Profile"))
const ProfileEdit = lazy(() => import("@/pages/profile/ProfileEdit"))
const Leaderboard = lazy(() => import("@/pages/profile/Leaderboard"))
const Stats = lazy(() => import("@/pages/profile/Stats"))
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
          // Use TextDecoder for proper UTF-8 decoding instead of deprecated escape()
          const binaryString = atob(importGameParam);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const decoder = new TextDecoder('utf-8');
          const jsonData = decoder.decode(bytes);
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

// Error Boundary for lazy loading failures
class LazyLoadErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Check if it's a lazy loading error
    if (error.message?.includes('Failed to fetch dynamically imported module')) {
      return { hasError: true, error };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Lazy loading error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Show a friendly error message
      return (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <h2 style={{ color: '#ff6b6b', marginBottom: '20px' }}>
            ⚠️ Unable to Load Page
          </h2>
          <p style={{ marginBottom: '20px', lineHeight: '1.6' }}>
            {navigator.onLine 
              ? 'This page failed to load. This might be a temporary issue.'
              : 'This page cannot be loaded while offline. Please check your internet connection and try again.'}
          </p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
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
                <LazyLoadErrorBoundary>
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
                </LazyLoadErrorBoundary>
                {/* Network Recovery Handler - monitors connection and restores state */}
                <NetworkRecoveryHandler />
                </div>
              </GameStateProvider>
            </UserProvider>
          </OnlineStatusProvider>
        </ThemeProvider>
      </Router>
  )
}

export default App