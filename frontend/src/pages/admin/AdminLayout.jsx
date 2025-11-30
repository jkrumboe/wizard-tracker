import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import '@/styles/pages/admin.css';

const AdminLayout = () => {
  const location = useLocation();
  const isRootPath = location.pathname === '/admin' || location.pathname === '/admin/';

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
              Template Suggestions
            </Link>
          </li>
          <li>
            <Link 
              to="/admin/users" 
              className={location.pathname === '/admin/users' ? 'active' : ''}
            >
              User Management
            </Link>
          </li>
        </ul>
      </nav>

      <main className="admin-main">
        {isRootPath ? (
          <div className="admin-welcome">
            <h1>Admin Dashboard</h1>
            <p>Select a section from the navigation menu</p>
            <div className="admin-cards">
              <Link to="/admin/template-suggestions" className="admin-card">
                <h3>Template Suggestions</h3>
                <p>Review and approve user-submitted game templates</p>
              </Link>
              <Link to="/admin/users" className="admin-card">
                <h3>User Management</h3>
                <p>Manage usernames and user information</p>
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
