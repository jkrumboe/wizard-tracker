import React, { useState, useEffect } from 'react';
import userService from '@/shared/api/userService';
import '@/styles/pages/admin.css';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [newUsername, setNewUsername] = useState('');
  const [editingRole, setEditingRole] = useState(null);
  const [newRole, setNewRole] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      console.log('Calling userService.getAllUsers()...');
      const data = await userService.getAllUsers();
      console.log('Received users:', data);
      console.log('Type of data:', typeof data);
      console.log('Is data an array?', Array.isArray(data));
      console.log('data.users:', data.users);
      console.log('Keys in data:', Object.keys(data));
      
      // Handle both array directly or object with users property
      const usersArray = Array.isArray(data) ? data : (data.users || []);
      console.log('Final users array:', usersArray);
      
      setUsers(usersArray);
      setError('');
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (user) => {
    setEditingUser(user._id || user.id);
    setNewUsername(user.username);
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setNewUsername('');
  };

  const handleStartRoleEdit = (user) => {
    setEditingRole(user._id || user.id);
    setNewRole(user.role || 'user');
  };

  const handleCancelRoleEdit = () => {
    setEditingRole(null);
    setNewRole('');
  };

  const handleSaveRole = async (userId) => {
    if (!newRole) {
      alert('Role cannot be empty');
      return;
    }

    if (!confirm(`Change user role to "${newRole}"?`)) {
      return;
    }

    try {
      await userService.updateUserRole(userId, newRole);
      alert('User role updated successfully!');
      setEditingRole(null);
      setNewRole('');
      loadUsers();
    } catch (err) {
      console.error('Error updating role:', err);
      alert('Failed to update role: ' + err.message);
    }
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
            <div key={user._id || user.id} className="user-card">
              <div className="user-content">
                <div className="user-details">
                  <div className="detail-item">
                    <label>Username:</label>
                    {editingUser === (user._id || user.id) ? (
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

                  <div className="detail-item">
                    <label>Role:</label>
                    {editingRole === (user._id || user.id) ? (
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        className="role-select"
                        autoFocus
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`role-badge role-${user.role || 'user'}`}>
                        {(user.role || 'user').toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="user-actions">
                {editingUser === (user._id || user.id) ? (
                  <>
                    <button 
                      className="btn-cancel" 
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </button>
                    <button 
                      className="btn-save" 
                      onClick={() => handleSaveUsername(user._id || user.id)}
                    >
                      Save Username
                    </button>
                  </>
                ) : editingRole === (user._id || user.id) ? (
                  <>
                    <button 
                      className="btn-cancel" 
                      onClick={handleCancelRoleEdit}
                    >
                      Cancel
                    </button>
                    <button 
                      className="btn-save" 
                      onClick={() => handleSaveRole(user._id || user.id)}
                    >
                      Save Role
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      className="btn-edit" 
                      onClick={() => handleStartEdit(user)}
                    >
                      Edit Username
                    </button>
                    <button 
                      className="btn-role" 
                      onClick={() => handleStartRoleEdit(user)}
                    >
                      Change Role
                    </button>
                  </>
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
