import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import userService from '@/shared/api/userService';
import gameTemplateService from '@/shared/api/gameTemplateService';
import { MenuIcon, XIcon } from '@/components/ui/Icon';
import { useTranslation } from 'react-i18next';
import '@/styles/pages/admin.css';

const AdminLayout = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const isRootPath = location.pathname === '/admin' || location.pathname === '/admin/';
  const [stats, setStats] = useState({ users: 0, pendingSuggestions: 0 });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isRootPath) {
      loadStats();
    }
  }, [isRootPath]);

  const loadStats = async () => {
    try {
      const [usersData, suggestionsData] = await Promise.all([
        userService.getAllUsers(),
        gameTemplateService.getAdminSuggestions()
      ]);
      const usersArray = Array.isArray(usersData) ? usersData : (usersData.users || []);
      setStats({
        users: usersArray.length,
        pendingSuggestions: (suggestionsData.suggestions || []).length
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  return (
    <div className="admin-layout">
      {/* Mobile Menu Button */}
      <button 
        className="mobile-menu-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label={t('admin.toggleMenu')}
      >
        {mobileMenuOpen ? <XIcon size={24} /> : <MenuIcon size={24} />}
      </button>

      {/* Navigation Sidebar */}
      <nav className={`admin-nav ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <h2>{t('admin.adminPanel')}</h2>
        <ul>
          <li>
            <Link 
              to="/admin/template-suggestions" 
              className={location.pathname === '/admin/template-suggestions' ? 'active' : ''}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>{t('admin.templateSuggestions')}</span>
              {stats.pendingSuggestions > 0 && (
                <span className="nav-badge">{stats.pendingSuggestions}</span>
              )}
            </Link>
          </li>
          <li>
            <Link 
              to="/admin/users" 
              className={location.pathname === '/admin/users' ? 'active' : ''}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>{t('admin.userManagement')}</span>
            </Link>
          </li>
          <li>
            <Link 
              to="/admin/game-linkage" 
              className={location.pathname === '/admin/game-linkage' ? 'active' : ''}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>{t('admin.gameLinkage')}</span>
            </Link>
          </li>
          <li>
            <Link 
              to="/admin/player-linking" 
              className={location.pathname === '/admin/player-linking' ? 'active' : ''}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>{t('admin.playerLinking')}</span>
            </Link>
          </li>
          <li>
            <Link 
              to="/admin/elo" 
              className={location.pathname === '/admin/elo' ? 'active' : ''}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>{t('admin.eloManagement')}</span>
            </Link>
          </li>
        </ul>
      </nav>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div 
          className="mobile-menu-overlay" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <main className="admin-main">
        {isRootPath ? (
          <div className="admin-welcome">
            {/* <h1>Admin Dashboard</h1>
            <p>Welcome to the administration panel</p> */}
            
            {/* <div className="admin-stats">
              <div className="stat-card">
                <div className="stat-content">
                  <div className="stat-value">{stats.users}</div>
                  <div className="stat-label">Total Users</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-content">
                  <div className="stat-value">{stats.pendingSuggestions}</div>
                  <div className="stat-label">Pending Suggestions</div>
                </div>
              </div>
            </div> */}

            <div className="admin-cards">
              <Link to="/admin/template-suggestions" className="admin-card">
                <h3>{t('admin.templateSuggestions')}</h3>
                <p>{t('admin.templateSuggestionsDesc')}</p>
                {stats.pendingSuggestions > 0 && (
                  <div className="card-badge">{t('admin.pendingCount', { count: stats.pendingSuggestions })}</div>
                )}
              </Link>
              <Link to="/admin/users" className="admin-card">
                <h3>{t('admin.userManagement')}</h3>
                <p>{t('admin.userManagementDesc')}</p>
                <div className="card-badge">{t('admin.usersCount', { count: stats.users })}</div>
              </Link>
              <Link to="/admin/game-linkage" className="admin-card">
                <h3>{t('admin.gameLinkage')}</h3>
                <p>{t('admin.gameLinkageDesc')}</p>
              </Link>
              <Link to="/admin/player-linking" className="admin-card">
                <h3>{t('admin.playerLinking')}</h3>
                <p>{t('admin.playerLinkingDesc')}</p>
              </Link>
              <Link to="/admin/elo" className="admin-card">
                <h3>{t('admin.eloManagement')}</h3>
                <p>{t('admin.eloManagementDesc')}</p>
              </Link>
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
};

export default AdminLayout;
