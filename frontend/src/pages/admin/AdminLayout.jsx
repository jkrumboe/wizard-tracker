import { Suspense, useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import gameTemplateService from '@/shared/api/gameTemplateService';
import Icon from '@/components/ui/Icon';
import { AdminAvatar, AdminLoading } from '@/components/admin/AdminUI';
import { useUser } from '@/shared/hooks/useUser';
import '@/styles/pages/admin.css';

// Grouped by what an admin is working on. On phones a switcher button shows
// the current section and opens all sections as a grid; from 1024px they form
// the side rail.
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

const NAV_ITEMS = NAV_GROUPS.flatMap(group => group.items);

const AdminLayout = () => {
  const { t } = useTranslation();
  const { user } = useUser();
  const location = useLocation();
  const [pendingSuggestions, setPendingSuggestions] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  // Sub pages (e.g. /admin/games/:type/:id/edit) belong to their section
  const current = NAV_ITEMS.find(item => (item.end
    ? location.pathname.replace(/\/$/, '') === item.path
    : location.pathname.startsWith(item.path))) || NAV_ITEMS[0];

  useEffect(() => {
    gameTemplateService.getAdminSuggestions('pending')
      .then(data => setPendingSuggestions(data.counts?.pending ?? (data.suggestions || []).length))
      .catch(() => {});
  }, []);

  // The section menu closes on navigation and on Escape
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const showBadgeOnSwitcher = !menuOpen && pendingSuggestions > 0 && !current.hasBadge;

  return (
    <div className="admin-layout">
      <aside className={`adm-rail${menuOpen ? ' is-open' : ''}`}>
        <button
          type="button"
          className="adm-switcher"
          onClick={() => setMenuOpen(open => !open)}
          aria-expanded={menuOpen}
          aria-controls="admin-sections"
        >
          <span className="adm-switcher-icon">
            <Icon name={current.icon} size={18} />
          </span>
          <span className="adm-switcher-text">
            <span>{t('admin.adminPanel')}</span>
            <strong>{t(`admin.${current.key}`)}</strong>
          </span>
          {(current.hasBadge || showBadgeOnSwitcher) && pendingSuggestions > 0 && (
            <span className="adm-nav-badge" aria-label={t('admin.pendingCount', { count: pendingSuggestions })}>
              {pendingSuggestions}
            </span>
          )}
          <Icon name={menuOpen ? 'ChevronUp' : 'ChevronDown'} size={18} className="adm-switcher-chevron" />
        </button>

        <Link to="/admin" className="adm-rail-brand">
          <span className="adm-rail-mark">
            <Icon name="ShieldCheck" size={18} />
          </span>
          <span className="adm-rail-brand-text">
            <strong>{t('admin.adminPanel')}</strong>
            <span>{t('admin.railSubtitle')}</span>
          </span>
        </Link>

        <nav id="admin-sections" className="adm-nav" aria-label={t('admin.adminPanel')}>
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
