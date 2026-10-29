import { Suspense, useState, useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import gameTemplateService from '@/shared/api/gameTemplateService';
import Icon from '@/components/ui/Icon';
import { AdminAvatar, AdminLoading } from '@/components/admin/AdminUI';
import { useUser } from '@/shared/hooks/useUser';
import '@/styles/pages/admin.css';

// Grouped by what an admin is working on. On phones the groups collapse into
// one horizontally scrolling strip; from 1024px they form the side rail.
const NAV_GROUPS = [
  {
    key: 'navGroupOverview',
    items: [
      { path: '/admin', key: 'dashboard', icon: 'LayoutDashboard', end: true },
    ],
  },
  {
    key: 'navGroupContent',
    items: [
      { path: '/admin/template-suggestions', key: 'templateSuggestions', icon: 'FileText', hasBadge: true },
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
];

const AdminLayout = () => {
  const { t } = useTranslation();
  const { user } = useUser();
  const location = useLocation();
  const navRef = useRef(null);
  const [pendingSuggestions, setPendingSuggestions] = useState(0);

  useEffect(() => {
    gameTemplateService.getAdminSuggestions('pending')
      .then(data => setPendingSuggestions(data.counts?.pending ?? (data.suggestions || []).length))
      .catch(() => {});
  }, []);

  // Keep the active chip visible in the scrolling strip on small screens
  useEffect(() => {
    const active = navRef.current?.querySelector('.adm-nav-link.active');
    active?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [location.pathname]);

  return (
    <div className="admin-layout">
      <aside className="adm-rail">
        <Link to="/admin" className="adm-rail-brand">
          <span className="adm-rail-mark">
            <Icon name="ShieldCheck" size={18} />
          </span>
          <span className="adm-rail-brand-text">
            <strong>{t('admin.adminPanel')}</strong>
            <span>{t('admin.railSubtitle')}</span>
          </span>
        </Link>

        <nav ref={navRef} className="adm-nav" aria-label={t('admin.adminPanel')}>
          {NAV_GROUPS.map(group => (
            <div key={group.key} className="adm-nav-group">
              <span className="adm-nav-group-label">{t(`admin.${group.key}`)}</span>
              {group.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) => `adm-nav-link${isActive ? ' active' : ''}`}
                >
                  <Icon name={item.icon} size={17} />
                  <span>{t(`admin.${item.key}`)}</span>
                  {item.hasBadge && pendingSuggestions > 0 && (
                    <span className="adm-nav-badge" aria-label={t('admin.pendingCount', { count: pendingSuggestions })}>
                      {pendingSuggestions}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {user && (
          <div className="adm-rail-footer">
            <AdminAvatar name={user.username} />
            <span className="adm-rail-identity">
              <strong>{user.username}</strong>
              <span>{user.role}</span>
            </span>
          </div>
        )}
      </aside>

      {/* The single scrolling region of the admin area */}
      <main className="adm-main">
        {/* Sections load lazily; the shell stays put while they do */}
        <Suspense fallback={<AdminLoading label={t('admin.loading')} />}>
          <Outlet context={{ pendingSuggestions, setPendingSuggestions }} />
        </Suspense>
      </main>
    </div>
  );
};

export default AdminLayout;
