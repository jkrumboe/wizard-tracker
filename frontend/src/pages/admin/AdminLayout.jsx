import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import userService from '@/shared/api/userService';
import gameTemplateService from '@/shared/api/gameTemplateService';
import { MenuIcon, XIcon, AlertCircleIcon, ShieldCheckIcon, RefreshIcon } from '@/components/ui/Icon';
import Icon from '@/components/ui/Icon';
import { useUser } from '@/shared/hooks/useUser';
import { useTranslation } from 'react-i18next';
import '@/styles/pages/admin.css';

// Navigation is grouped by what an admin is actually working on, so the rail
// reads as four short lists instead of one flat column of six links.
const NAV_GROUPS = [
  {
    key: 'navGroupOverview',
    items: [
      { path: '/admin', key: 'dashboard', icon: 'LayoutDashboard', exact: true },
    ],
  },
  {
    key: 'navGroupPeople',
    items: [
      { path: '/admin/users', key: 'userManagement', icon: 'Users' },
      { path: '/admin/player-linking', key: 'playerLinking', icon: 'UserCheck' },
    ],
  },
  {
    key: 'navGroupGames',
    items: [
      { path: '/admin/games', key: 'gameManagement', icon: 'Gamepad2' },
      { path: '/admin/game-linkage', key: 'gameLinkage', icon: 'Link' },
      { path: '/admin/elo', key: 'eloManagement', icon: 'BarChart3' },
    ],
  },
  {
    key: 'navGroupContent',
    items: [
      { path: '/admin/template-suggestions', key: 'templateSuggestions', icon: 'FileText', hasBadge: true },
    ],
  },
];

const NAV_ITEMS = NAV_GROUPS.flatMap(group => group.items).filter(item => !item.exact);

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatRelative(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

function StatCard({ icon, label, value, subtitle, color, trend }) {
  return (
    <div className="admin-stat-card" style={{ '--stat-accent': color }}>
      <div className="stat-card-icon">
        <Icon name={icon} size={22} />
      </div>
      <div className="stat-card-body">
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
        {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
      </div>
      {trend !== undefined && trend !== null && (
        <div className={`stat-card-trend ${trend >= 0 ? 'trend-up' : 'trend-down'}`}>
          <Icon name={trend >= 0 ? 'TrendingUp' : 'TrendingDown'} size={14} />
          <span>{trend >= 0 ? '+' : ''}{trend}</span>
        </div>
      )}
    </div>
  );
}

function MiniBarChart({ data, label }) {
  if (!data || data.length === 0) return <div className="mini-chart-empty">No data</div>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="mini-bar-chart">
      <div className="mini-chart-label">{label}</div>
      <div className="mini-chart-bars">
        {data.slice(-14).map((d, i) => (
          <div key={i} className="mini-chart-bar-wrapper" title={`${d.date}: ${d.count}`}>
            <div
              className="mini-chart-bar"
              style={{ height: `${Math.max((d.count / max) * 100, 4)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mini-chart-dates">
        <span>{data.length > 0 ? data[Math.max(0, data.length - 14)].date.slice(5) : ''}</span>
        <span>{data.length > 0 ? data[data.length - 1].date.slice(5) : ''}</span>
      </div>
    </div>
  );
}

const AdminLayout = () => {
  const { t } = useTranslation();
  const { user } = useUser();
  const location = useLocation();
  const isRootPath = location.pathname === '/admin' || location.pathname === '/admin/';

  // Sub-pages (e.g. /admin/games/wizard/:id/edit) belong to their section
  const isInSection = useCallback(
    (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
    [location.pathname]
  );

  const isCurrent = useCallback(
    (item) => (item.exact ? isRootPath : isInSection(item)),
    [isRootPath, isInSection]
  );

  const currentSection = useMemo(
    () => NAV_ITEMS.find(isCurrent) || null,
    [isCurrent]
  );
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  const [pendingSuggestions, setPendingSuggestions] = useState(0);
  const [loginHistoryModal, setLoginHistoryModal] = useState(null); // { username, history }
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getAdminStats();
      setStats(data);
      setPendingSuggestions(data.pendingSuggestions || 0);
    } catch (err) {
      console.error('Error loading admin stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const openLoginHistory = useCallback(async (userId, username) => {
    setLoginHistoryLoading(true);
    setLoginHistoryModal({ username, history: [] });
    try {
      const data = await userService.getLoginHistory(userId);
      setLoginHistoryModal({ username: data.username, history: data.loginHistory || [] });
    } catch (err) {
      console.error('Error loading login history:', err);
      setLoginHistoryModal(prev => prev ? { ...prev, error: err.message } : null);
    } finally {
      setLoginHistoryLoading(false);
    }
  }, []);

  // The drawer must not survive a navigation or an Escape press
  useEffect(() => {
    closeMobileMenu();
  }, [location.pathname, closeMobileMenu]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeMobileMenu();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen, closeMobileMenu]);

  useEffect(() => {
    if (isRootPath) {
      loadStats();
    } else {
      // Still load badge counts for nav
      gameTemplateService.getAdminSuggestions()
        .then(d => setPendingSuggestions((d.suggestions || []).length))
        .catch(() => {});
    }
  }, [isRootPath, loadStats]);

  const renderDashboard = () => {
    if (loading && !stats) {
      return (
        <div className="admin-dashboard-loading">
          <RefreshIcon size={32} className="spin" />
          <p>{t('admin.loadingDashboard')}</p>
        </div>
      );
    }

    if (error && !stats) {
      return (
        <div className="admin-dashboard-error">
          <AlertCircleIcon size={32} />
          <p>{error}</p>
          <button className="btn-primary" onClick={loadStats}>{t('admin.retry')}</button>
        </div>
      );
    }

    if (!stats) return null;

    const { users, games, identities, recentUsers, recentLogins, registrationTrend, gameActivityTrend, topPlayers, onlineUsers, onlineCount } = stats;

    return (
      <div className="admin-dashboard">
        {/* Header */}
        <div className="admin-dashboard-header">
          <div>
            <h1>{t('admin.dashboardTitle')}</h1>
            <p className="admin-dashboard-subtitle">{t('admin.dashboardSubtitle')}</p>
          </div>
          <button className="btn-refresh" onClick={loadStats} disabled={loading} title={t('admin.refresh')}>
            <RefreshIcon size={18} className={loading ? 'spin' : ''} />
          </button>
        </div>

        {/* Quick Action Alerts */}
        {stats.pendingSuggestions > 0 && (
          <Link to="/admin/template-suggestions" className="admin-alert admin-alert-warning">
            <AlertCircleIcon size={18} />
            <span>{t('admin.pendingAlert', { count: stats.pendingSuggestions })}</span>
            <Icon name="ChevronRight" size={16} />
          </Link>
        )}

        {/* Stats Grid */}
        <div className="admin-stats-grid">
          <StatCard
            icon="Users"
            label={t('admin.totalUsers')}
            value={users.total}
            subtitle={`${users.activeLast7d} ${t('admin.activeLast7d')}`}
            color="var(--primary)"
            trend={users.newLast7d}
          />
          <StatCard
            icon="Gamepad2"
            label={t('admin.totalGames')}
            value={games.totalAll}
            subtitle={`${games.wizard.total} Wizard · ${games.table.total} Table`}
            color="var(--success-color)"
            trend={games.wizard.last7d + games.table.last7d}
          />
          <StatCard
            icon="UserCheck"
            label={t('admin.playerIdentities')}
            value={identities.total}
            subtitle={`${identities.linked} ${t('admin.linked')} · ${identities.guest} ${t('admin.guests')}`}
            color="var(--secondary)"
          />
          <StatCard
            icon="Radio"
            label={t('admin.onlineNow')}
            value={onlineCount || 0}
            subtitle={onlineCount > 0 ? onlineUsers.map(u => u.username).join(', ') : t('admin.noUsersOnline')}
            color="#10b981"
          />
        </div>

        {/* Online Users Bar */}
        {onlineCount > 0 && (
          <div className="admin-panel admin-online-panel">
            <div className="admin-panel-header">
              <h3>
                <span className="online-dot" />
                {t('admin.onlineUsers')} ({onlineCount})
              </h3>
            </div>
            <div className="online-users-list">
              {onlineUsers.map(u => (
                <div key={u.id} className="online-user-chip">
                  <span className="online-dot-small" />
                  <span>{u.username}</span>
                  <span className={`role-pill role-${u.role}`}>{u.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts + Activity Row */}
        <div className="admin-charts-row">
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h3><Icon name="UserPlus" size={16} /> {t('admin.registrationTrend')}</h3>
              <span className="admin-panel-badge">{t('admin.last30days')}</span>
            </div>
            <MiniBarChart data={registrationTrend} label={t('admin.newUsers')} />
          </div>
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h3><Icon name="Activity" size={16} /> {t('admin.gameActivity')}</h3>
              <span className="admin-panel-badge">{t('admin.last30days')}</span>
            </div>
            <MiniBarChart data={gameActivityTrend} label={t('admin.gamesPlayed')} />
          </div>
        </div>

        {/* Tables Row */}
        <div className="admin-tables-row">
          {/* Recent Users */}
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h3><Icon name="UserPlus" size={16} /> {t('admin.recentRegistrations')}</h3>
            </div>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t('admin.tblUsername')}</th>
                    <th>{t('admin.tblRegistered')}</th>
                    <th>{t('admin.tblRole')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map(u => (
                    <tr key={u.id} className="clickable-row" onClick={() => openLoginHistory(u.id, u.username)} title={t('admin.viewLoginHistory')}>
                      <td className="cell-username">{u.username}</td>
                      <td className="cell-date">{formatRelative(u.createdAt)}</td>
                      <td>
                        <span className={`role-pill role-${u.role}`}>{u.role}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Logins */}
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h3><Icon name="Clock" size={16} /> {t('admin.recentLogins')}</h3>
            </div>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t('admin.tblUsername')}</th>
                    <th>{t('admin.tblLastSeen')}</th>
                    <th>{t('admin.tblRole')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogins.map(u => (
                    <tr key={u.id} className="clickable-row" onClick={() => openLoginHistory(u.id, u.username)} title={t('admin.viewLoginHistory')}>
                      <td className="cell-username">{u.username}</td>
                      <td className="cell-date">{formatRelative(u.lastLogin)}</td>
                      <td>
                        <span className={`role-pill role-${u.role}`}>{u.role}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Top Players */}
        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3><Icon name="Trophy" size={16} /> {t('admin.topPlayers')}</h3>
          </div>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('admin.tblPlayer')}</th>
                  <th>{t('admin.tblGames')}</th>
                  <th>{t('admin.tblWins')}</th>
                  <th>{t('admin.tblWinRate')}</th>
                  <th>{t('admin.tblLastGame')}</th>
                </tr>
              </thead>
              <tbody>
                {topPlayers.map((p, i) => (
                  <tr key={p.id}>
                    <td className="cell-rank">{i + 1}</td>
                    <td className="cell-username">
                      {p.name}
                      {p.isLinked && <Icon name="Link" size={12} className="linked-icon" />}
                    </td>
                    <td>{p.totalGames}</td>
                    <td>{p.totalWins}</td>
                    <td>
                      <div className="win-rate-bar">
                        <div className="win-rate-fill" style={{ width: `${p.winRate}%` }} />
                        <span>{p.winRate}%</span>
                      </div>
                    </td>
                    <td className="cell-date">{formatRelative(p.lastGameAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Links */}
        <div className="admin-quick-links">
          <h3>{t('admin.quickLinks')}</h3>
          <div className="admin-quick-links-grid">
            {NAV_ITEMS.map(item => (
              <Link key={item.path} to={item.path} className="admin-quick-link">
                <Icon name={item.icon} size={20} />
                <span>{t(`admin.${item.key}`)}</span>
                {item.hasBadge && pendingSuggestions > 0 && (
                  <span className="quick-link-badge">{pendingSuggestions}</span>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Login History Modal */}
        {loginHistoryModal && (
          <div className="modal-overlay" onClick={() => setLoginHistoryModal(null)}>
            <div className="login-history-modal" onClick={e => e.stopPropagation()}>
              <div className="login-history-header">
                <h3>{t('admin.loginHistoryFor', { username: loginHistoryModal.username })}</h3>
                <button className="modal-close" onClick={() => setLoginHistoryModal(null)}>
                  <XIcon size={18} />
                </button>
              </div>
              <div className="login-history-content">
                {loginHistoryLoading ? (
                  <div className="login-history-loading">{t('admin.loading')}</div>
                ) : loginHistoryModal.error ? (
                  <div className="login-history-error">{loginHistoryModal.error}</div>
                ) : loginHistoryModal.history.length === 0 ? (
                  <div className="login-history-empty">{t('admin.noLoginHistory')}</div>
                ) : (
                  <ul className="login-history-list">
                    {loginHistoryModal.history.map((entry, i) => (
                      <li key={i} className="login-history-item">
                        <Icon name="LogIn" size={14} />
                        <span>{new Date(entry.timestamp).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="admin-layout">
      {/* Rail */}
      <aside className={`admin-rail ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <Link to="/admin" className="admin-rail-brand" onClick={closeMobileMenu}>
          <span className="admin-rail-mark">
            <ShieldCheckIcon size={18} />
          </span>
          <span>
            <h2>{t('admin.adminPanel')}</h2>
            <span>{t('admin.railSubtitle')}</span>
          </span>
        </Link>

        <div className="admin-rail-scroll">
          {NAV_GROUPS.map(group => (
            <div key={group.key} className="admin-nav-group">
              <span className="admin-nav-group-label">{t(`admin.${group.key}`)}</span>
              {group.items.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`admin-nav-link ${isCurrent(item) ? 'active' : ''}`}
                  aria-current={isCurrent(item) ? 'page' : undefined}
                  onClick={closeMobileMenu}
                >
                  <Icon name={item.icon} size={17} className="nav-link-icon" />
                  <span>{t(`admin.${item.key}`)}</span>
                  {item.hasBadge && pendingSuggestions > 0 && (
                    <span className="nav-badge">{pendingSuggestions}</span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </div>

        {user && (
          <div className="admin-rail-footer">
            <span className="admin-rail-avatar">{(user.username || '?').charAt(0).toUpperCase()}</span>
            <span className="admin-rail-identity">
              <strong>{user.username}</strong>
              <span>{user.role}</span>
            </span>
          </div>
        )}
      </aside>

      {/* Mobile drawer backdrop */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={closeMobileMenu} />
      )}

      {/* Workspace */}
      <div className="admin-workspace">
        <header className="admin-topbar">
          <button
            className="admin-menu-btn"
            onClick={() => setMobileMenuOpen(open => !open)}
            aria-label={t('admin.toggleMenu')}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <XIcon size={18} /> : <MenuIcon size={18} />}
          </button>

          <nav className="admin-breadcrumb" aria-label={t('admin.breadcrumbLabel')}>
            <Link to="/admin">{t('admin.adminPanel')}</Link>
            {currentSection && (
              <>
                <Icon name="ChevronRight" size={14} />
                <span className="admin-breadcrumb-current">{t(`admin.${currentSection.key}`)}</span>
              </>
            )}
          </nav>
        </header>

        {/* The single scrolling region of the admin area */}
        <div className="admin-scroll">
          {isRootPath ? renderDashboard() : <Outlet />}
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
