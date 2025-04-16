"use client"

import { useState } from "react"
import { Link, useLocation } from "react-router-dom"

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()

  const toggleMenu = () => {
    setIsOpen(!isOpen)
  }

  const closeMenu = () => {
    setIsOpen(false)
  }

  const isActive = (path) => {
    return location.pathname === path ? "active" : ""
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo" onClick={closeMenu}>
          Wizard Tracker
        </Link>

        <div className="menu-icon" onClick={toggleMenu}>
          <div className={`hamburger ${isOpen ? "open" : ""}`}></div>
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
          <li className="nav-item">
            <Link to="/login" className={`nav-link ${isActive("/login")}`} onClick={closeMenu}>
              Login
            </Link>
          </li>
        </ul>
    </nav>
  )
}

export default Navbar

