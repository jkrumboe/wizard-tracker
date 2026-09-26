"use client"

import { useEffect, lazy, Suspense, Component } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom"
import Home from "@/pages/Home"
import { Navbar } from "@/components/layout"
import { AuthProtectedRoute, UpdateNotification, SeoRouteMeta, OfflineStatusBar } from "@/components/common"
import AdminProtectedRoute from "@/components/common/AdminProtectedRoute"
import ServiceWorkerErrorRecovery from "@/components/common/ServiceWorkerErrorRecovery"

// Lazy load heavy pages for better initial load performance
// Service worker precaches all chunks, so offline support is maintained
const Account = lazy(() => import("@/pages/Account"))
const GamesPage = lazy(() => import("@/pages/game/GamesPage"))
const StartGame = lazy(() => import("@/pages/game/StartGame"))
const GameDetails = lazy(() => import("@/pages/game/GameDetails"))
const GameInProgress = lazy(() => import("@/pages/game/GameInProgress"))
const TableGame = lazy(() => import("@/pages/game/TableGame"))
const ScoreboardGame = lazy(() => import("@/pages/game/ScoreboardGame"))
const TableGameDetails = lazy(() => import("@/pages/game/TableGameDetails"))
const ScoreboardGameDetails = lazy(() => import("@/pages/game/ScoreboardGameDetails"))

// Lazy load admin pages - only accessible to admins
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"))
const TemplateSuggestions = lazy(() => import("@/pages/admin/TemplateSuggestions"))
const UserManagement = lazy(() => import("@/pages/admin/UserManagement"))
const GameManagement = lazy(() => import("@/pages/admin/GameManagement"))
const GameLinkageManagement = lazy(() => import("@/pages/admin/GameLinkageManagement"))
const PlayerLinking = lazy(() => import("@/pages/admin/PlayerLinking"))
const EloManagement = lazy(() => import("@/pages/admin/EloManagement"))

// Lazy load less critical pages for better performance
const Profile = lazy(() => import("@/pages/profile/Profile"))
const UserProfile = lazy(() => import("@/pages/profile/UserProfile"))
const ProfileEdit = lazy(() => import("@/pages/profile/ProfileEdit"))
const Leaderboard = lazy(() => import("@/pages/profile/Leaderboard"))
const FriendLeaderboard = lazy(() => import("@/pages/profile/FriendLeaderboard"))
const Stats = lazy(() => import("@/pages/profile/Stats"))
const Login = lazy(() => import("@/pages/auth/Login"))
import { register } from "./serviceWorkerRegistration"
import { GameStateProvider } from "@/shared/hooks/useGameState"
import { useViewportKeyboard } from "@/shared/hooks/useViewportKeyboard"
import { UserProvider, ThemeProvider } from "@/shared/contexts"
import { authService } from "@/shared/api/authService"
import { autoMigrateIfNeeded } from "@/shared/utils/localStorageMigration"
import "@/styles/base/theme.css"
import "@/styles/devices/tablet.css"
import "@/shared/utils/devUpdateHelper"

// Clears any scroll or keyboard pan the previous page left behind, so every
// page starts at its top with the safe area intact.
function ViewportScrollReset() {
  const location = useLocation();

  useEffect(() => {
    globalThis.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const shell = document.querySelector('.main-container');
    if (shell) shell.scrollTop = 0;
  }, [location.pathname]);

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
            onClick={() => globalThis.location.reload()}
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
  // Keep the app sized to the visible viewport when the keyboard opens
  useViewportKeyboard();

  useEffect(() => {
    // Log app version
    // eslint-disable-next-line no-undef
    const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
    console.log(`KeepWiz v${appVersion}`);
    
    // Auto-migrate local storage games to v3.0 format
    autoMigrateIfNeeded().then(result => {
      if (result.success && result.stats) {
        if (result.stats.migrated > 0) {
          console.log(`✅ Migrated ${result.stats.migrated} games to v3.0 format`);
        }
      }
    }).catch(error => {
      console.error('❌ Migration error:', error);
    });
    
    // Register service worker for PWA functionality
    register()
    
    // Initialize authentication service
    authService.initialize()
  }, []);
  
  return (
      <Router>
        <ThemeProvider>
            <UserProvider>
              <ServiceWorkerErrorRecovery />
              <GameStateProvider>
                <ViewportScrollReset />
                <SeoRouteMeta />
                <Navbar />
                <div className="main-container">
                <OfflineStatusBar />
                <LazyLoadErrorBoundary>
                  <Suspense fallback={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--text-muted)' }}>
                      <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    </div>
                  }>
                    <Routes>
                      <Route path="/" element={<Home />} />
                    <Route path="/profile" element={<Navigate to="/account" replace />} />
                    <Route path="/account/edit" element={
                      <AuthProtectedRoute>
                        <ProfileEdit />
                      </AuthProtectedRoute>
                    } />
                    <Route path="/profile/edit" element={<Navigate to="/account/edit" replace />} />
                    <Route path="/profile/:id" element={
                      <AuthProtectedRoute>
                        <Profile />
                      </AuthProtectedRoute>
                    } />
                    <Route path="/user/:id" element={<UserProfile />} />
                    <Route path="/leaderboard" element={<Leaderboard />} />
                    <Route path="/friend-leaderboard" element={<FriendLeaderboard />} />
                    <Route path="/stats/:name" element={<Stats />} />
                    <Route path="/profile/stats" element={<Stats />} />
                    <Route path="/new-game" element={<Navigate to="/start" replace />} />
                    <Route path="/games" element={<GamesPage />} />
                    <Route path="/start" element={<StartGame />} />
                    <Route path="/table" element={<Navigate to="/start" replace />} />
                    <Route path="/table/:id" element={<TableGame />} />
                    <Route path="/scoreboard/:id" element={<ScoreboardGame />} />
                    <Route path="/table-game/:id" element={<TableGameDetails />} />
                    <Route path="/scoreboard-game/:id" element={<ScoreboardGameDetails />} />
                    <Route path="/game/:id" element={<GameDetails />} />
                    <Route path="/game/current" element={<GameInProgress />} />
                    <Route path="/login" element= {
                        <Login />
                    }/>
                    <Route path="/account" element={<Account />} />
                    <Route path="/admin" element={
                      <AdminProtectedRoute>
                        <AdminLayout />
                      </AdminProtectedRoute>
                    }>
                      <Route path="template-suggestions" element={<TemplateSuggestions />} />
                      <Route path="users" element={<UserManagement />} />
                      <Route path="games" element={<GameManagement />} />
                      <Route path="game-linkage" element={<GameLinkageManagement />} />
                      <Route path="player-linking" element={<PlayerLinking />} />
                      <Route path="elo" element={<EloManagement />} />
                    </Route>
                    </Routes>
                  </Suspense>
                </LazyLoadErrorBoundary>
                {/* Update Notification - handles app updates */}
                <UpdateNotification />
                </div>
              </GameStateProvider>
            </UserProvider>
        </ThemeProvider>
      </Router>
  )
}

export default App