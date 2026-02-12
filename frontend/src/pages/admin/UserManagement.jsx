import React, { useState, useEffect } from 'react';
import userService from '@/shared/api/userService';
import { Trash2Icon, KeyIcon, XIcon } from '@/components/ui/Icon';
import { useTranslation } from 'react-i18next';
import '@/styles/pages/admin.css';

const UserManagement = () => {
  const { t } = useTranslation();
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
      alert(t('adminUsers.roleCannotBeEmpty'));
      return;
    }

    if (!confirm(t('adminUsers.confirmRoleChange', { role: newRole }))) {
      return;
    }

    try {
      await userService.updateUserRole(userId, newRole);
      alert(t('adminUsers.roleUpdated'));
      setEditingRole(null);
      setNewRole('');
      loadUsers();
    } catch (err) {
      console.error('Error updating role:', err);
      alert(t('adminUsers.roleUpdateFailed', { error: err.message }));
    }
  };

  const handleSaveUsername = async (userId) => {
    if (!newUsername.trim()) {
      alert(t('adminUsers.usernameCannotBeEmpty'));
      return;
    }

    if (!confirm(t('adminUsers.confirmUsernameChange'))) {
      return;
    }

    try {
      await userService.updateUsername(userId, newUsername.trim());
      alert(t('adminUsers.usernameUpdated'));
      setEditingUser(null);
      setNewUsername('');
      loadUsers();
    } catch (err) {
      console.error('Error updating username:', err);
      alert(t('adminUsers.usernameUpdateFailed', { error: err.message }));
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
      alert(t('adminUsers.passwordMinLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      alert(t('adminUsers.passwordsMismatch'));
      return;
    }

    try {
      await userService.resetUserPassword(passwordResetUser._id || passwordResetUser.id, newPassword);
      alert(t('adminUsers.passwordReset', { username: passwordResetUser.username }));
      handleClosePasswordModal();
    } catch (err) {
      console.error('Error resetting password:', err);
      alert(t('adminUsers.passwordResetFailed', { error: err.message }));
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
      await userService.deleteUser(deleteUser._id || deleteUser.id);
      alert(t('adminUsers.userAnonymized', { username: deleteUser.username }));
      handleCloseDeleteModal();
      loadUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      alert(t('adminUsers.deleteUserFailed', { error: err.message }));
    }
  };

  if (loading) {
    return <div className="admin-container"><div className="loading">{t('adminUsers.loadingUsers')}</div></div>;
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
          <label htmlFor="user-search" className="sr-only">{t('adminUsers.searchPlaceholder')}</label>
          <input
            id="user-search"
            type="text"
            placeholder={t('adminUsers.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-group">
          <label htmlFor="role-filter">{t('adminUsers.roleFilter')}</label>
          <select
            id="role-filter"
            value={roleFilter} 
            onChange={(e) => setRoleFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">{t('adminUsers.allRoles')}</option>
            <option value="user">{t('adminUsers.user')}</option>
            <option value="admin">{t('adminUsers.adminRole')}</option>
          </select>
        </div>
        <div className="results-count">
          {t('adminUsers.showingUsers', { filtered: filteredUsers.length, total: users.length })}
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="no-users">
          <p>{t('adminUsers.noUsersFound')}{(searchTerm || roleFilter !== 'all') && (' ' + t('adminUsers.matchingFilters'))}</p>
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
                    {user.isDeleted && <span className="deleted-badge">{t('adminUsers.deleted')}</span>}
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
              <h3>{t('adminUsers.manageUser', { username: actionUser.username })}</h3>
              <button className="close-btn" onClick={handleCloseActionsModal}>
                <XIcon size={20} />
              </button>
            </div>
            <div className="modal-body">
              {editingUser === (actionUser._id || actionUser.id) ? (
                <div className="form-group">
                  <label htmlFor="edit-username">{t('adminUsers.username')}</label>
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
                  <label htmlFor="edit-role">{t('adminUsers.role')}</label>
                  <select
                    id="edit-role"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="form-input"
                    autoFocus
                  >
                    <option value="user">{t('adminUsers.user')}</option>
                    <option value="admin">{t('adminUsers.adminRole')}</option>
                  </select>
                </div>
              ) : (
                <div className="user-info-modal">
                  {actionUser.isDeleted && (
                    <div className="deleted-warning">
                      <p>{t('adminUsers.accountDeletedWarning')}</p>
                      <p>{t('adminUsers.deletedDate', { date: new Date(actionUser.deletedAt).toLocaleDateString() })}</p>
                    </div>
                  )}
                  <div className="info-item-modal">
                    <span className="info-label-modal">{t('adminUsers.usernameLabel')}</span>
                    <span className="info-value-modal">{actionUser.username}</span>
                  </div>
                  <div className="info-item-modal">
                    <span className="info-label-modal">{t('adminUsers.registeredLabel')}</span>
                    <span className="info-value-modal">{new Date(actionUser.createdAt).toLocaleDateString()}</span>
                  </div>
                  {actionUser.lastLogin && (
                    <div className="info-item-modal">
                      <span className="info-label-modal">{t('adminUsers.lastLoginLabel')}</span>
                      <span className="info-value-modal">{new Date(actionUser.lastLogin).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="info-item-modal">
                    <span className="info-label-modal">{t('adminUsers.roleLabel')}</span>
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
                    {t('common.cancel')}
                  </button>
                  <button className="btn-save" onClick={() => { handleSaveUsername(actionUser._id || actionUser.id); handleCloseActionsModal(); }}>
                    {t('adminUsers.saveUsername')}
                  </button>
                </>
              ) : editingRole === (actionUser._id || actionUser.id) ? (
                <>
                  <button className="btn-cancel" onClick={() => { handleCancelRoleEdit(); handleCloseActionsModal(); }}>
                    {t('common.cancel')}
                  </button>
                  <button className="btn-save" onClick={() => { handleSaveRole(actionUser._id || actionUser.id); handleCloseActionsModal(); }}>
                    {t('adminUsers.saveRole')}
                  </button>
                </>
              ) : actionUser.isDeleted ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>
                  <p>{t('adminUsers.accountDeletedNoActions')}</p>
                </div>
              ) : (
                <>
                  <button className="btn-edit" onClick={() => { handleStartEdit(actionUser); }}>
                    {t('adminUsers.editUsername')}
                  </button>
                  <button className="btn-role" onClick={() => { handleStartRoleEdit(actionUser); }}>
                    {t('adminUsers.changeRole')}
                  </button>
                  <button className="btn-password" onClick={() => { handleOpenPasswordModal(actionUser); handleCloseActionsModal(); }}>
                    <KeyIcon size={16} />
                    {t('adminUsers.resetPassword')}
                  </button>
                  <button className="btn-delete-user" onClick={() => { handleOpenDeleteModal(actionUser); handleCloseActionsModal(); }}>
                    <Trash2Icon size={16} />
                    {t('adminUsers.deleteUser')}
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
              <h3>{t('adminUsers.resetPasswordTitle', { username: passwordResetUser?.username })}</h3>
              <button className="close-btn" onClick={handleClosePasswordModal}>
                <XIcon size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="new-password">{t('adminUsers.newPassword')}</label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('adminUsers.newPasswordPlaceholder')}
                  className="form-input"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirm-password">{t('adminUsers.confirmPassword')}</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('adminUsers.confirmPasswordPlaceholder')}
                  className="form-input"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={handleClosePasswordModal}>
                {t('common.cancel')}
              </button>
              <button 
                className="btn-save" 
                onClick={handleResetPassword}
                disabled={!newPassword || !confirmPassword}
              >
                {t('adminUsers.resetPassword')}
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
              <h3>{t('adminUsers.deleteUserAccount')}</h3>
              <button className="close-btn" onClick={handleCloseDeleteModal}>
                <XIcon size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p className="warning-text">
                {t('adminUsers.deleteConfirm', { username: deleteUser?.username })}
              </p>
              <p className="info-text">
                {t('adminUsers.anonymizeWarning')}
              </p>
              <ul className="delete-info-list">
                <li>{t('adminUsers.removeProfile')}</li>
                <li>{t('adminUsers.removeFriendConnections')}</li>
                <li>{t('adminUsers.unlinkIdentities')}</li>
              </ul>
              <p className="info-text" style={{ marginTop: '1rem' }}>
                {t('adminUsers.preserveWarning')}
              </p>
              <ul className="delete-info-list">
                <li>{t('adminUsers.preserveGames')}</li>
                <li>{t('adminUsers.preserveTemplates')}</li>
                <li>{t('adminUsers.preserveHistory')}</li>
              </ul>
              <p className="danger-text">
                {t('adminUsers.cannotBeUndone')}
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={handleCloseDeleteModal}>
                {t('common.cancel')}
              </button>
              <button 
                className="btn-delete-confirm" 
                onClick={handleConfirmDelete}
              >
                <Trash2Icon size={16} />
                {t('adminUsers.deleteUser')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
