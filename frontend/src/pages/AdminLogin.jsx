import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import '../styles/admin.css';

const AdminLogin = () => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [setupAvailable, setSetupAvailable] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if admin setup is needed
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      // Try to setup admin - if it fails with 409, admin already exists
      await authService.setupAdmin();
      setSetupAvailable(true);
    } catch (error) {
      if (error.message.includes('already exist')) {
        setSetupAvailable(false);
      } else {
        console.error('Setup check failed:', error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authService.adminLogin(credentials);
      navigate('/admin');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSetupAdmin = async () => {
    setLoading(true);
    setError('');

    try {
      await authService.setupAdmin();
      setSetupAvailable(false);
      setError(''); // Clear any previous errors
      alert('Default admin user created successfully! You can now login with your credentials.');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <h2>🔐 Admin Login</h2>
        
        {setupAvailable && (
          <div className="setup-banner">
            <p>⚠️ No admin users found. Click below to create the default admin user.</p>
            <button 
              type="button" 
              onClick={handleSetupAdmin}
              disabled={loading}
              className="setup-btn"
            >
              {loading ? 'Setting up...' : 'Setup Default Admin'}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="admin-login-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={credentials.username}
              onChange={handleInputChange}
              required
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={credentials.password}
              onChange={handleInputChange}
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || (!credentials.username || !credentials.password)}
            className="login-btn"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="login-footer">
          <p>
            <a href="/" className="back-link">← Back to Home</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;