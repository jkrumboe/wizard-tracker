import { useMemo, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter, ComposedChart, ReferenceLine } from 'recharts';
import { CircleSlash2, Trophy, TrendingDown, Target } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import "@/styles/pages/performancestats.css";

const COLORS = ['#1DBF73', '#4F46E5', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

const PerformanceStatsEnhanced = ({ games, currentPlayer, isWizardGame = true }) => {
  // Calculate comprehensive statistics from games
  const stats = useMemo(() => {
    if (!games || games.length === 0) {
      return null;
    }

    // Helper function to check if a player matches the current user
    // Includes matching by identity names (linked guest identities)
    const isCurrentPlayer = (p) => {
      if (!p) return false;
      
      // Direct ID matches
      if (p.userId === currentPlayer.id) return true;
      if (p.identityId === currentPlayer.identityId) return true;
      if (p.id === currentPlayer.id) return true;
      
      // Username match
      if (p.username && currentPlayer.username && 
          p.username.toLowerCase() === currentPlayer.username.toLowerCase()) return true;
      
      // Name match against current player name/username
      if (p.name && currentPlayer.name && 
          p.name.toLowerCase() === currentPlayer.name.toLowerCase()) return true;
      if (p.name && currentPlayer.username && 
          p.name.toLowerCase() === currentPlayer.username.toLowerCase()) return true;
      
      // Name match against linked identities (e.g., "Feemke" matches identity "feemi")
      // Identities can be strings (from API) or objects with displayName/name properties
      if (p.name && currentPlayer.identities && Array.isArray(currentPlayer.identities)) {
        const playerNameLower = p.name.toLowerCase();
        if (currentPlayer.identities.some(identity => {
          const identityName = typeof identity === 'string' ? identity : (identity.displayName || identity.name);
          return identityName && identityName.toLowerCase() === playerNameLower;
        })) {
          return true;
        }
      }
      
      return false;
    };

    let totalGames = 0;
    let wins = 0;
    let losses = 0;
    let totalScore = 0;
    let highestScore = -Infinity;
    let lowestScore = Infinity;
    let totalRounds = 0;
    const performanceData = [];
    const winLossData = [];
    const headToHeadStats = {};
    const performanceByPlayerCount = {};
    let perfectBidsCount = 0;
    let totalBids = 0;
    let correctBids = 0;
    let comebackWins = 0;
    let dominantWins = 0;
    let currentStreakType = null;
    let currentStreakCount = 0;
    let longestWinStreak = 0;
    let longestLossStreak = 0;
    let tempWinStreak = 0;
    let tempLossStreak = 0;
    let bestGameScore = -Infinity;
    let worstGameScore = Infinity;
    let bestGameData = null;
    let worstGameData = null;
    const dayOfWeekWins = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    const dayOfWeekGames = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    const hourlyPerformance = Array(24).fill(0).map(() => ({ games: 0, wins: 0 }));

    // Detect if this is a low-is-better scoring game
    const isLowIsBetter = games.length > 0 && (games[0].lowIsBetter || games[0].gameData?.lowIsBetter);

    // Filter out paused games and sort by date (oldest first for chronological performance)
    const sortedGames = [...games]
      .filter(game => !game.isPaused && game.gameFinished !== false)
      .sort((a, b) => {
        const dateA = new Date(a.created_at || a.savedAt || a.lastPlayed || '1970-01-01');
        const dateB = new Date(b.created_at || b.savedAt || b.lastPlayed || '1970-01-01');
        return dateA - dateB;
      });

    sortedGames.forEach((game, index) => {
      totalGames++;
      
      // Get player's final score
      let playerScore = 0;
      let playerId = null;
      
      // Check if it's a wizard game (has gameState) or table game (has gameData)
      const isTableGame = game.gameType === 'table' || (game.gameData?.players && !game.gameData?.final_scores);
      
      if (isTableGame && game.gameData?.players) {
        // Table game structure
        const player = game.gameData.players.find(p => isCurrentPlayer(p));
        if (player) {
          playerId = player.id;
          // Calculate total score from points array
          if (player.points && Array.isArray(player.points)) {
            playerScore = player.points.reduce((sum, point) => sum + (point || 0), 0);
          }
        }
      } else {
        // Wizard game structure - check all possible locations for players and scores
        // Priority: game.players, game.gameData.players, game.gameState.players
        const players = game.players || game.gameData?.players || game.gameState?.players;
        if (players) {
          const player = players.find(p => isCurrentPlayer(p));
          if (player) {
            playerId = player.id;
            // Check if player has totalScore property
            if (player.totalScore !== undefined) {
              playerScore = player.totalScore;
            }
          }
        }
      }
      
      // Fallback score lookups for wizard games - check ALL possible locations
      if (!isTableGame && playerId && playerScore === 0) {
        // Check: game.final_scores, game.gameData.final_scores, game.gameState.final_scores
        const finalScores = game.final_scores || game.gameData?.final_scores || game.gameState?.final_scores;
        if (finalScores) {
          // Try by playerId first
          if (finalScores[playerId] !== undefined) {
            playerScore = finalScores[playerId];
          }
          // Then try by player name
          else if (finalScores[currentPlayer.name] !== undefined) {
            playerScore = finalScores[currentPlayer.name];
          }
          // For older formats, final_scores might be nested in players
          else {
            const player = (game.players || game.gameData?.players || game.gameState?.players)?.find(p => isCurrentPlayer(p));
            if (player && finalScores[player.name] !== undefined) {
              playerScore = finalScores[player.name];
            } else if (player && finalScores[player.id] !== undefined) {
              playerScore = finalScores[player.id];
            }
          }
        }
      }
      
      totalScore += playerScore;
      if (playerScore > highestScore) highestScore = playerScore;
      if (playerScore < lowestScore) lowestScore = playerScore;
      
      // Track best and worst games (swap logic if lower is better)
      if (isLowIsBetter) {
        // For low-is-better games: best = lowest score, worst = highest score
        if (playerScore < bestGameScore || bestGameScore === -Infinity) {
          bestGameScore = playerScore;
          bestGameData = { score: playerScore, date: game.created_at || game.savedAt, name: game.name };
        }
        if (playerScore > worstGameScore || worstGameScore === Infinity) {
          worstGameScore = playerScore;
          worstGameData = { score: playerScore, date: game.created_at || game.savedAt, name: game.name };
        }
      } else {
        // For high-is-better games: best = highest score, worst = lowest score
        if (playerScore > bestGameScore) {
          bestGameScore = playerScore;
          bestGameData = { score: playerScore, date: game.created_at || game.savedAt, name: game.name };
        }
        if (playerScore < worstGameScore) {
          worstGameScore = playerScore;
          worstGameData = { score: playerScore, date: game.created_at || game.savedAt, name: game.name };
        }
      }
      
      // Count rounds
      const rounds = game.totalRounds || game.total_rounds || game.gameState?.maxRounds || 0;
      totalRounds += rounds;
      
      // Determine if player won
      let isWin = false;
      
      if (isTableGame && game.gameData?.players) {
        // For table games: calculate winner from scores (most reliable method)
        const players = game.gameData.players;
        const gameLowIsBetter = game.lowIsBetter || game.gameData?.lowIsBetter || false;
        
        // Calculate all player scores
        const playerScores = players.map((p, idx) => {
          const total = p.points?.reduce((sum, point) => sum + (parseFloat(point) || 0), 0) || 0;
          return { index: idx, name: p.name, total };
        });
        
        if (playerScores.length > 0) {
          const scores = playerScores.map(p => p.total);
          const winningScore = gameLowIsBetter 
            ? Math.min(...scores)
            : Math.max(...scores);
          
          // Check if current player has the winning score
          const currentPlayerIdx = players.findIndex(p => isCurrentPlayer(p));
          
          if (currentPlayerIdx !== -1) {
            isWin = playerScores[currentPlayerIdx]?.total === winningScore;
          }
        }
      } else {
        // For Wizard games: use winner_ids (new) and winner_id (legacy)
        const winnerIdRaw = game.winner_ids || game.gameData?.totals?.winner_ids || game.gameData?.winner_ids || game.gameState?.winner_ids ||
                           game.winner_id || game.gameData?.totals?.winner_id || game.gameState?.winner_id;
        const winnerIds = Array.isArray(winnerIdRaw) ? winnerIdRaw : (winnerIdRaw ? [winnerIdRaw] : []);
        
        // Check if player's id is in winner_ids
        isWin = winnerIds.includes(currentPlayer.id) || 
                winnerIds.includes(playerId) ||
                winnerIds.some(wId => {
                  const winnerName = game.winner_name || game.gameData?.winner_name || 
                                    (game.players || game.gameState?.players)?.find(p => p.id === wId)?.name;
                  // Match by current player name or any linked identity name
                  if (!winnerName) return false;
                  const winnerNameLower = winnerName.toLowerCase();
                  if (winnerNameLower === currentPlayer.name?.toLowerCase()) return true;
                  if (currentPlayer.identities && Array.isArray(currentPlayer.identities)) {
                    return currentPlayer.identities.some(identity => identity.toLowerCase() === winnerNameLower);
                  }
                  return false;
                });
      }
      
      if (isWin) {
        wins++;
        tempWinStreak++;
        tempLossStreak = 0;
        if (tempWinStreak > longestWinStreak) longestWinStreak = tempWinStreak;
      } else {
        losses++;
        tempLossStreak++;
        tempWinStreak = 0;
        if (tempLossStreak > longestLossStreak) longestLossStreak = tempLossStreak;
      }
      
      // Current streak (based on most recent games)
      if (index === sortedGames.length - 1) {
        currentStreakType = tempWinStreak > 0 ? 'win' : tempLossStreak > 0 ? 'loss' : 'none';
        currentStreakCount = Math.max(tempWinStreak, tempLossStreak);
      }
      
      // Performance by player count - check v3.0 (game.players), table games (gameData.players), legacy wizard (gameState.players)
      const playerCount = game.players?.length || game.gameData?.players?.length || game.gameState?.players?.length || 0;
      if (playerCount > 0) {
        if (!performanceByPlayerCount[playerCount]) {
          performanceByPlayerCount[playerCount] = { games: 0, wins: 0, totalScore: 0 };
        }
        performanceByPlayerCount[playerCount].games++;
        if (isWin) performanceByPlayerCount[playerCount].wins++;
        performanceByPlayerCount[playerCount].totalScore += playerScore;
      }
      
      // Head-to-head tracking - check v3.0 (game.players), table games (gameData.players), legacy wizard (gameState.players)
      const players = game.players || game.gameData?.players || game.gameState?.players || [];
      if (players.length > 0) {
        players.forEach(opponent => {
          // Skip if this is the current player
          if (isCurrentPlayer(opponent)) {
            return;
          }
          const opponentKey = opponent.userId || opponent.name || opponent.id;
          const opponentName = opponent.name || opponent.username || 'Unknown';
          if (!headToHeadStats[opponentKey]) {
            headToHeadStats[opponentKey] = { 
              name: opponentName,
              userId: opponent.userId,
              games: 0, 
              wins: 0, 
              losses: 0 
            };
          }
          headToHeadStats[opponentKey].games++;
          if (isWin) headToHeadStats[opponentKey].wins++;
          else headToHeadStats[opponentKey].losses++;
        });
      }
      
      // Bid accuracy tracking (if available)
      // Check ALL possible locations: round_data, gameData.round_data, gameState.roundData
      const roundData = game.round_data || game.gameData?.round_data || game.gameState?.roundData;
      let gameBidAccuracy = null;
      let gameCorrectBids = 0;
      let gameTotalBids = 0;
      
      if (roundData && Array.isArray(roundData)) {
        let perfectGameRounds = 0;
        let completedGameRounds = 0;
        
        roundData.forEach(round => {
          if (round.players && Array.isArray(round.players)) {
            const roundPlayer = round.players.find(p => 
              isCurrentPlayer(p) || p.id === playerId
            );
            
            if (roundPlayer && roundPlayer.call !== null && roundPlayer.made !== null) {
              totalBids++;
              gameTotalBids++;
              completedGameRounds++;
              
              if (roundPlayer.call === roundPlayer.made) {
                correctBids++;
                gameCorrectBids++;
                perfectGameRounds++;
              }
            }
          }
        });
        
        // Calculate bid accuracy for this game
        if (gameTotalBids > 0) {
          gameBidAccuracy = (gameCorrectBids / gameTotalBids) * 100;
        }
        
        // Check if ALL rounds in this game were perfect
        if (completedGameRounds > 0 && perfectGameRounds === completedGameRounds) {
          perfectBidsCount++;
        }
      }
      
      // Time-based stats
      const gameDate = new Date(game.created_at || game.savedAt || game.lastPlayed);
      const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][gameDate.getDay()];
      const hour = gameDate.getHours();
      
      dayOfWeekGames[dayOfWeek]++;
      if (isWin) dayOfWeekWins[dayOfWeek]++;
      
      hourlyPerformance[hour].games++;
      if (isWin) hourlyPerformance[hour].wins++;
      
      // Comeback/dominant win detection
      if (isWin) {
        const allPlayers = game.players || game.gameData?.players || game.gameState?.players || [];
        if (allPlayers.length >= 2) {
          const sortedPlayers = [...allPlayers].sort((a, b) => {
            let scoreA, scoreB;
            
            // Handle table game scores
            if (game.gameType === 'table' || game.gameData?.players) {
              scoreA = a.points ? a.points.reduce((sum, p) => sum + (p || 0), 0) : 0;
              scoreB = b.points ? b.points.reduce((sum, p) => sum + (p || 0), 0) : 0;
              // If lowIsBetter, reverse the sort
              if (game.lowIsBetter || game.gameData?.lowIsBetter) {
                return scoreA - scoreB;
              }
            } else {
              // Handle wizard game scores - check v3.0 (final_scores at root) or legacy (gameState.final_scores)
              const finalScores = game.final_scores || game.gameState?.final_scores || {};
              scoreA = a.totalScore || finalScores[a.id] || 0;
              scoreB = b.totalScore || finalScores[b.id] || 0;
            }
            
            return scoreB - scoreA;
          });
          
          if (sortedPlayers.length >= 2) {
            let winnerScore, secondScore;
            
            if (game.gameType === 'table' || game.gameData?.players) {
              winnerScore = sortedPlayers[0].points ? 
                sortedPlayers[0].points.reduce((sum, p) => sum + (p || 0), 0) : 0;
              secondScore = sortedPlayers[1].points ? 
                sortedPlayers[1].points.reduce((sum, p) => sum + (p || 0), 0) : 0;
            } else {
              const finalScores = game.final_scores || game.gameState?.final_scores || {};
              winnerScore = sortedPlayers[0].totalScore || finalScores[sortedPlayers[0].id] || 0;
              secondScore = sortedPlayers[1].totalScore || finalScores[sortedPlayers[1].id] || 0;
            }
            
            const margin = Math.abs(winnerScore - secondScore);
            
            if (margin > 50) dominantWins++;
            if (margin < 10 && margin > 0) comebackWins++;
          }
        }
      }
      
      // Performance over time
      performanceData.push({
        game: index + 1,
        score: playerScore,
        date: gameDate.toLocaleDateString(),
        winRate: ((wins / totalGames) * 100).toFixed(1),
        bidAccuracy: gameBidAccuracy !== null ? parseFloat(gameBidAccuracy.toFixed(1)) : null
      });
      
      winLossData.push({
        game: index + 1,
        wins,
        losses,
        date: gameDate.toLocaleDateString()
      });
    });

    const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
    const averageScore = totalGames > 0 ? totalScore / totalGames : 0;
    const averageRoundsPerGame = totalGames > 0 ? totalRounds / totalGames : 0;
    const bidAccuracy = totalBids > 0 ? (correctBids / totalBids) * 100 : 0;
    
    // Find best and worst bid accuracy games
    const gamesWithBidAccuracy = performanceData.filter(g => g.bidAccuracy !== null);
    let bestBidAccuracyGame = null;
    let worstBidAccuracyGame = null;
    if (gamesWithBidAccuracy.length > 0) {
      bestBidAccuracyGame = gamesWithBidAccuracy.reduce((best, curr) => 
        curr.bidAccuracy > best.bidAccuracy ? curr : best
      );
      worstBidAccuracyGame = gamesWithBidAccuracy.reduce((worst, curr) => 
        curr.bidAccuracy < worst.bidAccuracy ? curr : worst
      );
    }

    // Calculate recent trend - use the already calculated wins from performance data
    let recentTrend = 'neutral';
    if (winLossData.length >= 10) {
      const recentWins = winLossData.slice(-5).filter(d => d.result === 'win').length;
      const previousWins = winLossData.slice(-10, -5).filter(d => d.result === 'win').length;
      
      if (recentWins > previousWins) recentTrend = 'improving';
      else if (recentWins < previousWins) recentTrend = 'declining';
    }

    // Process player count data
    const playerCountData = Object.entries(performanceByPlayerCount).map(([count, data]) => ({
      playerCount: `${count}P`,
      winRate: ((data.wins / data.games) * 100).toFixed(1),
      avgScore: (data.totalScore / data.games).toFixed(1),
      games: data.games
    }));

    // Process day of week data
    const dayOfWeekData = Object.entries(dayOfWeekGames).map(([day, gameCount]) => ({
      day,
      winRate: gameCount > 0 ? ((dayOfWeekWins[day] / gameCount) * 100).toFixed(1) : 0,
      games: gameCount
    }));

    // Process hourly data (only hours with games)
    const hourlyData = hourlyPerformance
      .map((data, hour) => ({
        hour: `${hour}:00`,
        winRate: data.games > 0 ? ((data.wins / data.games) * 100).toFixed(1) : 0,
        games: data.games
      }))
      .filter(d => d.games > 0);

    // Get top opponents
    const topOpponents = Object.entries(headToHeadStats)
      .map(([name, data]) => ({
        name,
        ...data,
        winRate: ((data.wins / data.games) * 100).toFixed(1)
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 5);

    // Calculate achievements
    const achievements = [];
    if (wins >= 10) achievements.push({ icon: '🏆', name: 'Veteran', description: '10+ wins' });
    if (wins >= 50) achievements.push({ icon: '👑', name: 'Champion', description: '50+ wins' });
    if (wins >= 100) achievements.push({ icon: '⭐', name: 'Legend', description: '100+ wins' });
    if (longestWinStreak >= 5) achievements.push({ icon: '🔥', name: 'Hot Streak', description: `${longestWinStreak} win streak` });
    if (winRate >= 70) achievements.push({ icon: '💎', name: 'Elite', description: `${winRate.toFixed(0)}% win rate` });
    if (perfectBidsCount >= 1) achievements.push({ icon: '🎯', name: 'Perfect Predictor', description: `${perfectBidsCount} perfect games` });
    if (bidAccuracy >= 80) achievements.push({ icon: '🧠', name: 'Mind Reader', description: `${bidAccuracy.toFixed(0)}% bid accuracy` });
    if (comebackWins >= 5) achievements.push({ icon: '💪', name: 'Comeback King', description: `${comebackWins} close wins` });
    if (dominantWins >= 5) achievements.push({ icon: '⚡', name: 'Dominator', description: `${dominantWins} dominant wins` });

    return {
      totalGames,
      wins,
      losses,
      winRate: winRate.toFixed(1),
      averageScore: averageScore.toFixed(1),
      highestScore: highestScore === -Infinity ? 0 : highestScore,
      lowestScore: lowestScore === Infinity ? 0 : lowestScore,
      isLowIsBetter,
      totalRounds,
      averageRoundsPerGame: averageRoundsPerGame.toFixed(1),
      performanceOverTime: performanceData,
      winLossOverTime: winLossData,
      recentTrend,
      currentStreak: { type: currentStreakType, count: currentStreakCount },
      longestWinStreak,
      longestLossStreak,
      bestGame: bestGameData,
      worstGame: worstGameData,
      bestBidAccuracyGame,
      worstBidAccuracyGame,
      playerCountData,
      dayOfWeekData,
      hourlyData,
      topOpponents,
      bidAccuracy: bidAccuracy.toFixed(1),
      perfectBids: perfectBidsCount,
      achievements,
      comebackWins,
      dominantWins
    };
  }, [games, currentPlayer]);

  if (!games || games.length === 0) {
    return (
      <div className="performance-stats-container">
        {/* <h2>Performance Statistics</h2> */}
        <div className="empty-message" style={{ textAlign: 'center', color: 'var(--text)', marginTop: 'var(--spacing-xl)' }}>
          No games played yet. Start playing to see your performance statistics!
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <PerformanceStatsContent stats={stats} isWizardGame={isWizardGame} />
  );
};

// Separate component to use useState (since stats is computed in useMemo)
const PerformanceStatsContent = ({ stats, isWizardGame }) => {
  const [insightType, setInsightType] = useState('score');
  
  // Prepare chart data with best/worst markers
  const chartData = useMemo(() => {
    if (!stats.performanceOverTime) return [];
    
    const bestScore = stats.bestGame?.score;
    const worstScore = stats.worstGame?.score;
    const bestBidGame = stats.bestBidAccuracyGame?.game;
    const worstBidGame = stats.worstBidAccuracyGame?.game;
    
    return stats.performanceOverTime.map((d) => ({
      ...d,
      isBestScore: d.score === bestScore,
      isWorstScore: d.score === worstScore,
      isBestBid: d.game === bestBidGame,
      isWorstBid: d.game === worstBidGame
    }));
  }, [stats]);

  // Custom dot renderer for highlighting best/worst
  const renderScoreDot = (props) => {
    const { cx, cy, payload } = props;
    if (payload.isBestScore) {
      return <circle cx={cx} cy={cy} r={6} fill="#1DBF73" stroke="#fff" strokeWidth={2} />;
    }
    if (payload.isWorstScore) {
      return <circle cx={cx} cy={cy} r={6} fill="#EF4444" stroke="#fff" strokeWidth={2} />;
    }
    return <circle cx={cx} cy={cy} r={3} fill="#4F46E5" />;
  };

  const renderBidDot = (props) => {
    const { cx, cy, payload } = props;
    if (payload.bidAccuracy === null) return null;
    if (payload.isBestBid) {
      return <circle cx={cx} cy={cy} r={6} fill="#1DBF73" stroke="#fff" strokeWidth={2} />;
    }
    if (payload.isWorstBid) {
      return <circle cx={cx} cy={cy} r={6} fill="#EF4444" stroke="#fff" strokeWidth={2} />;
    }
    return <circle cx={cx} cy={cy} r={3} fill="#4F46E5" />;
  };

  return (
    <div className="performance-stats-container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      
      {/* OVERVIEW SECTION */}
      <div>
        <h2 style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: '1.25rem', fontWeight: '600' }}>Overview</h2>
        
        {/* Overall Stats Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: 'var(--spacing-sm)',
          marginBottom: 'var(--spacing-sm)'
        }}>
          <StatCard title="Total Games" value={stats.totalGames} />
          <StatCard title="Win Rate" value={`${stats.winRate}%`} />
          <StatCard title="Wins" value={stats.wins} />
          <StatCard title="Losses" value={stats.losses} />
          {/* <StatCard title="Avg Score" value={stats.averageScore} /> */}
          {/* <StatCard title="Top Score" value={stats.isLowIsBetter ? stats.lowestScore : stats.highestScore} /> */}
        </div>

        {/* Streak & Trend Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--spacing-sm)'
        }}>
          {/* Current Streak */}
          {stats.currentStreak.count > 0 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 'var(--spacing-sm)',
              borderRadius: 'var(--radius-lg)',
              background: stats.currentStreak.type === 'win' ? 'rgba(29, 191, 115, 0.1)' : 'rgba(255, 92, 92, 0.1)',
              border: `1px solid ${stats.currentStreak.type === 'win' ? '#1DBF73' : '#FF5C5C'}`,
            }}>
              <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>
                {stats.currentStreak.count} {stats.currentStreak.type === 'win' ? 'Win' : 'Loss'} Streak
              </div>
              <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>Currently Active</div>
            </div>
          )}

          {/* Record Streaks */}
          <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 'var(--spacing-sm)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
          }}>
            <div style={{ fontWeight: '600', fontSize: '1.1rem', color: 'var(--primary)'}}>Streaks</div>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)'}}>
              <div><strong>Best:</strong> {stats.longestWinStreak} wins</div>
              <div><strong>Worst:</strong> {stats.longestLossStreak} losses</div>
            </div>
          </div>
        </div>
      </div>

      {/* INSIGHTS SECTION */}
      <div>
        <div className="performance-insights-header">
          <h2 style={{ margin: '0', fontSize: '1.25rem', fontWeight: '600', marginBottom: 'var(--spacing-sm)' }}>Performance Insights</h2>
          
          {/* Insight Type Selector */}
          {isWizardGame && (
            <select
              value={insightType}
              onChange={(e) => setInsightType(e.target.value)}
              className="game-type-selector"
              style={{ width: 'auto', minWidth: '140px' }}
            >
              <option value="score">Scores</option>
              <option value="bidAccuracy">Bid Accuracy</option>
            </select>
          )}
        </div>
        
        {/* Score View */}
        {insightType === 'score' && (
          <>
            {/* Score Metrics */}
            <div style={{
              display: 'flex',
              width: '100%',
              justifyContent: 'space-between',
              gap: 'var(--spacing-md)',
              marginBottom: 'var(--spacing-sm)'
            }}>
              <StatCard title="Average Score" icon={<CircleSlash2 size={16} />} value={stats.averageScore} />
              <StatCard title="Best Score" icon={<Trophy size={16} />} value={stats.bestGame?.score || 0} color="green" />
              <StatCard title="Worst Score" icon={<TrendingDown size={16} />} value={stats.worstGame?.score || 0} color="red" />
            </div>

            {/* Score Chart with Avg Line and Best/Worst Highlighted */}
            <div style={{ marginBottom: 'var(--spacing-xs)' }}>
              <h4 style={{ margin: '0 0 var(--spacing-xs) 0', fontSize: '1rem', fontWeight: '500', color: 'var(--primary)' }}>Score Progression</h4>
              
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 0, left: -20}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis 
                    dataKey="game" 
                    stroke="var(--text)"
                    tick={{ fill: 'var(--text)' }}
                    label={{ position: 'insideBottom', offset: -5, fill: 'var(--text)' }}
                  />
                  <YAxis 
                    stroke="var(--text)"
                    tick={{ fill: 'var(--text)' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'var(--card-bg)', 
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      color: 'var(--text)'
                    }}
                    formatter={(value, name) => {
                      if (name === 'score') return [value, 'Score'];
                      return [value, name];
                    }}
                  />
                  <ReferenceLine y={parseFloat(stats.averageScore)} stroke="var(--text)" strokeDasharray="5 5" strokeWidth={2} />
                  <Area 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#4F46E5" 
                    fill="#4F46E5" 
                    fillOpacity={0.2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#4F46E5"
                    strokeWidth={2}
                    dot={renderScoreDot}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 'var(--spacing-md)', fontSize: '0.75rem', marginBottom: 'var(--spacing-xs)', justifyContent: 'center'  }}>
                <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#1DBF73', marginRight: 4 }}></span>Best</span>
                <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#EF4444', marginRight: 4 }}></span>Worst</span>
                <span><span style={{ display: 'inline-block', width: 20, height: 2, background: '#F59E0B', marginRight: 4, verticalAlign: 'middle' }}></span>Average</span>
              </div>
            </div>
          </>
        )}

        {/* Bid Accuracy View */}
        {insightType === 'bidAccuracy' && isWizardGame && (
          <>
            {/* Bid Accuracy Metrics */}
            <div style={{
              display: 'flex',
              width: '100%',
              justifyContent: 'space-between',
              gap: 'var(--spacing-md)',
              marginBottom: 'var(--spacing-sm)'
            }}>
              <StatCard title="Average Accuracy" icon={<CircleSlash2 size={16} />} value={`${stats.bidAccuracy}%`} />
              <StatCard title="Best Accuracy" icon={<Target size={16} />} value={stats.bestBidAccuracyGame?.bidAccuracy !== undefined ? `${stats.bestBidAccuracyGame.bidAccuracy}%` : 'N/A'} color="green" />
              <StatCard title="Worst Accuracy" icon={<TrendingDown size={16} />} value={stats.worstBidAccuracyGame?.bidAccuracy !== undefined ? `${stats.worstBidAccuracyGame.bidAccuracy}%` : 'N/A'} color="red" />
            </div>

            {/* Bid Accuracy Chart */}
            <div style={{ marginBottom: 'var(--spacing-xs)' }}>
              <h4 style={{ margin: '0 0 var(--spacing-xs) 0', fontSize: '1rem', fontWeight: '500', color: 'var(--primary)' }}>Bid Accuracy Progression</h4>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={chartData.filter(d => d.bidAccuracy !== null)} margin={{ top: 5, right: 0, left: -10}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis 
                    dataKey="game" 
                    stroke="var(--text)"
                    tick={{ fill: 'var(--text)' }}
                    label={{ position: 'insideBottom', offset: -5, fill: 'var(--text)' }}
                  />
                  <YAxis 
                    stroke="var(--text)"
                    tick={{ fill: 'var(--text)' }}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'var(--card-bg)', 
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      color: 'var(--text)'
                    }}
                    formatter={(value) => [`${value}%`, 'Bid Accuracy']}
                  />
                  <ReferenceLine y={parseFloat(stats.bidAccuracy)} stroke="var(--text)" strokeDasharray="5 5" strokeWidth={2} />
                  <Area 
                    type="monotone" 
                    dataKey="bidAccuracy" 
                    stroke="#4F46E5" 
                    fill="#4F46E5" 
                    fillOpacity={0.2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="bidAccuracy" 
                    stroke="#4F46E5"
                    strokeWidth={2}
                    dot={renderBidDot}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 'var(--spacing-md)', fontSize: '0.75rem', marginBottom: 'var(--spacing-xs)', justifyContent: 'center' }}>
                <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#1DBF73', marginRight: 4 }}></span>Best</span>
                <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#EF4444', marginRight: 4 }}></span>Worst</span>
                <span><span style={{ display: 'inline-block', width: 20, height: 2, background: '#F59E0B', marginRight: 4, verticalAlign: 'middle' }}></span>Average</span>
              </div>
            </div>
          </>
        )}

        {/* Win Rate Over Time */}
        <div>
          <h4 style={{ margin: '0', fontSize: '1rem', fontWeight: '500', color: 'var(--primary)'  }}>Win Rate Progression</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.performanceOverTime} margin={{ top: 5, right: 0, left: -10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis 
                dataKey="game" 
                stroke="var(--text)"
                tick={{ fill: 'var(--text)' }}
                label={{ value: 'Game Number', position: 'insideBottom', offset: -5, fill: 'var(--text)' }}
              />
              <YAxis 
                stroke="var(--text)"
                tick={{ fill: 'var(--text)' }}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                contentStyle={{ 
                  background: 'var(--card-bg)', 
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  color: 'var(--text)'
                }}
                formatter={(value) => `${value}%`}
              />
              <Line 
                type="monotone" 
                dataKey="winRate" 
                stroke="#4F46E5" 
                strokeWidth={2}
                dot={{ fill: '#4F46E5', r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>      

      {/* ACHIEVEMENTS SECTION */}
      <div>
        <h2 style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: '1.25rem', fontWeight: '600' }}>Achievements</h2>
        {stats.achievements.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 'var(--spacing-sm)'
          }}>
            {stats.achievements.map((achievement, idx) => (
              <div key={idx} style={{
                background: 'var(--card-bg)',
                padding: 'var(--spacing-sm)',
                borderRadius: 'var(--radius-md)',
                border: '2px solid var(--primary)',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
                  {achievement.icon}
                </div>
                <div style={{ fontWeight: '600', fontSize: '0.85rem', marginBottom: '0.15rem' }}>
                  {achievement.name}
                </div>
                <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                  {achievement.description}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ 
            textAlign: 'center', 
            padding: 'var(--spacing-xl)', 
            background: 'var(--card-bg)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            opacity: 0.7 
          }}>
            Keep playing to unlock achievements! 🎯
          </div>
        )}
      </div>

    </div>
  );
};

export default PerformanceStatsEnhanced;
