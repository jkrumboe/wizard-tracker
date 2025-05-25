"use client"

import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useUser } from '../hooks/useUser'
import defaultAvatar from "../assets/default-avatar.png"
import "../styles/components.css"

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const { user, player, clearUserData } = useUser()
  const location = useLocation()
  const navigate = useNavigate()

  const toggleMenu = () => {
    setIsOpen(!isOpen)
  }

  const closeMenu = () => {
    setIsOpen(false)
  }

  const isActive = (path) => {
    return location.pathname === path ? "active" : ""
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    clearUserData();
    navigate("/login", { replace: true });
    window.location.reload();
  };

  // console.log("Player:", player); // Debugging line

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo" onClick={closeMenu}>
          Wizard Tracker
        </Link>       

        <div className="profile-icon" onClick={toggleMenu}>
          <img
            src={player?.avatar || defaultAvatar}
            alt="Profile"
            className="profile-avatar"
          />
        </div>
      </div>
      <ul className={`nav-menu ${isOpen ? "active" : ""}`}>
        <li className="nav-item">
          <Link to="/" className={`nav-link ${isActive("/")}`} onClick={closeMenu}>
            Home
          </Link>
        </li>
        <li className="nav-item">
          <Link to="/leaderboard" className={`nav-link ${isActive("/leaderboard")}`} onClick={closeMenu}>
            Leaderboard
          </Link>
        </li>
        <li className="nav-item">
          <Link to="/new-game" className={`nav-link ${isActive("/new-game")}`} onClick={closeMenu}>
            New Game
          </Link>
        </li>
        {user ? (
          <>
          <li className="nav-item">
            <Link to={`/profile/${user?.player_id}`} className={`nav-link ${isActive("/profile")}`} onClick={closeMenu}>
              Profile
            </Link>
          </li>
          <li className="nav-item">
            <Link className="nav-link" id="logout" onClick={handleLogout}>
              Logout
            </Link>
          </li>
            </>
        ) : (
          <li className="nav-item">
            <Link to="/login" className={`nav-link ${isActive("/login")}`} onClick={closeMenu}>
              Login
            </Link>
          </li>
        )}
      </ul>
    </nav>
  )
}

export default Navbar

