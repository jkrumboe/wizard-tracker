import React, { useState, useEffect } from 'react';
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
  // Track if we're in focus mode (single player)
  const [focusMode, setFocusMode] = useState(false);
  // Force re-render when theme changes
  const [, setThemeChange] = useState(0);

  // Listen for theme changes
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          setThemeChange(prev => prev + 1); // Force re-render when theme changes
        }
      });
    });
    
    observer.observe(document.documentElement, { attributes: true });
    
    return () => {
      observer.disconnect();
    };
  }, []);
  
  // Focus on a player or show all players
  const togglePlayerFocus = (playerId) => {
    if (focusMode && selectedPlayers.length === 1 && selectedPlayers[0] === playerId) {
      // If already focused on this player, show all players
      setSelectedPlayers(playersData.map(player => player.id));
      setFocusMode(false);
    } else {
      // Focus on this player only
      setSelectedPlayers([playerId]);
      setFocusMode(true);
    }
  };

  const generatePointsProgressionData = () => {
    if (!roundData || roundData.length === 0) {
      console.log("No round data available for points progression chart");
      return { labels: [], datasets: [] };
    }
    
    // Create round labels
    const labels = roundData.map((_, index) => `${index + 1}`);
    
    // Generate datasets for each selected player
    const datasets = playersData
      .filter(player => selectedPlayers.includes(player.id))
      .map((player) => {
        // Get actual index of the player in the full playersData array (for consistent coloring)
        const originalIndex = playersData.findIndex(p => String(p.id) === String(player.id));
        
        // Collect points per round for this player
        const pointsData = roundData.map(round => {
          // Use string comparison for safe comparison regardless of type (string/number)
          const playerInRound = round.players.find(p => 
            String(p.id) === String(player.id)
          );
          
          return playerInRound ? playerInRound.totalScore || 0 : null;
        });

        // Enhance the visual for focused player
        const isFocused = focusMode && selectedPlayers.length === 1 && String(selectedPlayers[0]) === String(player.id);
        
        return {
          label: player.name,
          data: pointsData,
          borderColor: getBorderColorForIndex(originalIndex),
          backgroundColor: getColorForIndex(originalIndex),
          tension: 0.3,
          pointRadius: isFocused ? 6 : 4,
          borderWidth: isFocused ? 3 : 2,
          fill: isFocused ? 0.1 : false
        };
      });

    return { labels, datasets };
  };

  const generateBidAccuracyData = () => {
    // Get selected players with their original indices
    const selectedPlayersWithIndex = playersData
      .map((player, index) => ({ player, index }))
      .filter(item => selectedPlayers.includes(item.player.id));
    
    // Create player name labels
    const labels = selectedPlayersWithIndex.map(item => item.player.name);
    
    // Calculate bid accuracy for each player
    const bidAccuracyData = selectedPlayersWithIndex.map(item => {
      const player = item.player;
      const correctBids = player.correctBids || 0;
      const totalRounds = player.roundsPlayed || 0;
      return totalRounds > 0 ? (correctBids / totalRounds) * 100 : 0;
    });

    // Get original indices for consistent colors
    const originalIndices = selectedPlayersWithIndex.map(item => item.index);

    const datasets = [{
      label: 'Bid Accuracy (%)',
      data: bidAccuracyData,
      backgroundColor: originalIndices.map(index => getColorForIndex(index)),
      borderColor: originalIndices.map(index => getBorderColorForIndex(index)),
      borderWidth: focusMode ? 2 : 1
    }];

    return { labels, datasets };
  };

  const generateBidDistributionData = () => {
    // Get selected players with their original indices
    const selectedPlayersWithIndex = playersData
      .map((player, index) => ({ player, index }))
      .filter(item => selectedPlayers.includes(item.player.id));
    
    // Create player name labels
    const labels = selectedPlayersWithIndex.map(item => item.player.name);
    
    const correctBidsData = selectedPlayersWithIndex.map(item => item.player.correctBids || 0);
    const overbidsData = selectedPlayersWithIndex.map(item => item.player.overBids || 0);
    const underbidsData = selectedPlayersWithIndex.map(item => item.player.underBids || 0);
    
    const borderWidth = focusMode ? 2 : 1;

    const datasets = [
      {
        label: 'Correct Bids',
        data: correctBidsData,
        backgroundColor: 'rgba(52, 211, 153, 0.7)', // Green
        borderColor: 'rgb(34, 197, 94)',
        borderWidth
      },
      {
        label: 'Overbids',
        data: overbidsData,
        backgroundColor: 'rgba(249, 115, 22, 0.7)', // Orange
        borderColor: 'rgb(234, 88, 12)',
        borderWidth
      },
      {
        label: 'Underbids',
        data: underbidsData,
        backgroundColor: 'rgba(212, 54, 54, 0.7)', // Red
        borderColor: 'rgb(243, 10, 10)',
        borderWidth
      }
    ];

    return { labels, datasets };
  };

  const generatePointsPerRoundData = () => {
    if (!roundData || roundData.length === 0) {
      console.log("No round data available for points per round chart");
      return { labels: [], datasets: [] };
    }
    
    // Create round labels
    const labels = roundData.map((_, index) => `Round ${index + 1}`);
    
    // In focus mode, show only the focused player
    // Otherwise, show all selected players
    const playersToShow = focusMode ? 
      selectedPlayers.slice(0, 1) : 
      selectedPlayers;
      
    if (playersToShow.length === 0) {
      return { labels: [], datasets: [] };
    }
    
    // Generate a dataset for each player to show
    const datasets = playersToShow.map(playerId => {
      const player = playersData.find(p => String(p.id) === String(playerId));
      if (!player) {
        console.log(`Player with ID ${playerId} not found in playersData`);
        return null;
      }
      
      // Get original index for consistent colors
      const originalIndex = playersData.findIndex(p => String(p.id) === String(player.id));
      
      // Collect round scores for this player
      const roundScores = roundData.map(round => {
        // Use string comparison for safe ID matching
        const playerInRound = round.players.find(p => String(p.id) === String(player.id));
        const score = playerInRound && playerInRound.score !== undefined ? playerInRound.score : null;
        return score;
      });

      return {
        label: `${player.name}'s Points Per Round`,
        data: roundScores,
        backgroundColor: getColorForIndex(originalIndex),
        borderColor: getBorderColorForIndex(originalIndex),
        borderWidth: focusMode ? 2 : 1
      };
    }).filter(Boolean); // Filter out null datasets

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
    // Determine if we're in dark mode by checking the HTML element's data-theme attribute
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // Use direct color values based on theme
    const textColor = isDarkMode ? '#e5e7eb' : '#1f2937';
    const borderColor = isDarkMode ? '#4b5563' : '#d1d5db';
    const gridColor = isDarkMode ? 'rgba(202, 214, 231, 0.2)' : 'rgba(144, 147, 151, 0.5)';
    const tooltipBackgroundColor = isDarkMode ? '#374151' : '#ffffff';
    
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: chartType === CHART_TYPES.BID_DISTRIBUTION, // Show legend only for bid distribution
          position: 'top',
          align: 'center',
          labels: {
            color: textColor,
            font: {
              size: 12,
              weight: '500'
            },
            padding: 20,
            usePointStyle: true,
            pointStyle: 'rect'
          }
        },
        tooltip: {
          backgroundColor: tooltipBackgroundColor,
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: borderColor,
          borderWidth: 1,
          padding: 10,
          boxPadding: 5,
          usePointStyle: true
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          border: {
            display: true,
            color: borderColor,
            width: 2
          },
          grid: {
            color: (context) => {
              if (context.tick && context.tick.value === 0) {
                // Make the zero line more prominent
                return isDarkMode ? '#d1d5db' : '#4b5563';
              }
              return gridColor;
            },
            lineWidth: (context) => {
              if (context.tick && context.tick.value === 0) {
                return 1.5; // Thicker zero line
              }
              return 1.2;
            },
            drawBorder: true, // Don't draw border around the entire chart
            drawTicks: true,
            z: 1 // Ensure grid lines are drawn above the datasets
          },
          ticks: {
            color: textColor,
            font: {
              weight: '500',
              size: 12
            },
            major: {
              enabled: true
            }
          }
        },
        x: {
          border: {
            display: false
          },
          grid: {
            display: true,
            color: (context) => {
              // Highlight the zero value on the x-axis if needed
              if (context.tick && context.tick.value === 0) {
                return isDarkMode ? '#4b5563' : '#d1d5db';
              }
              return gridColor;
            },
            lineWidth: (context) => {
              if (context.tick && context.tick.value === 0) {
                return 2; // Thicker zero line
              }
              return 1.2;
            },
            drawBorder: true,
            drawTicks: true
          },
          ticks: {
            color: textColor,
            font: {
              weight: '500',
              size: 12
            }
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
              color: textColor,
              font: { size: 18, weight: 'bold' }
            }
          },
          scales: {
            ...baseOptions.scales,
            y: {
              ...baseOptions.scales.y,
              title: {
                ...baseOptions.scales.y.title,
                text: 'Total Points'
              }
            },
            x: {
              ...baseOptions.scales.x,
              title: {
                ...baseOptions.scales.x.title,
                text: 'Round'
              }
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
              color: textColor,
              font: { size: 18, weight: 'bold' }
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
                color: textColor,
                font: {
                  weight: 'bold',
                  size: 14
                }
              }
            },
            x: {
              ...baseOptions.scales.x,
              title: {
                ...baseOptions.scales.x.title,
                text: 'Players'
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
              color: textColor,
              font: { size: 18, weight: 'bold' }
            },
            legend: {
              ...baseOptions.plugins.legend,
              labels: {
                ...baseOptions.plugins.legend.labels,
                padding: 5 // Reduce padding to bring legend closer to title
              }
            }
          },
          scales: {
            ...baseOptions.scales,
            y: {
              ...baseOptions.scales.y,
              title: {
                display: true,
                text: 'Number of Bids',
                color: textColor,
                font: {
                  weight: 'bold',
                  size: 14
                }
              },
              grid: {
                ...baseOptions.scales.y.grid,
                display: true
              }
            },
            x: {
              ...baseOptions.scales.x,
              title: {
                ...baseOptions.scales.x.title,
                text: 'Players'
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
              color: textColor,
              font: { size: 18, weight: 'bold' }
            }
          },
          scales: {
            ...baseOptions.scales,
            y: {
              ...baseOptions.scales.y,
              grid: {
                ...baseOptions.scales.y.grid,
                display: true
              }
            },
            x: {
              ...baseOptions.scales.x,
              title: {
                ...baseOptions.scales.x.title,
                text: 'Round'
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
        <div className="chart-wrapper chart-shadow no-bottom-border">
            <div className="zero-line-indicator"></div>
            {renderChart()}</div>

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
            </select>
        </div>

        <div className="player-toggles">
            <div className="player-toggle-header">
                <label>
                    {focusMode ? 
                        <span className="focus-indicator">Focused on Player</span> : 
                        'Click a player to focus on their data'}
                </label>
                {focusMode && (
                    <button 
                        className="show-all-btn"
                        onClick={() => {
                            setSelectedPlayers(playersData.map(player => player.id));
                            setFocusMode(false);
                        }}
                    >
                        Show All Players
                    </button>
                )}
            </div>
            <div className="player-toggle-buttons">
            {playersData.map((player, index) => (
                <button
                key={player.id}
                className={`player-toggle-btn ${selectedPlayers.includes(player.id) ? 'active' : ''} ${focusMode && selectedPlayers[0] === player.id ? 'focused' : ''}`}
                style={{ 
                    borderColor: getBorderColorForIndex(index),
                    backgroundColor: selectedPlayers.includes(player.id) 
                    ? getColorForIndex(index) 
                    : 'transparent'
                }}
                onClick={() => togglePlayerFocus(player.id)}
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
