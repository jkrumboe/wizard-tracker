"use client"

import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { Link } from "react-router-dom"
import { useTranslation } from 'react-i18next'
import { useUser } from '@/shared/hooks/useUser'
// import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
// import { useTheme } from '@/hooks/useTheme'
import { GamepadIcon, HomeIcon, UserIcon } from '@/components/ui/Icon'
import "@/styles/components/components.css"

const Navbar = () => {
  const { user } = useUser()
  const { t } = useTranslation()
  // const { isOnline } = useOnlineStatus()
  const location = useLocation()

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
        <Link to="/games" className={`bottom-nav-item games-tab ${isActive(["/games", "/start", "/leaderboard", "/friend-leaderboard", "/admin"])}`} aria-label={t('nav.games')}>
          <div className="nav-icon">
            <GamepadIcon size={20} />
          </div>
          <span>{t('nav.games')}</span>
        </Link>
        <Link to="/" className={`bottom-nav-item ${isActive("/")}`}> 
          <div className="nav-icon">
            <HomeIcon size={20} />
          </div>
          <span>{t('nav.home')}</span>
        </Link>
        <Link to="/account" className={`bottom-nav-item ${isActive("/account")}`}>
          <div className="nav-icon">
            <UserIcon size={20} />
          </div>
          <span>{t('nav.account')}</span>
        </Link>
      </nav>
    </>
  );

};

export default Navbar;
