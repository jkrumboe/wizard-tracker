"use client"

import { useLocation } from "react-router-dom"
import { Link } from "react-router-dom"
import { useUser } from '../hooks/useUser'
import defaultAvatar from "../assets/default-avatar.png"
import "../styles/components.css"

const Navbar = () => {
  const { user, player } = useUser()
  const location = useLocation()

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
          Wizard Tracker
        </Link>
        
        <Link to={user ? `/profile/${user?.player_id}` : "/login"} className="profile-icon">
          <img
            src={player?.avatar || defaultAvatar}
            alt="Profile"
            className="profile-avatar"
          />
        </Link>
      </div>
      
      <nav className="bottom-navbar">
        <Link to="/leaderboard" className={`bottom-nav-item ${isActive("/leaderboard")}`}>
          <div className="nav-icon">🏆</div>
          <span>Leaderboard</span>
        </Link>
        
        <Link to="/new-game" className={`bottom-nav-item ${isActive(["/new-game", "/game", "/lobby", "/multiplayer"])}`}>
          <div className="nav-icon">🎮</div>
          <span>Play</span>
        </Link>
        
        <Link to="/settings" className={`bottom-nav-item ${isActive("/settings")}`}>
          <div className="nav-icon">⚙️</div>
          <span>Settings</span>
        </Link>
      </nav>
    </>
  );
};

export default Navbar;
