import React, { useState, useEffect } from 'react';
import userService from '@/shared/api/userService';
import '@/styles/pages/admin.css';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [newUsername, setNewUsername] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await userService.getAllUsers();
      setUsers(data.users || []);
      setError('');
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (user) => {
    setEditingUser(user._id);
    setNewUsername(user.username);
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setNewUsername('');
  };

  const handleSaveUsername = async (userId) => {
    if (!newUsername.trim()) {
      alert('Username cannot be empty');
      return;
    }

    if (!confirm('This will update the username across all games, scores, and records in the database. Continue?')) {
      return;
    }

    try {
      await userService.updateUsername(userId, newUsername.trim());
      alert('Username updated successfully!');
      setEditingUser(null);
      setNewUsername('');
      loadUsers();
    } catch (err) {
      console.error('Error updating username:', err);
      alert('Failed to update username: ' + err.message);
    }
  };

  if (loading) {
    return <div className="admin-container"><div className="loading">Loading users...</div></div>;
  }

  if (error) {
    return <div className="admin-container"><div className="error">{error}</div></div>;
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>User Management</h1>
        <p className="subtitle">Manage usernames and user information</p>
      </div>

      {users.length === 0 ? (
        <div className="no-users">
          <p>No users found</p>
        </div>
      ) : (
        <div className="users-list">
          {users.map((user) => (
            <div key={user._id} className="user-card">
              <div className="user-content">
                <div className="user-details">
                  <div className="detail-item">
                    <label>Username:</label>
                    {editingUser === user._id ? (
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="username-input"
                        autoFocus
                      />
                    ) : (
                      <span className="username">{user.username}</span>
                    )}
                  </div>

                  {user.email && (
                    <div className="detail-item">
                      <label>Email:</label>
                      <span>{user.email}</span>
                    </div>
                  )}

                  <div className="detail-item">
                    <label>Registered:</label>
                    <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                  </div>

                  {user.lastLogin && (
                    <div className="detail-item">
                      <label>Last Login:</label>
                      <span>{new Date(user.lastLogin).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="user-actions">
                {editingUser === user._id ? (
                  <>
                    <button 
                      className="btn-cancel" 
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </button>
                    <button 
                      className="btn-save" 
                      onClick={() => handleSaveUsername(user._id)}
                    >
                      Save Changes
                    </button>
                  </>
                ) : (
                  <button 
                    className="btn-edit" 
                    onClick={() => handleStartEdit(user)}
                  >
                    Edit Username
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserManagement;
