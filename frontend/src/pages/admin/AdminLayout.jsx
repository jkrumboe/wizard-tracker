import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import userService from '@/shared/api/userService';
import gameTemplateService from '@/shared/api/gameTemplateService';
import '@/styles/pages/admin.css';

const AdminLayout = () => {
  const location = useLocation();
  const isRootPath = location.pathname === '/admin' || location.pathname === '/admin/';
  const [stats, setStats] = useState({ users: 0, pendingSuggestions: 0 });

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
      <nav className="admin-nav">
        <h2>Admin Panel</h2>
        <ul>
          <li>
            <Link 
              to="/admin/template-suggestions" 
              className={location.pathname === '/admin/template-suggestions' ? 'active' : ''}
            >
              <span>Template Suggestions</span>
              {stats.pendingSuggestions > 0 && (
                <span className="nav-badge">{stats.pendingSuggestions}</span>
              )}
            </Link>
          </li>
          <li>
            <Link 
              to="/admin/users" 
              className={location.pathname === '/admin/users' ? 'active' : ''}
            >
              <span>User Management</span>
            </Link>
          </li>
        </ul>
      </nav>

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
                <h3>Template Suggestions</h3>
                <p>Review and approve user-submitted game templates</p>
                {stats.pendingSuggestions > 0 && (
                  <div className="card-badge">{stats.pendingSuggestions} pending</div>
                )}
              </Link>
              <Link to="/admin/users" className="admin-card">
                <h3>User Management</h3>
                <p>Manage usernames and user information</p>
                <div className="card-badge">{stats.users} users</div>
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
