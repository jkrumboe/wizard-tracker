"use client"

import { useState, useEffect } from "react"
import { useLocation } from "react-router-dom"
import { Link } from "react-router-dom"
import { useUser } from '@/shared/hooks/useUser'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
// import { useTheme } from '@/hooks/useTheme'
import { TrophyIcon, GamepadIcon, HomeIcon, UsersIcon, SettingsIcon } from '@/components/ui/Icon'
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
        {isOnline && (
          <Link to="/leaderboard" className={`bottom-nav-item ${isActive("/leaderboard")}`}>
            <div className="nav-icon">
              <TrophyIcon size={20} />
            </div>
            <span>Leaderboard</span>
          </Link>
        )}
        
        <Link to="/new-game" className={`bottom-nav-item ${isActive(["/new-game", "/game"])}`}>
          <div className="nav-icon">
            <GamepadIcon size={20} />
          </div>
          <span>Local Game</span>
        </Link>

        <Link to="/" className={`bottom-nav-item ${isActive("/")}`}>
          <div className="nav-icon">
            <HomeIcon size={20} />
          </div>
          <span>Home</span>
        </Link>

        {isOnline && (
          <Link to="/lobby" className={`bottom-nav-item ${isActive(["/lobby", "/multiplayer"])}`}>
            <div className="nav-icon">
              <UsersIcon size={20} />
            </div>
            <span>Multiplayer</span>
          </Link>
        )}
        
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
