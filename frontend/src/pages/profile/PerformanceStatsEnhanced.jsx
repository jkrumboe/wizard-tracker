import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart, ReferenceLine } from 'recharts';
import { Lock, CircleCheck, ExternalLink } from 'lucide-react';
import StatTile from '@/components/stats/StatTile';
import { useUserElo } from '@/shared/hooks/useElo';
import { calculatePerformanceStats } from '@/shared/utils/performanceStats';
import { formatAchievementProgress, getAchievementGateKey } from '@/shared/utils/achievements';
import '@/styles/pages/account.css';
import "@/styles/pages/performancestats.css";

const PerformanceStatsEnhanced = ({ games, currentPlayer, isWizardGame = true, gameType = 'wizard', identityId = null }) => {
  const { t } = useTranslation();
  const stats = useMemo(
    () => calculatePerformanceStats(games, currentPlayer, { isWizardGame }),
    [games, currentPlayer, isWizardGame]
  );

  if (!stats) {
    return (
      <div className="performance-stats-container">
        <div className="empty-message" style={{ textAlign: 'center', color: 'var(--text)', marginTop: 'var(--spacing-xl)' }}>
          {t('profile.noGamesPlayed')}
        </div>
      </div>
    );
  }

  return (
    <PerformanceStatsContent stats={stats} isWizardGame={isWizardGame} gameType={gameType} identityId={identityId} />
  );
};

/**
 * Custom tooltip for performance charts with a "View Game" button
 */
const GameTooltip = ({ active, payload, _label, navigate, formatter }) => {
  const { t } = useTranslation();
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  const gameId = data?.gameId;
  const isTableGame = data?.isTableGame;
  const isScoreboardGame = data?.gameType === 'scoreboard' || String(gameId || '').startsWith('scoreboard_game_');

  const handleViewGame = (e) => {
    e.stopPropagation();
    if (!gameId) return;
    const route = isTableGame
      ? (isScoreboardGame ? `/scoreboard-game/${gameId}` : `/table-game/${gameId}`)
      : `/game/${gameId}`;
    navigate(route);
  };

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      color: 'var(--text)',
      padding: '8px 12px',
      fontSize: '0.85rem'
    }}>
      {/* Deduplicate entries (Area + Line both emit for same dataKey) */}
      {payload.filter((entry, idx, arr) => arr.findIndex(e => e.dataKey === entry.dataKey) === idx).map((entry, idx) => {
        const [val, name] = formatter ? formatter(entry.value, entry.name) : [entry.value, entry.name];
        return (
          <p key={idx} style={{ margin: '2px 0', color: entry.color || 'var(--text)' }}>
            {name}: {val}
          </p>
        );
      })}
      {data?.date && <p style={{ margin: '2px 0', opacity: 0.7, fontSize: '0.75rem' }}>{data.date}</p>}
      {gameId && (
        <button
          onClick={handleViewGame}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginTop: '6px',
            padding: '4px 10px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--primary)',
            background: 'transparent',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'background 0.15s'
          }}
          onPointerEnter={e => { if (e.pointerType === 'mouse') e.currentTarget.style.background = 'var(--primary-light, rgba(79,70,229,0.1))'; }}
          onPointerLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          {t('profile.viewGame')} <ExternalLink size={12} />
        </button>
      )}
    </div>
  );
};

/**
 * Custom tooltip for ELO chart with a "View Game" button
 */
const EloTooltip = ({ active, payload, _label, navigate, gameType: gt }) => {
  const { t } = useTranslation();
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  const gameId = data?.gameId;

  const handleViewGame = (e) => {
    e.stopPropagation();
    if (!gameId) return;
    // ELO is currently only for wizard games
    const isTableGame = gt && gt !== 'wizard';
    const isScoreboardGame = data?.gameType === 'scoreboard' || String(gameId || '').startsWith('scoreboard_game_');
    const route = isTableGame
      ? (isScoreboardGame ? `/scoreboard-game/${gameId}` : `/table-game/${gameId}`)
      : `/game/${gameId}`;
    navigate(route);
  };

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      color: 'var(--text)',
      padding: '8px 12px',
      fontSize: '0.85rem'
    }}>
      {payload.filter((entry, idx, arr) => arr.findIndex(e => e.dataKey === entry.dataKey) === idx).map((entry, idx) => {
        let val = entry.value;
        let name = entry.name;
        if (name === 'rating') { name = t('profile.rating'); }
        if (name === 'change') { name = t('profile.change'); val = val > 0 ? `+${val}` : val; }
        return (
          <p key={idx} style={{ margin: '2px 0', color: entry.color || 'var(--text)' }}>
            {name}: {val}
          </p>
        );
      })}
      {data?.placement && (
        <p style={{ margin: '2px 0', fontWeight: 600 }}>
          {t('profile.placement')}: {data.placement === 1 ? '1st' : data.placement === 2 ? '2nd' : data.placement === 3 ? '3rd' : `${data.placement}th`}
        </p>
      )}
      {data?.date && <p style={{ margin: '2px 0', opacity: 0.7, fontSize: '0.75rem' }}>{data.date}</p>}
      {gameId && (
        <button
          onClick={handleViewGame}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginTop: '6px',
            padding: '4px 10px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--primary)',
            background: 'transparent',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'background 0.15s'
          }}
          onPointerEnter={e => { if (e.pointerType === 'mouse') e.currentTarget.style.background = 'var(--primary-light, rgba(79,70,229,0.1))'; }}
          onPointerLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          {t('profile.viewGame')} <ExternalLink size={12} />
        </button>
      )}
    </div>
  );
};

const RELATIVE_MARGIN_ACHIEVEMENTS = ['dominator', 'nailBiter'];

const LINE_COLOR = '#4F46E5';
const BEST_COLOR = '#1DBF73';
const WORST_COLOR = '#EF4444';

/** Chart dot - larger and coloured for the single best and worst game. */
const renderTrendDot = (dataKey) => (props) => {
  const { cx, cy, payload, index } = props;
  if (payload[dataKey] === null || payload[dataKey] === undefined) return <g key={index} />;
  if (payload.isBest) {
    return <circle key={index} cx={cx} cy={cy} r={6} fill={BEST_COLOR} stroke="#fff" strokeWidth={2} />;
  }
  if (payload.isWorst) {
    return <circle key={index} cx={cx} cy={cy} r={6} fill={WORST_COLOR} stroke="#fff" strokeWidth={2} />;
  }
  return <circle key={index} cx={cx} cy={cy} r={3} fill={LINE_COLOR} />;
};

/** Flag the one best and one worst point, by game rather than by value. */
const markBestWorst = (data, bestGame, worstGame) =>
  data.map((d) => ({
    ...d,
    isBest: d.game === bestGame,
    isWorst: d.game === worstGame && d.game !== bestGame,
  }));

/** A titled block of the stats page. */
const StatsSection = ({ title, subtitle, children }) => (
  <section className="perf-section">
    <header className="achievements-header">
      <h2>{title}</h2>
      {subtitle && <span className="achievements-count">{subtitle}</span>}
    </header>
    {children}
  </section>
);

/** Rating history from the ELO API, oldest first, with peak and floor marked. */
const useEloHistory = (history) =>
  useMemo(() => {
    if (!history || history.length === 0) return [];

    let runningRating = 1000;
    const data = [...history].reverse().map((entry, idx) => {
      runningRating = entry.ratingAfter || runningRating + entry.change;
      return {
        game: idx + 1,
        rating: runningRating,
        change: entry.change,
        placement: entry.placement || null,
        date: entry.date ? new Date(entry.date).toLocaleDateString() : '',
        gameId: entry.gameId || null,
      };
    });

    const best = data.reduce((top, d) => (d.rating > top.rating ? d : top));
    const worst = data.reduce((low, d) => (d.rating < low.rating ? d : low));
    return markBestWorst(data, best.game, worst.game);
  }, [history]);

// Separate component to use hooks (since stats is computed in useMemo)
const PerformanceStatsContent = ({ stats, isWizardGame, gameType, identityId = null }) => {
  const { t } = useTranslation();

  // Normalize game type for the ELO API
  const normalizedGameType = gameType?.toLowerCase().trim().replace(/\s+/g, '-') || 'wizard';
  const { elo, loading: eloLoading } = useUserElo(normalizedGameType, identityId);
  const eloHistory = useEloHistory(elo?.history);
  // Only show a rating once there is one - not the 1000 every player starts at
  const hasElo =
    !eloLoading && elo?.hasIdentity !== false && (eloHistory.length > 0 || (elo?.gamesPlayed || 0) > 0);
  const currentRating = elo?.currentRating || elo?.rating || 1000;

  const { currentStreak } = stats;

  return (
    <div className="performance-stats-container">
      <StatsSection title={t('profile.summary')}>
        <div className="stats-tiles stats-tiles-summary">
          <StatTile label={t('common.totalGames')} value={stats.totalGames} />
          <StatTile label={t('common.winRate')} value={`${stats.winRate}%`} />
          <StatTile label={t('profile.record')} value={`${stats.wins}–${stats.losses}`} />
          {hasElo && <StatTile label={t('profile.eloRating')} value={currentRating} />}
        </div>
        <div className="stats-tiles stats-tiles-streaks">
          <StatTile
            label={t('profile.currentStreak')}
            value={currentStreak.count}
            unit={t(currentStreak.type === 'win' ? 'profile.streakUnitWins' : 'profile.streakUnitLosses', { count: currentStreak.count })}
            tone={currentStreak.type === 'win' ? 'good' : 'bad'}
          />
          <StatTile label={t('profile.longestWinStreak')} value={stats.longestWinStreak} />
          <StatTile label={t('profile.longestLossStreak')} value={stats.longestLossStreak} />
        </div>
      </StatsSection>

      <TrendsSection
        stats={stats}
        isWizardGame={isWizardGame}
        elo={hasElo ? { history: eloHistory, currentRating, peak: elo?.peak, floor: elo?.floor } : null}
        eloGameType={normalizedGameType}
      />

      {(stats.topOpponents.length > 0 || stats.playerCountData.length > 1) && (
        <StatsSection title={t('profile.opponents')}>
          <div className="stats-split">
            <RivalsPanel opponents={stats.topOpponents} />
            <PlayerCountPanel rows={stats.playerCountData} />
          </div>
        </StatsSection>
      )}

      <AchievementsSection
        achievements={stats.achievements}
        unlocked={stats.unlockedAchievements}
        isWizardGame={isWizardGame}
      />
    </div>
  );
};

/**
 * Game-by-game charts behind one set of tabs: score, bid accuracy and ELO.
 */
const TrendsSection = ({ stats, isWizardGame, elo, eloGameType }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [selected, setSelected] = useState('score');

  const scoreData = useMemo(
    () => markBestWorst(stats.performanceOverTime, stats.bestGame?.game, stats.worstGame?.game),
    [stats]
  );
  const bidData = useMemo(
    () => markBestWorst(
      stats.performanceOverTime.filter((d) => d.bidAccuracy !== null),
      stats.bestBidAccuracyGame?.game,
      stats.worstBidAccuracyGame?.game
    ),
    [stats]
  );

  const tabs = [
    {
      id: 'score',
      label: t('profile.scoresOption'),
      hint: t('profile.trendScoreHint'),
      data: scoreData,
      dataKey: 'score',
      average: parseFloat(stats.averageScore),
      tiles: [
        { label: t('profile.averageScore'), value: stats.averageScore },
        { label: t('profile.bestScore'), value: stats.bestGame?.score ?? 0, tone: 'good' },
        { label: t('profile.worstScore'), value: stats.worstGame?.score ?? 0, tone: 'bad' },
      ],
      tooltip: (
        <GameTooltip
          navigate={navigate}
          formatter={(value, name) => (name === 'score' ? [value, t('common.score')] : [value, name])}
        />
      ),
    },
    isWizardGame && bidData.length > 0 && {
      id: 'bidAccuracy',
      label: t('profile.bidsTab'),
      hint: t('profile.trendBidHint'),
      // Room for the widest tick, "100%"
      axisOffset: -8,
      data: bidData,
      dataKey: 'bidAccuracy',
      average: parseFloat(stats.bidAccuracy),
      domain: [0, 100],
      tickFormatter: (value) => `${value}%`,
      tiles: [
        { label: t('profile.averageAccuracy'), value: `${stats.bidAccuracy}%` },
        { label: t('profile.bestAccuracy'), value: `${stats.bestBidAccuracyGame.bidAccuracy}%`, tone: 'good' },
        { label: t('profile.worstAccuracy'), value: `${stats.worstBidAccuracyGame.bidAccuracy}%`, tone: 'bad' },
      ],
      tooltip: (
        <GameTooltip
          navigate={navigate}
          formatter={(value, name) => (name === 'bidAccuracy' ? [`${value}%`, t('profile.bidAccuracy')] : [value, name])}
        />
      ),
    },
    elo && {
      id: 'elo',
      label: t('profile.eloTab'),
      hint: t('profile.trendEloHint'),
      data: elo.history,
      dataKey: 'rating',
      domain: ['dataMin - 50', 'dataMax + 50'],
      tiles: [
        { label: t('profile.rating'), value: elo.currentRating },
        { label: t('profile.peak'), value: elo.peak || elo.currentRating, tone: 'good' },
        { label: t('profile.floor'), value: elo.floor || elo.currentRating, tone: 'bad' },
      ],
      tooltip: <EloTooltip navigate={navigate} gameType={eloGameType} />,
    },
  ].filter(Boolean);

  // Fall back to the score tab when the selected one no longer applies
  const active = tabs.find((tab) => tab.id === selected) || tabs[0];

  return (
    <StatsSection title={t('profile.trends')} subtitle={t('profile.trendsSubtitle')}>
      <div className="stats-panel">
        {tabs.length > 1 && (
          <div className="stats-tabs" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={tab.id === active.id}
                className={`stats-tab${tab.id === active.id ? ' is-active' : ''}`}
                title={tab.hint}
                onClick={() => setSelected(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="stats-tiles stats-tiles-trend">
          {active.tiles.map((tile) => (
            <StatTile key={tile.label} {...tile} />
          ))}
        </div>

        {active.data.length > 1 ? (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={active.data} margin={{ top: 8, right: 12, left: active.axisOffset ?? -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="game" stroke="var(--text)" tick={{ fill: 'var(--text)' }} />
                <YAxis
                  stroke="var(--text)"
                  tick={{ fill: 'var(--text)' }}
                  domain={active.domain}
                  tickFormatter={active.tickFormatter}
                />
                <Tooltip content={active.tooltip} wrapperStyle={{ pointerEvents: 'auto' }} />
                {active.average !== undefined && (
                  <ReferenceLine y={active.average} stroke="var(--text)" strokeDasharray="5 5" strokeWidth={2} />
                )}
                <Area type="monotone" dataKey={active.dataKey} stroke={LINE_COLOR} fill={LINE_COLOR} fillOpacity={0.2} />
                <Line
                  type="monotone"
                  dataKey={active.dataKey}
                  stroke={LINE_COLOR}
                  strokeWidth={2}
                  dot={renderTrendDot(active.dataKey)}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="stats-legend">
              <span><span className="stats-legend-dot is-best" />{t('profile.best')}</span>
              <span><span className="stats-legend-dot is-worst" />{t('profile.worst')}</span>
              {active.average !== undefined && (
                <span><span className="stats-legend-line" />{t('profile.average')}</span>
              )}
            </div>
          </>
        ) : (
          <p className="stats-empty">{t('profile.notEnoughGamesForChart')}</p>
        )}
      </div>
    </StatsSection>
  );
};

/** Heading of a panel inside a section. */
const SubsectionHeader = ({ title, subtitle }) => (
  <div className="stats-subsection-header">
    <h3>{title}</h3>
    <span>{subtitle}</span>
  </div>
);

/**
 * Most-played opponents and how often the user finished ahead of each.
 */
const RivalsPanel = ({ opponents }) => {
  const { t } = useTranslation();
  if (!opponents || opponents.length === 0) return null;

  return (
    <div className="stats-subsection">
      <SubsectionHeader title={t('profile.rivals')} subtitle={t('profile.rivalsSubtitle')} />
      <div className="stats-panel stats-list">
        {opponents.map((rival) => {
          const decided = rival.ahead + rival.behind + rival.tied;
          const pct = (value) => (decided > 0 ? (value / decided) * 100 : 0);

          return (
            <div key={rival.key} className="stats-list-row">
              <div className="rival-header">
                <Link to={`/user/${encodeURIComponent(rival.name)}`} className="rival-name">
                  {rival.name}
                </Link>
                <span className="rival-games">
                  {t('profile.rivalGames', { count: rival.games })}
                </span>
              </div>
              <div
                className="rival-bar"
                role="img"
                aria-label={t('profile.rivalRecordLabel', { ahead: rival.ahead, behind: rival.behind, name: rival.name })}
              >
                <span className="rival-bar-ahead" style={{ width: `${pct(rival.ahead)}%` }} />
                <span className="rival-bar-tied" style={{ width: `${pct(rival.tied)}%` }} />
                <span className="rival-bar-behind" style={{ width: `${pct(rival.behind)}%` }} />
              </div>
              <div className="rival-record">
                <span className="rival-ahead">{t('profile.rivalAhead', { count: rival.ahead })}</span>
                {rival.tied > 0 && <span>{t('profile.rivalTied', { count: rival.tied })}</span>}
                <span className="rival-behind">{t('profile.rivalBehind', { count: rival.behind })}</span>
                {rival.aheadRate !== null && <strong className="rival-rate">{rival.aheadRate}%</strong>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Win rate per number of players, against the fair 1-in-N share.
 */
const PlayerCountPanel = ({ rows }) => {
  const { t } = useTranslation();
  // A single table size has nothing to compare against
  if (!rows || rows.length < 2) return null;

  return (
    <div className="stats-subsection">
      <SubsectionHeader title={t('profile.byPlayerCount')} subtitle={t('profile.byPlayerCountSubtitle')} />
      <div className="stats-panel stats-list">
        {rows.map((row) => {
          const winRate = Math.round(parseFloat(row.winRate));
          const aboveShare = winRate >= row.expectedWinRate;

          return (
            <div key={row.count} className="stats-list-row">
              <div className="rival-header">
                <span className="rival-name">{t('profile.playerCountLabel', { count: row.count })}</span>
                <span className="rival-games">{t('profile.gamesCount', { count: row.games })}</span>
              </div>
              <div
                className="player-count-bar"
                role="img"
                aria-label={t('profile.playerCountBarLabel', { rate: winRate, expected: row.expectedWinRate })}
              >
                <span
                  className={`player-count-fill ${aboveShare ? 'is-above' : 'is-below'}`}
                  style={{ width: `${winRate}%` }}
                />
                <span className="player-count-expected" style={{ left: `${row.expectedWinRate}%` }} />
              </div>
              <div className="rival-record">
                <span>{t('profile.fairShare', { rate: row.expectedWinRate })}</span>
                <strong className={`rival-rate ${aboveShare ? 'rival-ahead' : 'rival-behind'}`}>
                  {t('profile.winRateValue', { rate: winRate })}
                </strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Achievements - unlocked first, then the locked ones closest to unlocking.
 */
const AchievementsSection = ({ achievements, unlocked, isWizardGame }) => {
  const { t } = useTranslation();
  const ordered = useMemo(
    () => [...achievements].sort((a, b) =>
      Number(b.unlocked) - Number(a.unlocked) || (a.unlocked ? 0 : b.progress - a.progress)
    ),
    [achievements]
  );

  return (
    <StatsSection
      title={t('profile.achievements')}
      subtitle={t('profile.achievementsUnlocked', { unlocked, total: achievements.length })}
    >
      {unlocked === 0 && (
        <div className="achievements-hint">{t('profile.keepPlayingAchievements')}</div>
      )}
      <div className="achievements-grid">
        {ordered.map((achievement) => {
          const gateKey = getAchievementGateKey(achievement);
          // Win margins outside Wizard are relative to the game's scores
          const descKey = !isWizardGame && RELATIVE_MARGIN_ACHIEVEMENTS.includes(achievement.id)
            ? `achievements.${achievement.id}DescRelative`
            : `achievements.${achievement.id}Desc`;

          return (
            <div
              key={achievement.id}
              className={`achievement-card ${achievement.unlocked ? 'is-unlocked' : 'is-locked'}`}
              title={t(descKey)}
            >
              <span className="achievement-badge" aria-hidden="true">
                {achievement.unlocked
                  ? <CircleCheck size={11} />
                  : <Lock size={10} />}
              </span>
              <div className="achievement-name">{t(`achievements.${achievement.id}`)}</div>
              <div className="achievement-description">{t(descKey)}</div>
              {!achievement.unlocked && (
                <div className="achievement-progress">
                  <div className="achievement-progress-track">
                    <div
                      className="achievement-progress-bar"
                      style={{ width: `${Math.round(achievement.progress * 100)}%` }}
                    />
                  </div>
                  <div className="achievement-progress-label">
                    {formatAchievementProgress(achievement)}{gateKey ? ` ${t(gateKey)}` : ''}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </StatsSection>
  );
};

export default PerformanceStatsEnhanced;
