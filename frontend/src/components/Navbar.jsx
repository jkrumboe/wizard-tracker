"use client"

import { useState, useEffect } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { getPlayerById} from '../services/playerService'
import defaultAvatar from "../assets/default-avatar.png"
import "../styles/components.css"

const Navbar = () => {
  const [player, setPlayer] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState(null)
  // const [loading, setLoading] = useState(true)
  // const [error, setError] = useState(null)
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

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const decoded = JSON.parse(atob(token.split(".")[1]));
      setUser(decoded);
    } else {
      console.log("No token found in localStorage.");
    }
  }, [])

  useEffect(() => {
    if (!user?.player_id) return;
  
    const fetchData = async () => {
      try {
        const playerData = await getPlayerById(user.player_id);
        if (playerData) {
          setPlayer({
            ...playerData,
            avatar: playerData.avatar || defaultAvatar,
          });
        }
      } catch (err) {
        console.error("Error fetching profile data:", err);
      }
    };
  
    fetchData();
  }, [user]);
  

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    navigate("/login", { replace: true });
    window.location.reload();
  };

  console.log("Player:", player); // Debugging line

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

