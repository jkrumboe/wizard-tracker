import React, { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend
);

const CHART_TYPES = {
  POINTS_PROGRESSION: 'pointsProgression',
  BID_ACCURACY: 'bidAccuracy',
  BID_DISTRIBUTION: 'bidDistribution',
  POINTS_PER_ROUND: 'pointsPerRound'
};

/*
 * Categorical series colours, assigned to players in a fixed order. The order is
 * what keeps neighbouring series distinguishable for colour-blind readers, and the
 * dark steps are tuned for dark surfaces. Validated with the dataviz palette
 * checker against the app's light (#ffffff) and dark (#0b1120) surfaces.
 */
const SERIES_COLORS = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
};

// Bid outcomes are states, not identities, so they use status colours
const BID_OUTCOME_COLORS = {
  correct: '#0ca30c',
  over: '#ec835a',
  under: '#d03b3b'
};

const DIMMED_ALPHA = 0.18;

// Diverging pair for the points-per-round grid: gains blue, losses red, zero neutral
const DIVERGING_COLORS = {
  light: { positive: '#2a78d6', negative: '#d03b3b' },
  dark: { positive: '#3987e5', negative: '#e66767' }
};

const isDarkTheme = () => document.documentElement.getAttribute('data-theme') === 'dark';

const getSeriesColor = (index) => {
  const colors = isDarkTheme() ? SERIES_COLORS.dark : SERIES_COLORS.light;
  return colors[index % colors.length];
};

const withAlpha = (hex, alpha) => `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;

const readCssVar = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

// First non-transparent background behind the chart, used for the ring around points
const findSurfaceColor = (element) => {
  let node = element;
  while (node && node !== document.documentElement) {
    const bg = getComputedStyle(node).backgroundColor;
    if (bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) return bg;
    node = node.parentElement;
  }
  return readCssVar('--bg-color', '#ffffff');
};

// Vertical guide line at the hovered round
const crosshairPlugin = {
  id: 'crosshair',
  beforeDatasetsDraw(chart, _args, options) {
    const active = chart.tooltip?.getActiveElements?.() || [];
    if (!active.length) return;
    const { ctx, chartArea } = chart;
    const x = active[0].element.x;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = options.color;
    ctx.stroke();
    ctx.restore();
  }
};

const StatsChart = ({ playersData, roundData, supportsBids = true }) => {
  const { t } = useTranslation();
  const [chartType, setChartType] = useState(CHART_TYPES.POINTS_PROGRESSION);
  // Player highlighted via the legend; everyone else is dimmed, not hidden
  const [focusedId, setFocusedId] = useState(null);
  const [surfaceColor, setSurfaceColor] = useState(null);
  const [themeVersion, setThemeChange] = useState(0);
  const wrapperRef = useRef(null);

  // Re-render with the right palette when the theme changes
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((m) => m.attributeName === 'data-theme')) {
        setThemeChange((prev) => prev + 1);
      }
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (wrapperRef.current) setSurfaceColor(findSurfaceColor(wrapperRef.current));
  }, [themeVersion]);

  const isFocused = (playerId) => focusedId !== null && String(focusedId) === String(playerId);
  const isDimmed = (playerId) => focusedId !== null && !isFocused(playerId);

  const toggleFocus = (playerId) => {
    setFocusedId((current) => (current !== null && String(current) === String(playerId) ? null : playerId));
  };

  const playerColor = (player, index) => {
    const color = getSeriesColor(index);
    return isDimmed(player.id) ? withAlpha(color, DIMMED_ALPHA) : color;
  };

  const findInRound = (round, playerId) =>
    round?.players.find((p) => String(p.id) === String(playerId));

  const roundLabels = () => (roundData || []).map((_, index) => `${index + 1}`);

  const generatePointsProgressionData = () => {
    if (!roundData || roundData.length === 0) return { labels: [], datasets: [] };

    const lastIndex = roundData.length - 1;
    const datasets = playersData.map((player, index) => {
      const color = playerColor(player, index);
      return {
        label: player.name,
        data: roundData.map((round) => {
          const entry = findInRound(round, player.id);
          return entry ? entry.totalScore || 0 : null;
        }),
        borderColor: color,
        backgroundColor: color,
        borderWidth: isFocused(player.id) ? 3 : 2,
        borderJoinStyle: 'round',
        borderCapStyle: 'round',
        tension: 0,
        // Only mark where each line ends; other points appear on hover
        pointRadius: (ctx) => (ctx.dataIndex === lastIndex ? 4 : 0),
        pointHoverRadius: 5,
        pointBorderWidth: 2,
        pointHoverBorderWidth: 2,
        pointBorderColor: surfaceColor || 'transparent',
        pointHoverBorderColor: surfaceColor || 'transparent',
        order: isFocused(player.id) ? 0 : 1
      };
    });

    return { labels: roundLabels(), datasets };
  };

  // Points a player scored in each round (null where they have no entry)
  const getRoundPoints = (player) => (roundData || []).map((round, roundIndex) => {
    const entry = findInRound(round, player.id);
    if (!entry) return null;
    if (entry.score !== undefined) return entry.score;
    // Table games only carry running totals - the round's points are the change
    if (typeof entry.totalScore !== 'number') return null;
    const previousTotal = roundIndex > 0 ? findInRound(roundData[roundIndex - 1], player.id)?.totalScore || 0 : 0;
    return entry.totalScore - previousTotal;
  });

  const generateBidAccuracyData = () => {
    const colors = playersData.map((player, index) => playerColor(player, index));
    return {
      labels: playersData.map((player) => player.name),
      datasets: [{
        label: t('statsChart.bidAccuracy'),
        data: playersData.map((player) => {
          const rounds = player.roundsPlayed || 0;
          return rounds > 0 ? ((player.correctBids || 0) / rounds) * 100 : 0;
        }),
        backgroundColor: colors,
        hoverBackgroundColor: colors
      }]
    };
  };

  const generateBidDistributionData = () => {
    const outcomeColors = (hex) => playersData.map((player) => (isDimmed(player.id) ? withAlpha(hex, DIMMED_ALPHA) : hex));
    const outcome = (label, key, hex) => ({
      label,
      data: playersData.map((player) => player[key] || 0),
      backgroundColor: outcomeColors(hex),
      hoverBackgroundColor: outcomeColors(hex)
    });
    return {
      labels: playersData.map((player) => player.name),
      datasets: [
        outcome(t('statsChart.correctBids'), 'correctBids', BID_OUTCOME_COLORS.correct),
        outcome(t('statsChart.overbids'), 'overBids', BID_OUTCOME_COLORS.over),
        outcome(t('statsChart.underbids'), 'underBids', BID_OUTCOME_COLORS.under)
      ]
    };
  };

  const getChartData = () => {
    switch (chartType) {
      case CHART_TYPES.POINTS_PROGRESSION:
        return generatePointsProgressionData();
      case CHART_TYPES.BID_ACCURACY:
        return generateBidAccuracyData();
      case CHART_TYPES.BID_DISTRIBUTION:
        return generateBidDistributionData();
      default:
        return { labels: [], datasets: [] };
    }
  };

  const getChartOptions = () => {
    const textColor = readCssVar('--text', '#0f172a');
    const mutedColor = readCssVar('--text-muted', '#64748b');
    const gridColor = readCssVar('--border', '#d9e0ea');
    const baselineColor = withAlpha(isDarkTheme() ? '#94a3b8' : '#64748b', 0.6);
    const tooltipBg = readCssVar('--card-bg', '#ffffff');

    const isRoundChart = chartType === CHART_TYPES.POINTS_PROGRESSION;
    const isPercent = chartType === CHART_TYPES.BID_ACCURACY;
    const tickFont = { size: 11, weight: '500' };

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      layout: { padding: { top: 8, right: 8 } },
      interaction: isRoundChart
        ? { mode: 'index', intersect: false }
        : { mode: 'nearest', intersect: true },
      datasets: {
        bar: {
          maxBarThickness: 24,
          categoryPercentage: 0.7,
          barPercentage: 0.9,
          borderRadius: 4,
          borderSkipped: 'start',
          borderWidth: 0
        }
      },
      plugins: {
        legend: {
          // Players have their own legend below the chart; only bid outcomes need this one
          display: chartType === CHART_TYPES.BID_DISTRIBUTION,
          position: 'top',
          align: 'start',
          labels: {
            color: textColor,
            font: { size: 12, weight: '500' },
            boxWidth: 8,
            boxHeight: 8,
            padding: 12,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: gridColor,
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          // Highest value first so the tooltip reads like the standings
          itemSort: (a, b) => (b.parsed.y ?? 0) - (a.parsed.y ?? 0),
          callbacks: {
            title: (items) => (isRoundChart && items.length
              ? t('statsChart.roundNumber', { number: items[0].label })
              : items[0]?.label),
            label: (item) => {
              const value = isPercent ? `${Math.round(item.parsed.y)}%` : item.parsed.y;
              const name = chartType === CHART_TYPES.BID_ACCURACY ? item.label : item.dataset.label;
              return ` ${name}: ${value}`;
            },
            labelPointStyle: () => ({ pointStyle: 'circle', rotation: 0 }),
            labelColor: (item) => {
              const bg = Array.isArray(item.dataset.backgroundColor)
                ? item.dataset.backgroundColor[item.dataIndex]
                : item.dataset.borderColor || item.dataset.backgroundColor;
              return { backgroundColor: bg, borderColor: bg, borderWidth: 0 };
            }
          }
        },
        crosshair: { color: gridColor }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: isPercent ? 100 : undefined,
          border: { display: false },
          grid: {
            color: (ctx) => (ctx.tick?.value === 0 ? baselineColor : gridColor),
            lineWidth: 1,
            drawTicks: false
          },
          ticks: {
            color: mutedColor,
            font: tickFont,
            padding: 8,
            maxTicksLimit: 6,
            precision: 0,
            callback: isPercent ? (value) => `${value}%` : undefined
          }
        },
        x: {
          border: { display: false },
          grid: { display: false },
          ticks: {
            color: mutedColor,
            font: tickFont,
            maxRotation: 0,
            autoSkip: true,
            autoSkipPadding: 8
          },
          title: {
            display: isRoundChart,
            text: t('statsChart.round'),
            color: mutedColor,
            font: { size: 11, weight: '500' },
            padding: { top: 4 }
          }
        }
      }
    };
  };

  const renderChart = () => {
    const data = getChartData();
    const options = getChartOptions();
    if (chartType === CHART_TYPES.POINTS_PROGRESSION) {
      return <Line data={data} options={options} plugins={[crosshairPlugin]} />;
    }
    return <Bar data={data} options={options} />;
  };

  /*
   * Points per round as a players x rounds grid. Grouped bars become unreadable
   * past a few players/rounds; a grid keeps every value legible and the tint
   * (blue gain, red loss, stronger = bigger swing) shows the pattern at a glance.
   */
  const renderRoundHeatmap = () => {
    if (!roundData || roundData.length === 0) return null;

    const rows = playersData.map((player, index) => ({ player, index, points: getRoundPoints(player) }));
    const maxAbs = Math.max(1, ...rows.flatMap((row) => row.points.map((value) => Math.abs(value || 0))));
    const diverging = isDarkTheme() ? DIVERGING_COLORS.dark : DIVERGING_COLORS.light;

    const cellStyle = (value) => {
      if (value === null || value === 0) return undefined;
      const hex = value > 0 ? diverging.positive : diverging.negative;
      return { backgroundColor: withAlpha(hex, 0.12 + 0.5 * (Math.abs(value) / maxAbs)) };
    };
    // Pinned name column: paint the 2px cell gaps on either side so scrolled cells
    // never peek out beside it
    const stickyStyle = surfaceColor
      ? { backgroundColor: surfaceColor, boxShadow: `-2px 0 0 ${surfaceColor}, 2px 0 0 ${surfaceColor}` }
      : undefined;
    const formatPoints = (value) => {
      if (value === null) return '–';
      return value > 0 ? `+${value}` : `${value}`;
    };

    return (
      <div className="round-heatmap-scroll">
        <table className="round-heatmap">
          <thead>
            <tr>
              <th scope="col" className="round-heatmap-corner" style={stickyStyle}>
                <span className="round-heatmap-axis">{t('statsChart.round')}</span>
              </th>
              {roundData.map((_, roundIndex) => (
                <th key={roundIndex} scope="col">{roundIndex + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ player, index, points }) => (
              <tr
                key={player.id}
                className={`${isFocused(player.id) ? 'focused' : ''} ${isDimmed(player.id) ? 'dimmed' : ''}`}
              >
                <th scope="row" className="round-heatmap-player" style={stickyStyle}>
                  <button type="button" onClick={() => toggleFocus(player.id)} aria-pressed={isFocused(player.id)}>
                    <span className="chart-legend-swatch" style={{ backgroundColor: getSeriesColor(index) }} />
                    <span className="chart-legend-name">{player.name}</span>
                  </button>
                </th>
                {points.map((value, roundIndex) => (
                  <td
                    key={roundIndex}
                    style={cellStyle(value)}
                    title={`${player.name} · ${t('statsChart.roundNumber', { number: roundIndex + 1 })}: ${formatPoints(value)}`}
                  >
                    {formatPoints(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const isHeatmap = chartType === CHART_TYPES.POINTS_PER_ROUND;

  return (
    <div className="stats-chart-container" ref={wrapperRef}>
      <div className="chart-toolbar">
        <select
          value={chartType}
          onChange={(e) => setChartType(e.target.value)}
          className="chart-select"
        >
          <option value={CHART_TYPES.POINTS_PROGRESSION}>{t('statsChart.pointsProgression')}</option>
          <option value={CHART_TYPES.POINTS_PER_ROUND}>{t('statsChart.pointsPerRound')}</option>
          {supportsBids && (
            <>
              <option value={CHART_TYPES.BID_ACCURACY}>{t('statsChart.bidAccuracy')}</option>
              <option value={CHART_TYPES.BID_DISTRIBUTION}>{t('statsChart.bidDistribution')}</option>
            </>
          )}
        </select>
        {focusedId !== null && (
          <button type="button" className="show-all-btn" onClick={() => setFocusedId(null)}>
            {t('statsChart.showAllPlayers')}
          </button>
        )}
      </div>

      {isHeatmap ? renderRoundHeatmap() : (
        <div className="chart-wrapper">
          {renderChart()}
        </div>
      )}

      {/* The grid names players in its own rows, so it needs no separate legend */}
      {!isHeatmap && (
        <div className="chart-legend">
          {playersData.map((player, index) => (
            <button
              type="button"
              key={player.id}
              className={`chart-legend-item ${isFocused(player.id) ? 'focused' : ''} ${isDimmed(player.id) ? 'dimmed' : ''}`}
              aria-pressed={isFocused(player.id)}
              onClick={() => toggleFocus(player.id)}
            >
              <span className="chart-legend-swatch" style={{ backgroundColor: getSeriesColor(index) }} />
              <span className="chart-legend-name">{player.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default StatsChart;
