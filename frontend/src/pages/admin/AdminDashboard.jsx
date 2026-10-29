import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
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
  AdminSection,
  AdminStat,
  AdminStats,
} from '@/components/admin/AdminUI';
import {
  formatDateTime,
  formatRelativeTime,
} from '@/components/admin/adminUtils';
import '@/styles/pages/admin.css';

const CHART_DAYS = 14;

function TrendChart({ data, label }) {
  const { t } = useTranslation();
  const days = (data || []).slice(-CHART_DAYS);
  if (days.length === 0) return <AdminEmpty icon="BarChart3">{t('admin.noData')}</AdminEmpty>;
  const max = Math.max(...days.map(day => day.count), 1);
  const total = days.reduce((sum, day) => sum + day.count, 0);

  return (
    <figure className="adm-chart">
      <figcaption>
        <strong>{total}</strong> {label}
      </figcaption>
      <div className="adm-chart-bars" role="img" aria-label={`${label}: ${total}`}>
        {days.map(day => (
          <span key={day.date} className="adm-chart-bar" title={`${day.date}: ${day.count}`}>
            <span style={{ height: `${Math.max((day.count / max) * 100, 3)}%` }} />
          </span>
        ))}
      </div>
      <div className="adm-chart-axis">
        <span>{days[0].date.slice(5)}</span>
        <span>{days[days.length - 1].date.slice(5)}</span>
      </div>
    </figure>
  );
}

/** Recent registrations / logins; a row opens that user's login history. */
function PeopleList({ people, timeKey, onOpen }) {
  const { t, i18n } = useTranslation();
  if (!people?.length) return <AdminEmpty icon="Users">{t('admin.noData')}</AdminEmpty>;
  return (
    <ul className="adm-list">
      {people.map(person => (
        <li key={person.id}>
          <button type="button" className="adm-list-row" onClick={() => onOpen(person)} title={t('admin.viewLoginHistory')}>
            <AdminAvatar name={person.username} />
            <span className="adm-list-main">
              <strong>{person.username}</strong>
              <span>{formatRelativeTime(person[timeKey], i18n.language)}</span>
            </span>
            {person.role === 'admin' && <AdminPill tone="accent">{person.role}</AdminPill>}
            <Icon name="ChevronRight" size={16} className="adm-list-chevron" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function LoginHistoryDialog({ person, onClose }) {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState({ loading: true, history: [], error: '' });

  useEffect(() => {
    let cancelled = false;
    userService.getLoginHistory(person.id)
      .then(data => !cancelled && setState({ loading: false, history: data.loginHistory || [], error: '' }))
      .catch(err => !cancelled && setState({ loading: false, history: [], error: err.message }));
    return () => { cancelled = true; };
  }, [person.id]);

  return (
    <AdminDialog title={t('admin.loginHistoryFor', { username: person.username })} icon="History" onClose={onClose} size="sm">
      {state.loading ? (
        <AdminLoading label={t('admin.loading')} />
      ) : state.error ? (
        <AdminNotice tone="error">{state.error}</AdminNotice>
      ) : state.history.length === 0 ? (
        <AdminEmpty icon="LogIn">{t('admin.noLoginHistory')}</AdminEmpty>
      ) : (
        <ul className="adm-timeline">
          {state.history.map((entry, index) => (
            <li key={`${entry.timestamp}-${index}`}>
              <Icon name="LogIn" size={14} />
              <span>{formatDateTime(entry.timestamp, i18n.language)}</span>
              <span className="adm-muted">{formatRelativeTime(entry.timestamp, i18n.language)}</span>
            </li>
          ))}
        </ul>
      )}
    </AdminDialog>
  );
}

const AdminDashboard = () => {
  const { t, i18n } = useTranslation();
  const { setPendingSuggestions } = useOutletContext() || {};
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyFor, setHistoryFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await userService.getAdminStats();
      setStats(data);
      setPendingSuggestions?.(data.pendingSuggestions || 0);
    } catch (err) {
      console.error('Error loading admin stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [setPendingSuggestions]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = (
    <button type="button" className="adm-icon-btn" onClick={load} disabled={loading} title={t('admin.refresh')} aria-label={t('admin.refresh')}>
      <Icon name="RefreshCw" size={16} className={loading ? 'adm-spin' : ''} />
    </button>
  );

  if (!stats) {
    return (
      <div className="adm-page">
        <AdminPageHeader title={t('admin.dashboardTitle')} subtitle={t('admin.dashboardSubtitle')} actions={refresh} />
        {error ? (
          <AdminNotice tone="error">
            {error}{' '}
            <button type="button" className="adm-link-btn" onClick={load}>{t('admin.retry')}</button>
          </AdminNotice>
        ) : (
          <AdminLoading label={t('admin.loadingDashboard')} />
        )}
      </div>
    );
  }

  const {
    users, games, identities, recentUsers, recentLogins,
    registrationTrend, gameActivityTrend, topPlayers, onlineUsers = [], onlineCount = 0,
    pendingSuggestions = 0,
  } = stats;

  return (
    <div className="adm-page">
      <AdminPageHeader title={t('admin.dashboardTitle')} subtitle={t('admin.dashboardSubtitle')} actions={refresh} />

      {error && <AdminNotice tone="error">{error}</AdminNotice>}

      <Link
        to="/admin/template-suggestions"
        className={`adm-attention${pendingSuggestions > 0 ? ' has-work' : ''}`}
      >
        <span className="adm-attention-icon">
          <Icon name={pendingSuggestions > 0 ? 'FileText' : 'CheckCircle2'} size={20} />
        </span>
        <span className="adm-attention-text">
          <strong>
            {pendingSuggestions > 0
              ? t('admin.pendingAlert', { count: pendingSuggestions })
              : t('admin.queueEmpty')}
          </strong>
          <span>{pendingSuggestions > 0 ? t('admin.reviewNow') : t('admin.queueEmptyHint')}</span>
        </span>
        <Icon name="ChevronRight" size={18} />
      </Link>

      <AdminStats className="adm-stats--dashboard">
        <AdminStat
          icon="Users"
          tone="accent"
          label={t('admin.totalUsers')}
          value={users.total}
          hint={`${users.activeLast7d} ${t('admin.activeLast7d')}`}
          trend={users.newLast7d}
        />
        <AdminStat
          icon="Gamepad2"
          tone="success"
          label={t('admin.totalGames')}
          value={games.totalAll}
          hint={t('admin.gamesSplit', { wizard: games.wizard.total, table: games.table.total })}
          trend={games.wizard.last7d + games.table.last7d}
        />
        <AdminStat
          icon="UserCheck"
          label={t('admin.playerIdentities')}
          value={identities.total}
          hint={`${identities.linked} ${t('admin.linked')} · ${identities.guest} ${t('admin.guests')}`}
        />
        <AdminStat
          icon="Radio"
          tone={onlineCount > 0 ? 'success' : undefined}
          label={t('admin.onlineNow')}
          value={onlineCount}
          hint={onlineCount > 0 ? null : t('admin.noUsersOnline')}
        />
      </AdminStats>

      {onlineCount > 0 && (
        <div className="adm-online" aria-label={t('admin.onlineUsers')}>
          {onlineUsers.map(person => (
            <span key={person.id} className="adm-online-chip">
              <span className="adm-online-dot" aria-hidden="true" />
              {person.username}
            </span>
          ))}
        </div>
      )}

      <div className="adm-grid adm-grid--2">
        <AdminSection icon="UserPlus" title={t('admin.registrationTrend')} description={t('admin.lastDays', { count: CHART_DAYS })}>
          <TrendChart data={registrationTrend} label={t('admin.newUsers')} />
        </AdminSection>
        <AdminSection icon="Activity" title={t('admin.gameActivity')} description={t('admin.lastDays', { count: CHART_DAYS })}>
          <TrendChart data={gameActivityTrend} label={t('admin.gamesPlayed')} />
        </AdminSection>
      </div>

      <div className="adm-grid adm-grid--2">
        <AdminSection icon="UserPlus" title={t('admin.recentRegistrations')}>
          <PeopleList people={recentUsers} timeKey="createdAt" onOpen={setHistoryFor} />
        </AdminSection>
        <AdminSection icon="Clock" title={t('admin.recentLogins')}>
          <PeopleList people={recentLogins} timeKey="lastLogin" onOpen={setHistoryFor} />
        </AdminSection>
      </div>

      <AdminSection icon="Trophy" title={t('admin.topPlayers')}>
        {topPlayers?.length ? (
          <ol className="adm-leaderboard">
            {topPlayers.map((player, index) => (
              <li key={player.id}>
                <span className="adm-rank">{index + 1}</span>
                <span className="adm-leaderboard-name">
                  <strong>
                    {player.name}
                    {player.isLinked && <Icon name="Link" size={12} className="adm-muted" aria-label={t('admin.linked')} />}
                  </strong>
                  <span>
                    {t('admin.playerRecord', { games: player.totalGames, wins: player.totalWins })}
                    {' · '}
                    {formatRelativeTime(player.lastGameAt, i18n.language)}
                  </span>
                </span>
                <span className="adm-winrate" title={t('admin.tblWinRate')}>
                  <span className="adm-winrate-track">
                    <span style={{ width: `${player.winRate}%` }} />
                  </span>
                  <span>{player.winRate}%</span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <AdminEmpty icon="Trophy">{t('admin.noData')}</AdminEmpty>
        )}
      </AdminSection>

      {historyFor && <LoginHistoryDialog person={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
};

export default AdminDashboard;
