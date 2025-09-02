"use client"

import { useState, useEffect } from "react"
import { useLocation } from "react-router-dom"
import { Link } from "react-router-dom"
import { useUser } from '@/shared/hooks/useUser'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
// import { useTheme } from '@/hooks/useTheme'
import { TrophyIcon, GamepadIcon, HomeIcon, UsersIcon, SettingsIcon } from '@/components/ui/Icon'

import { XIcon } from '@/components/ui/Icon';
import '@/styles/components/modal.css';

// Modal for Games tab, styled like other modals
const GamesMenu = ({ show, onClose }) => {
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
          <Link to="/leaderboard" className="modal-button" onClick={onClose}>
            <TrophyIcon size={18} style={{ marginRight: 8 }} /> Leaderboard
          </Link>
          <Link to="/new-game" className="modal-button" onClick={onClose}>
            <GamepadIcon size={18} style={{ marginRight: 8 }} /> Wizard
          </Link>
          <Link to="/table" className="modal-button" onClick={onClose}>
            <UsersIcon size={18} style={{ marginRight: 8 }} /> Table
          </Link>
        </div>
      </div>
    </div>
  );
};
import ThemeToggle from '@/components/ui/ThemeToggle'
import defaultAvatar from "@/assets/default-avatar.png"
import avatarService from '@/shared/api/avatarService'
import "@/styles/components/components.css"

const Navbar = () => {
  const { user } = useUser()
  const { isOnline } = useOnlineStatus()
  // const { theme } = useTheme()
  const location = useLocation()
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatar)
  // Add state for Games menu
  const [showGamesMenu, setShowGamesMenu] = useState(false);
  // Close menu on route change
  useEffect(() => { setShowGamesMenu(false); }, [location.pathname]);

  // Load user avatar when user is available
  useEffect(() => {
    const loadAvatarUrl = async () => {
      if (user && isOnline) {
        try {
          const url = await avatarService.getAvatarUrl()
          setAvatarUrl(url)
        } catch (error) {
          console.error('Error loading navbar avatar:', error)
          setAvatarUrl(defaultAvatar)
        }
      } else {
        setAvatarUrl(defaultAvatar)
      }
    }

    loadAvatarUrl()

    // Listen for avatar updates (custom event that can be dispatched from Profile component)
    const handleAvatarUpdate = () => {
      loadAvatarUrl()
    }

    window.addEventListener('avatarUpdated', handleAvatarUpdate)

    return () => {
      window.removeEventListener('avatarUpdated', handleAvatarUpdate)
    }
  }, [user, isOnline])

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
      <div className="top-navbar">
        <Link to="/" className="navbar-logo">
          KeepWiz
        </Link>
        
        <div className="navbar-right">
          <ThemeToggle />
          
          {isOnline && (
          <Link to={user ? "/profile" : "/login"} className="profile-icon">
            <img
              src={avatarUrl}
              alt="Profile"
              className="navbar-avatar"
            />
          </Link>
          )}
        </div>
      </div>
      
      <nav className="bottom-navbar">
        <GamesMenu show={showGamesMenu} onClose={() => setShowGamesMenu(false)} />
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
