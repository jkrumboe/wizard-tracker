import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import userService from '@/shared/api/userService';
import Icon from '@/components/ui/Icon';
import {
  AdminAvatar,
  AdminDialog,
  AdminEmpty,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminPill,
  AdminSearch,
  AdminTabs,
} from '@/components/admin/AdminUI';
import {
  formatDate,
  formatRelativeTime,
} from '@/components/admin/adminUtils';
import '@/styles/pages/admin.css';

const MIN_PASSWORD_LENGTH = 6;

const userIdOf = (user) => user._id || user.id;

/**
 * Everything an admin can do to one account, as views of one dialog:
 * overview, rename, change role, reset password, delete.
 */
function ManageUserDialog({ user, onClose, onDone }) {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState('overview');
  const [username, setUsername] = useState(user.username);
  const [role, setRole] = useState(user.role || 'user');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const id = userIdOf(user);

  const run = async (action, successMessage) => {
    setBusy(true);
    setError('');
    try {
      await action();
      onDone(successMessage);
    } catch (err) {
      console.error('Admin user action failed:', err);
      setError(err.message);
      setBusy(false);
    }
  };

  const show = (next) => {
    setError('');
    setView(next);
  };

  const passwordProblem = password && password.length < MIN_PASSWORD_LENGTH
    ? t('adminUsers.passwordMinLength')
    : confirmPassword && password !== confirmPassword
      ? t('adminUsers.passwordsMismatch')
      : '';

  const views = {
    overview: {
      title: t('adminUsers.manageUser', { username: user.username }),
      icon: 'User',
      body: (
        <>
          {user.isDeleted && (
            <AdminNotice tone="warning" title={t('adminUsers.accountDeletedWarning')}>
              {t('adminUsers.deletedDate', { date: formatDate(user.deletedAt, i18n.language) })}
            </AdminNotice>
          )}
          <dl className="adm-spec">
            <div>
              <dt>{t('adminUsers.usernameLabel')}</dt>
              <dd>{user.username}</dd>
            </div>
            <div>
              <dt>{t('adminUsers.roleLabel')}</dt>
              <dd><AdminPill tone={user.role === 'admin' ? 'accent' : 'neutral'}>{user.role || 'user'}</AdminPill></dd>
            </div>
            <div>
              <dt>{t('adminUsers.registeredLabel')}</dt>
              <dd>{formatDate(user.createdAt, i18n.language)}</dd>
            </div>
            <div>
              <dt>{t('adminUsers.lastLoginLabel')}</dt>
              <dd>{user.lastLogin ? formatRelativeTime(user.lastLogin, i18n.language) : '—'}</dd>
            </div>
          </dl>
          {user.isDeleted ? (
            <p className="adm-muted">{t('adminUsers.accountDeletedNoActions')}</p>
          ) : (
            <div className="adm-action-list">
              <button type="button" className="adm-action" onClick={() => show('username')}>
                <Icon name="Edit" size={18} />
                <span>{t('adminUsers.editUsername')}</span>
                <Icon name="ChevronRight" size={16} />
              </button>
              <button type="button" className="adm-action" onClick={() => show('role')}>
                <Icon name="Shield" size={18} />
                <span>{t('adminUsers.changeRole')}</span>
                <Icon name="ChevronRight" size={16} />
              </button>
              <button type="button" className="adm-action" onClick={() => show('password')}>
                <Icon name="Key" size={18} />
                <span>{t('adminUsers.resetPassword')}</span>
                <Icon name="ChevronRight" size={16} />
              </button>
              <button type="button" className="adm-action adm-action--danger" onClick={() => show('delete')}>
                <Icon name="Trash2" size={18} />
                <span>{t('adminUsers.deleteUser')}</span>
                <Icon name="ChevronRight" size={16} />
              </button>
            </div>
          )}
        </>
      ),
    },
    username: {
      title: t('adminUsers.editUsername'),
      icon: 'Edit',
      body: (
        <div className="adm-field">
          <label htmlFor="edit-username">{t('adminUsers.username')}</label>
          <input
            id="edit-username"
            className="adm-input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            maxLength={20}
            disabled={busy}
          />
        </div>
      ),
      submit: {
        label: t('adminUsers.saveUsername'),
        disabled: !username.trim() || username.trim() === user.username,
        action: () => run(
          () => userService.updateUsername(id, username.trim()),
          t('adminUsers.usernameUpdated')
        ),
      },
    },
    role: {
      title: t('adminUsers.changeRole'),
      icon: 'Shield',
      body: (
        <div className="adm-field">
          <label htmlFor="edit-role">{t('adminUsers.role')}</label>
          <select id="edit-role" className="adm-input" value={role} onChange={(event) => setRole(event.target.value)} disabled={busy}>
            <option value="user">{t('adminUsers.user')}</option>
            <option value="admin">{t('adminUsers.adminRole')}</option>
          </select>
          {role === 'admin' && role !== user.role && <p className="adm-field-hint">{t('adminUsers.adminRoleHint')}</p>}
        </div>
      ),
      submit: {
        label: t('adminUsers.saveRole'),
        disabled: role === (user.role || 'user'),
        action: () => run(() => userService.updateUserRole(id, role), t('adminUsers.roleUpdated')),
      },
    },
    password: {
      title: t('adminUsers.resetPasswordTitle', { username: user.username }),
      icon: 'Key',
      body: (
        <>
          <div className="adm-field">
            <label htmlFor="new-password">{t('adminUsers.newPassword')}</label>
            <input
              id="new-password"
              type="password"
              className="adm-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('adminUsers.newPasswordPlaceholder')}
              autoComplete="new-password"
              disabled={busy}
            />
          </div>
          <div className="adm-field">
            <label htmlFor="confirm-password">{t('adminUsers.confirmPassword')}</label>
            <input
              id="confirm-password"
              type="password"
              className="adm-input"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={t('adminUsers.confirmPasswordPlaceholder')}
              autoComplete="new-password"
              disabled={busy}
            />
          </div>
          {passwordProblem && <p className="adm-field-error">{passwordProblem}</p>}
        </>
      ),
      submit: {
        label: t('adminUsers.resetPassword'),
        disabled: !password || !confirmPassword || Boolean(passwordProblem),
        action: () => run(
          () => userService.resetUserPassword(id, password),
          t('adminUsers.passwordReset', { username: user.username })
        ),
      },
    },
    delete: {
      title: t('adminUsers.deleteUserAccount'),
      icon: 'Trash2',
      tone: 'danger',
      body: (
        <>
          <p className="adm-dialog-text"><strong>{t('adminUsers.deleteConfirm', { username: user.username })}</strong></p>
          <div className="adm-split-list">
            <div>
              <h3>{t('adminUsers.anonymizeWarning')}</h3>
              <ul>
                <li>{t('adminUsers.removeProfile')}</li>
                <li>{t('adminUsers.removeFriendConnections')}</li>
                <li>{t('adminUsers.unlinkIdentities')}</li>
              </ul>
            </div>
            <div>
              <h3>{t('adminUsers.preserveWarning')}</h3>
              <ul>
                <li>{t('adminUsers.preserveGames')}</li>
                <li>{t('adminUsers.preserveTemplates')}</li>
                <li>{t('adminUsers.preserveHistory')}</li>
              </ul>
            </div>
          </div>
          <AdminNotice tone="error">{t('adminUsers.cannotBeUndone')}</AdminNotice>
        </>
      ),
      submit: {
        label: t('adminUsers.deleteUser'),
        danger: true,
        action: () => run(
          () => userService.deleteUser(id),
          t('adminUsers.userAnonymized', { username: user.username })
        ),
      },
    },
  };

  const current = views[view];

  return (
    <AdminDialog
      title={current.title}
      icon={current.icon}
      tone={current.tone}
      onClose={onClose}
      busy={busy}
      footer={current.submit ? (
        <>
          <button type="button" className="adm-btn adm-btn--ghost" onClick={() => show('overview')} disabled={busy}>
            {t('common.back')}
          </button>
          <button
            type="button"
            className={`adm-btn ${current.submit.danger ? 'adm-btn--danger' : 'adm-btn--primary'}`}
            onClick={current.submit.action}
            disabled={busy || current.submit.disabled}
          >
            {busy && <Icon name="RefreshCw" size={16} className="adm-spin" />}
            {current.submit.label}
          </button>
        </>
      ) : null}
    >
      {current.body}
      {error && <AdminNotice tone="error">{error}</AdminNotice>}
    </AdminDialog>
  );
}

const UserManagement = () => {
  const { t, i18n } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [managing, setManaging] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await userService.getAllUsers();
      setUsers(Array.isArray(data) ? data : (data.users || []));
    } catch (err) {
      console.error('Error loading users:', err);
      setError(err.message || t('adminUsers.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const roleCounts = useMemo(() => users.reduce((acc, user) => {
    const role = user.role || 'user';
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {}), [users]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter(user => {
      if (roleFilter !== 'all' && (user.role || 'user') !== roleFilter) return false;
      return !query || user.username.toLowerCase().includes(query);
    });
  }, [users, search, roleFilter]);

  const handleDone = (message) => {
    setManaging(null);
    setNotice(message);
    load();
  };

  return (
    <div className="adm-page">
      <AdminPageHeader
        title={t('admin.userManagement')}
        subtitle={t('adminUsers.showingUsers', { filtered: filtered.length, total: users.length })}
        actions={(
          <button type="button" className="adm-icon-btn" onClick={load} disabled={loading} aria-label={t('admin.refresh')} title={t('admin.refresh')}>
            <Icon name="RefreshCw" size={16} className={loading ? 'adm-spin' : ''} />
          </button>
        )}
      />

      {notice && <AdminNotice tone="success" onDismiss={() => setNotice('')}>{notice}</AdminNotice>}

      <div className="adm-toolbar">
        <AdminSearch value={search} onChange={setSearch} placeholder={t('adminUsers.searchPlaceholder')} id="user-search" />
        <AdminTabs
          value={roleFilter}
          onChange={setRoleFilter}
          label={t('adminUsers.roleFilter')}
          options={[
            { value: 'all', label: t('adminUsers.allRoles'), count: users.length },
            { value: 'user', label: t('adminUsers.user'), count: roleCounts.user || 0 },
            { value: 'admin', label: t('adminUsers.adminRole'), count: roleCounts.admin || 0 },
          ]}
        />
      </div>

      {loading && users.length === 0 ? (
        <AdminLoading label={t('adminUsers.loadingUsers')} />
      ) : error ? (
        <AdminNotice tone="error">
          {error}{' '}
          <button type="button" className="adm-link-btn" onClick={load}>{t('admin.retry')}</button>
        </AdminNotice>
      ) : filtered.length === 0 ? (
        <div className="adm-card">
          <AdminEmpty icon="Users">
            {t('adminUsers.noUsersFound')}{(search || roleFilter !== 'all') && ` ${t('adminUsers.matchingFilters')}`}
          </AdminEmpty>
        </div>
      ) : (
        <ul className="adm-list adm-list--cards">
          {filtered.map(user => (
            <li key={userIdOf(user)}>
              <button
                type="button"
                className={`adm-list-row${user.isDeleted ? ' is-muted' : ''}`}
                onClick={() => setManaging(user)}
              >
                <AdminAvatar name={user.username} />
                <span className="adm-list-main">
                  <strong>{user.username}</strong>
                  <span>
                    {t('adminUsers.joined', { date: formatDate(user.createdAt, i18n.language) })}
                    {user.lastLogin && ` · ${t('adminUsers.seen', { when: formatRelativeTime(user.lastLogin, i18n.language) })}`}
                  </span>
                </span>
                {user.isDeleted && <AdminPill tone="danger">{t('adminUsers.deleted')}</AdminPill>}
                {(user.role || 'user') === 'admin' && <AdminPill tone="accent">{t('adminUsers.adminRole')}</AdminPill>}
                <Icon name="ChevronRight" size={16} className="adm-list-chevron" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {managing && <ManageUserDialog user={managing} onClose={() => setManaging(null)} onDone={handleDone} />}
    </div>
  );
};

export default UserManagement;
