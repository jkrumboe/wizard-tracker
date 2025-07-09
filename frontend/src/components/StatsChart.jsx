import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const CHART_TYPES = {
  POINTS_PROGRESSION: 'pointsProgression',
  BID_ACCURACY: 'bidAccuracy',
  BID_DISTRIBUTION: 'bidDistribution',
  POINTS_PER_ROUND: 'pointsPerRound'
};

// Chart colors with transparency
const chartColors = {
  blue: 'rgba(96, 165, 250, 0.7)',
  green: 'rgba(52, 211, 153, 0.7)',
  yellow: 'rgba(251, 191, 36, 0.7)',
  red: 'rgba(248, 113, 113, 0.7)',
  purple: 'rgba(167, 139, 250, 0.7)',
  orange: 'rgba(249, 115, 22, 0.7)',
  cyan: 'rgba(6, 182, 212, 0.7)',
  pink: 'rgba(236, 72, 153, 0.7)'
};

const chartColorsBorders = {
  blue: 'rgb(53, 99, 233)',
  green: 'rgb(34, 197, 94)',
  yellow: 'rgb(234, 179, 8)',
  red: 'rgb(239, 68, 68)',
  purple: 'rgb(139, 92, 246)',
  orange: 'rgb(249, 115, 22)',
  cyan: 'rgb(8, 145, 178)',
  pink: 'rgb(219, 39, 119)'
};

const getColorForIndex = (index) => {
  const colors = Object.values(chartColors);
  return colors[index % colors.length];
};

const getBorderColorForIndex = (index) => {
  const colors = Object.values(chartColorsBorders);
  return colors[index % colors.length];
};

const StatsChart = ({ playersData, roundData }) => {
  const [chartType, setChartType] = useState(CHART_TYPES.POINTS_PROGRESSION);
  const [selectedPlayers, setSelectedPlayers] = useState(
    playersData.map(player => player.id)
  );

  // Toggle player visibility in chart
  const togglePlayerVisibility = (playerId) => {
    setSelectedPlayers(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId);
      } else {
        return [...prev, playerId];
      }
    });
  };

  const generatePointsProgressionData = () => {
    // Create round labels
    const labels = roundData.map((_, index) => `Round ${index + 1}`);
    
    // Generate datasets for each selected player
    const datasets = playersData
      .filter(player => selectedPlayers.includes(player.id))
      .map((player, index) => {
        // Collect points per round for this player
        const pointsData = roundData.map(round => {
          const playerInRound = round.players.find(p => p.id === player.id);
          return playerInRound ? playerInRound.totalScore || 0 : null;
        });

        return {
          label: player.name,
          data: pointsData,
          borderColor: getBorderColorForIndex(index),
          backgroundColor: getColorForIndex(index),
          tension: 0.3,
          pointRadius: 4,
          fill: false
        };
      });

    return { labels, datasets };
  };

  const generateBidAccuracyData = () => {
    // Create player name labels
    const labels = playersData
      .filter(player => selectedPlayers.includes(player.id))
      .map(player => player.name);
    
    // Calculate bid accuracy for each player
    const bidAccuracyData = playersData
      .filter(player => selectedPlayers.includes(player.id))
      .map(player => {
        const correctBids = player.correctBids || 0;
        const totalRounds = player.roundsPlayed || 0;
        return totalRounds > 0 ? (correctBids / totalRounds) * 100 : 0;
      });

    const datasets = [{
      label: 'Bid Accuracy (%)',
      data: bidAccuracyData,
      backgroundColor: labels.map((_, index) => getColorForIndex(index)),
      borderColor: labels.map((_, index) => getBorderColorForIndex(index)),
      borderWidth: 1
    }];

    return { labels, datasets };
  };

  const generateBidDistributionData = () => {
    // Only show for selected players
    const filteredPlayers = playersData.filter(player => selectedPlayers.includes(player.id));
    
    // Create player name labels
    const labels = filteredPlayers.map(player => player.name);
    
    const correctBidsData = filteredPlayers.map(player => player.correctBids || 0);
    const overbidsData = filteredPlayers.map(player => player.overBids || 0);
    const underbidsData = filteredPlayers.map(player => player.underBids || 0);

    const datasets = [
      {
        label: 'Correct Bids',
        data: correctBidsData,
        backgroundColor: 'rgba(52, 211, 153, 0.7)', // Green
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1
      },
      {
        label: 'Overbids',
        data: overbidsData,
        backgroundColor: 'rgba(249, 115, 22, 0.7)', // Orange
        borderColor: 'rgb(234, 88, 12)',
        borderWidth: 1
      },
      {
        label: 'Underbids',
        data: underbidsData,
        backgroundColor: 'rgba(96, 165, 250, 0.7)', // Blue
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1
      }
    ];

    return { labels, datasets };
  };

  const generatePointsPerRoundData = () => {
    // Only show for one selected player or the first player if multiple are selected
    const playerId = selectedPlayers.length > 0 ? selectedPlayers[0] : null;
    if (!playerId) return { labels: [], datasets: [] };

    const player = playersData.find(p => p.id === playerId);
    if (!player) return { labels: [], datasets: [] };

    // Create round labels
    const labels = roundData.map((_, index) => `Round ${index + 1}`);
    
    // Collect round scores for this player
    const roundScores = roundData.map(round => {
      const playerInRound = round.players.find(p => p.id === player.id);
      return playerInRound && playerInRound.score !== undefined ? playerInRound.score : null;
    });

    const datasets = [{
      label: `${player.name}'s Points Per Round`,
      data: roundScores,
      backgroundColor: chartColors.blue,
      borderColor: chartColorsBorders.blue,
      borderWidth: 1
    }];

    return { labels, datasets };
  };

  // Generate chart data based on selected chart type
  const getChartData = () => {
    switch (chartType) {
      case CHART_TYPES.POINTS_PROGRESSION:
        return generatePointsProgressionData();
      case CHART_TYPES.BID_ACCURACY:
        return generateBidAccuracyData();
      case CHART_TYPES.BID_DISTRIBUTION:
        return generateBidDistributionData();
      case CHART_TYPES.POINTS_PER_ROUND:
        return generatePointsPerRoundData();
      default:
        return { labels: [], datasets: [] };
    }
  };

  // Chart options
  const getChartOptions = () => {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            boxWidth: 10,
            color: 'var(--text-color)'
          }
        },
        tooltip: {
          backgroundColor: 'var(--card-background)',
          titleColor: 'var(--text-color)',
          bodyColor: 'var(--text-color)',
          borderColor: 'var(--border-color)',
          borderWidth: 1,
          padding: 10,
          boxPadding: 5,
          usePointStyle: true
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'var(--border-light)',
            drawBorder: false
          },
          ticks: {
            color: 'var(--text-color)'
          }
        },
        x: {
          grid: {
            display: false,
            drawBorder: false
          },
          ticks: {
            color: 'var(--text-color)'
          }
        }
      }
    };

    // Add chart-specific options
    switch (chartType) {
      case CHART_TYPES.POINTS_PROGRESSION:
        return {
          ...baseOptions,
          plugins: {
            ...baseOptions.plugins,
            title: {
              display: true,
              text: 'Points Progression',
              color: 'var(--text-color)',
              font: { size: 16 }
            }
          }
        };
      case CHART_TYPES.BID_ACCURACY:
        return {
          ...baseOptions,
          plugins: {
            ...baseOptions.plugins,
            title: {
              display: true,
              text: 'Bid Accuracy',
              color: 'var(--text-color)',
              font: { size: 16 }
            }
          },
          scales: {
            ...baseOptions.scales,
            y: {
              ...baseOptions.scales.y,
              max: 100,
              title: {
                display: true,
                text: 'Accuracy (%)',
                color: 'var(--text-color)'
              }
            }
          }
        };
      case CHART_TYPES.BID_DISTRIBUTION:
        return {
          ...baseOptions,
          plugins: {
            ...baseOptions.plugins,
            title: {
              display: true,
              text: 'Bid Distribution',
              color: 'var(--text-color)',
              font: { size: 16 }
            }
          },
          scales: {
            ...baseOptions.scales,
            y: {
              ...baseOptions.scales.y,
              title: {
                display: true,
                text: 'Number of Bids',
                color: 'var(--text-color)'
              }
            }
          }
        };
      case CHART_TYPES.POINTS_PER_ROUND:
        return {
          ...baseOptions,
          plugins: {
            ...baseOptions.plugins,
            title: {
              display: true,
              text: 'Points Per Round',
              color: 'var(--text-color)',
              font: { size: 16 }
            }
          },
          scales: {
            ...baseOptions.scales,
            y: {
              ...baseOptions.scales.y,
              title: {
                display: true,
                text: 'Points',
                color: 'var(--text-color)'
              }
            }
          }
        };
      default:
        return baseOptions;
    }
  };

  // Determine which chart component to use
  const renderChart = () => {
    const chartData = getChartData();
    const chartOptions = getChartOptions();

    switch (chartType) {
      case CHART_TYPES.POINTS_PROGRESSION:
        return <Line data={chartData} options={chartOptions} />;
      case CHART_TYPES.BID_ACCURACY:
        return <Bar data={chartData} options={chartOptions} />;
      case CHART_TYPES.BID_DISTRIBUTION:
        return <Bar data={chartData} options={chartOptions} />;
      case CHART_TYPES.POINTS_PER_ROUND:
        return <Bar data={chartData} options={chartOptions} />;
      default:
        return null;
    }
  };

    return (
    <div className="stats-chart-container">
        <div className="chart-wrapper">
            {renderChart()}
        </div>

        <div className="chart-controls">
        <div className="chart-type-selector">
            <label>Chart Type:</label>
            <select 
            value={chartType} 
            onChange={(e) => setChartType(e.target.value)}
            className="chart-select"
            >
            <option value={CHART_TYPES.POINTS_PROGRESSION}>Points Progression</option>
            <option value={CHART_TYPES.BID_ACCURACY}>Bid Accuracy</option>
            <option value={CHART_TYPES.BID_DISTRIBUTION}>Bid Distribution</option>
            <option value={CHART_TYPES.POINTS_PER_ROUND}>Points Per Round</option>
            </select>
        </div>

        <div className="player-toggles">
            <label>Show Players:</label>
            <div className="player-toggle-buttons">
            {playersData.map((player, index) => (
                <button
                key={player.id}
                className={`player-toggle-btn ${selectedPlayers.includes(player.id) ? 'active' : ''}`}
                style={{ 
                    borderColor: getBorderColorForIndex(index),
                    backgroundColor: selectedPlayers.includes(player.id) 
                    ? getColorForIndex(index) 
                    : 'transparent'
                }}
                onClick={() => togglePlayerVisibility(player.id)}
                >
                {player.name}
                </button>
            ))}
            </div>
        </div>
        </div>
    </div>
  );
};

export default StatsChart;
