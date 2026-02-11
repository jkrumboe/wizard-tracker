import React, { useState, useEffect } from 'react';
import userService from '@/shared/api/userService';
import { Trash2Icon, KeyIcon, XIcon } from '@/components/ui/Icon';
import '@/styles/pages/admin.css';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [newUsername, setNewUsername] = useState('');
  const [editingRole, setEditingRole] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [actionUser, setActionUser] = useState(null);
  
  // Password reset modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteUser, setDeleteUser] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    let filtered = [...users];
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.username.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => (user.role || 'user') === roleFilter);
    }
    
    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter]);

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

  const toggleUserExpansion = (userId) => {
    setSelectedUser(selectedUser === userId ? null : userId);
  };

  const handleOpenActionsModal = (user, e) => {
    e.stopPropagation();
    setActionUser(user);
    setShowActionsModal(true);
  };

  const handleCloseActionsModal = () => {
    setShowActionsModal(false);
    setActionUser(null);
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

  const handleOpenPasswordModal = (user) => {
    setPasswordResetUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordResetUser(null);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      await userService.resetUserPassword(passwordResetUser._id || passwordResetUser.id, newPassword);
      alert(`Password reset successfully for ${passwordResetUser.username}!`);
      handleClosePasswordModal();
    } catch (err) {
      console.error('Error resetting password:', err);
      alert('Failed to reset password: ' + err.message);
    }
  };

  const handleOpenDeleteModal = (user) => {
    setDeleteUser(user);
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteUser(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteUser) return;

    try {
      const result = await userService.deleteUser(deleteUser._id || deleteUser.id);
      alert(`User "${deleteUser.username}" anonymized successfully!\n\nRemoved:\n- ${result.deletionStats.friendsRemoved} friend connections\n- ${result.deletionStats.friendRequestsDeleted} friend requests\n- ${result.deletionStats.identitiesUnlinked} identities unlinked\n\nPreserved (now anonymized):\n- ${result.deletionStats.gamesKept} games\n- ${result.deletionStats.tableGamesKept} table games\n- ${result.deletionStats.templatesKept} templates\n- ${result.deletionStats.aliasesKept} aliases`);
      handleCloseDeleteModal();
      loadUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Failed to delete user: ' + err.message);
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
      {/* <div className="admin-header">
        <h1>User Management</h1>
        <p className="subtitle">Manage usernames and user information</p>
      </div> */}

      <div className="admin-filters">
        <div className="search-box">
          <label htmlFor="user-search" className="sr-only">Search by username</label>
          <input
            id="user-search"
            type="text"
            placeholder="Search by username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-group">
          <label htmlFor="role-filter">Role:</label>
          <select
            id="role-filter"
            value={roleFilter} 
            onChange={(e) => setRoleFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="results-count">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="no-users">
          <p>No users found{(searchTerm || roleFilter !== 'all') && ' matching your filters'}</p>
        </div>
      ) : (
        <div className="users-list">
          {filteredUsers.map((user) => {
            const userId = user._id || user.id;
            
            return (
            <div 
              key={userId} 
              className={`user-card ${user.isDeleted ? 'deleted-user' : ''}`}
              onClick={(e) => handleOpenActionsModal(user, e)}
              style={{ cursor: 'pointer' }}
            >
              <div className="user-content">
                <div className="user-details">
                  <div className="detail-item">
                    <span className="username">{user.username}</span>
                    {user.isDeleted && <span className="deleted-badge">DELETED</span>}
                  </div>

                  <div className="detail-item">
                    <span className="detail-text">{new Date(user.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div className="detail-item">
                    <span className={`role-badge role-${user.role || 'user'}`}>
                      {(user.role || 'user').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Actions Modal */}
      {showActionsModal && actionUser && (
        <div className="modal-overlay" onClick={handleCloseActionsModal}>
          <div className="modal-content actions-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Manage User: {actionUser.username}</h3>
              <button className="close-btn" onClick={handleCloseActionsModal}>
                <XIcon size={20} />
              </button>
            </div>
            <div className="modal-body">
              {editingUser === (actionUser._id || actionUser.id) ? (
                <div className="form-group">
                  <label htmlFor="edit-username">Username</label>
                  <input
                    id="edit-username"
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="form-input"
                    autoFocus
                  />
                </div>
              ) : editingRole === (actionUser._id || actionUser.id) ? (
                <div className="form-group">
                  <label htmlFor="edit-role">Role</label>
                  <select
                    id="edit-role"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="form-input"
                    autoFocus
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              ) : (
                <div className="user-info-modal">
                  {actionUser.isDeleted && (
                    <div className="deleted-warning">
                      <p>⚠️ This account has been deleted and anonymized.</p>
                      <p>Deleted: {new Date(actionUser.deletedAt).toLocaleDateString()}</p>
                    </div>
                  )}
                  <div className="info-item-modal">
                    <span className="info-label-modal">Username:</span>
                    <span className="info-value-modal">{actionUser.username}</span>
                  </div>
                  <div className="info-item-modal">
                    <span className="info-label-modal">Registered:</span>
                    <span className="info-value-modal">{new Date(actionUser.createdAt).toLocaleDateString()}</span>
                  </div>
                  {actionUser.lastLogin && (
                    <div className="info-item-modal">
                      <span className="info-label-modal">Last Login:</span>
                      <span className="info-value-modal">{new Date(actionUser.lastLogin).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="info-item-modal">
                    <span className="info-label-modal">Role:</span>
                    <span className={`role-badge role-${actionUser.role || 'user'}`}>
                      {(actionUser.role || 'user').toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-actions">
              {editingUser === (actionUser._id || actionUser.id) ? (
                <>
                  <button className="btn-cancel" onClick={() => { handleCancelEdit(); handleCloseActionsModal(); }}>
                    Cancel
                  </button>
                  <button className="btn-save" onClick={() => { handleSaveUsername(actionUser._id || actionUser.id); handleCloseActionsModal(); }}>
                    Save Username
                  </button>
                </>
              ) : editingRole === (actionUser._id || actionUser.id) ? (
                <>
                  <button className="btn-cancel" onClick={() => { handleCancelRoleEdit(); handleCloseActionsModal(); }}>
                    Cancel
                  </button>
                  <button className="btn-save" onClick={() => { handleSaveRole(actionUser._id || actionUser.id); handleCloseActionsModal(); }}>
                    Save Role
                  </button>
                </>
              ) : actionUser.isDeleted ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>
                  <p>This account has been deleted. No actions available.</p>
                </div>
              ) : (
                <>
                  <button className="btn-edit" onClick={() => { handleStartEdit(actionUser); }}>
                    Edit Username
                  </button>
                  <button className="btn-role" onClick={() => { handleStartRoleEdit(actionUser); }}>
                    Change Role
                  </button>
                  <button className="btn-password" onClick={() => { handleOpenPasswordModal(actionUser); handleCloseActionsModal(); }}>
                    <KeyIcon size={16} />
                    Reset Password
                  </button>
                  <button className="btn-delete-user" onClick={() => { handleOpenDeleteModal(actionUser); handleCloseActionsModal(); }}>
                    <Trash2Icon size={16} />
                    Delete User
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={handleClosePasswordModal}>
          <div className="modal-content password-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reset Password for {passwordResetUser?.username}</h3>
              <button className="close-btn" onClick={handleClosePasswordModal}>
                <XIcon size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  className="form-input"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirm-password">Confirm Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="form-input"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={handleClosePasswordModal}>
                Cancel
              </button>
              <button 
                className="btn-save" 
                onClick={handleResetPassword}
                disabled={!newPassword || !confirmPassword}
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={handleCloseDeleteModal}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete User Account</h3>
              <button className="close-btn" onClick={handleCloseDeleteModal}>
                <XIcon size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p className="warning-text">
                Are you sure you want to delete <strong>{deleteUser?.username}</strong>?
              </p>
              <p className="info-text">
                This will anonymize the account and remove:
              </p>
              <ul className="delete-info-list">
                <li>User profile and login credentials</li>
                <li>All friend connections and friend requests</li>
                <li>Player identities will be unlinked (preserved for history)</li>
              </ul>
              <p className="info-text" style={{ marginTop: '1rem' }}>
                The following will be preserved (anonymized username):
              </p>
              <ul className="delete-info-list">
                <li>All games and table games</li>
                <li>All game templates</li>
                <li>Game history for other players</li>
              </ul>
              <p className="danger-text">
                ⚠️ This action cannot be undone!
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={handleCloseDeleteModal}>
                Cancel
              </button>
              <button 
                className="btn-delete-confirm" 
                onClick={handleConfirmDelete}
              >
                <Trash2Icon size={16} />
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
