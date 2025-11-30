"use client"

import { useState, useEffect } from "react"
import { useLocation } from "react-router-dom"
import { Link } from "react-router-dom"
import { useUser } from '@/shared/hooks/useUser'
// import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
// import { useTheme } from '@/hooks/useTheme'
import { TrophyIcon, GamepadIcon, HomeIcon, UsersIcon, SettingsIcon, ShieldIcon } from '@/components/ui/Icon'

import { XIcon } from '@/components/ui/Icon';
import '@/styles/components/modal.css';

// Modal for Games tab, styled like other modals
const GamesMenu = ({ show, onClose, user }) => {
  if (!show) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Games</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close Games Menu">
            <XIcon size={20} />
          </button>
        </div>
        <div className="modal-content games-menu-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          <Link to="/new-game" className="modal-button" onClick={onClose}>
            <GamepadIcon size={24} style={{ marginRight: 8 }} /> Wizard
          </Link>
          <Link to="/table" className="modal-button" onClick={onClose}>
            <UsersIcon size={24} style={{ marginRight: 8 }} /> Table
          </Link>
          <Link to="/leaderboard" className="modal-button" onClick={onClose}>
            <TrophyIcon size={24} style={{ marginRight: 8 }} /> Leaderboard
          </Link>
          {user && user.role === 'admin' && (
            <Link to="/admin" className="modal-button" onClick={onClose}>
              <ShieldIcon size={24} style={{ marginRight: 8 }} /> Admin Panel
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
import "@/styles/components/components.css"

const Navbar = () => {
  const { user } = useUser()
  // const { isOnline } = useOnlineStatus()
  const location = useLocation()
  // Add state for Games menu
  const [showGamesMenu, setShowGamesMenu] = useState(false);
  // Close menu on route change
  useEffect(() => { setShowGamesMenu(false); }, [location.pathname]);

  // Debug logging for user role
  useEffect(() => {
    if (user) {

      console.log('User:', user);
      console.log('User object in Navbar:', { username: user.username, role: user.role });
    }
  }, [user]);

  const isActive = (path) => {
    if (typeof path === 'string') {
      return location.pathname === path ? "active" : ""
    } else if (Array.isArray(path)) {
      return path.some(p => location.pathname.startsWith(p)) ? "active" : ""
    }
    return ""
  }

  return (
    <>
      <nav className="bottom-navbar">
        <GamesMenu show={showGamesMenu} onClose={() => setShowGamesMenu(false)} user={user} />
        <div
          className={`bottom-nav-item games-tab ${showGamesMenu ? "active" : ""}`}
          onClick={() => setShowGamesMenu(v => !v)}
          aria-label="Games"
        >
          <div className="nav-icon">
            <GamepadIcon size={20} />
          </div>
          <span>Games</span>
        </div>
        <Link to="/" className={`bottom-nav-item ${isActive("/")}`}> 
          <div className="nav-icon">
            <HomeIcon size={20} />
          </div>
          <span>Home</span>
        </Link>
        <Link to="/settings" className={`bottom-nav-item ${isActive("/settings")}`}>
          <div className="nav-icon">
            <SettingsIcon size={20} />
          </div>
          <span>Settings</span>
        </Link>
      </nav>
    </>
  );

};

export default Navbar;
