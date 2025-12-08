import { useMemo, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter } from 'recharts';
import StatCard from '@/components/ui/StatCard';
import "@/styles/pages/performancestats.css";

const COLORS = ['#1DBF73', '#4F46E5', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

const PerformanceStatsEnhanced = ({ games, currentPlayer, isWizardGame = true }) => {
  // Calculate comprehensive statistics from games
  const stats = useMemo(() => {
    if (!games || games.length === 0) {
      return null;
    }

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

    // Sort games by date (oldest first for chronological performance)
    const sortedGames = [...games].sort((a, b) => {
      const dateA = new Date(a.created_at || a.savedAt || a.lastPlayed || '1970-01-01');
      const dateB = new Date(b.created_at || b.savedAt || b.lastPlayed || '1970-01-01');
      return dateA - dateB;
    });

    sortedGames.forEach((game, index) => {
      totalGames++;
      
      // Get player's final score
      let playerScore = 0;
      let playerId = null;
      
      if (game.gameState?.players) {
        const player = game.gameState.players.find(p => 
          p.name === currentPlayer.name || 
          p.id === currentPlayer.id ||
          p.username === currentPlayer.username
        );
        if (player) {
          playerId = player.id;
          if (player.totalScore !== undefined) {
            playerScore = player.totalScore;
          }
        }
      }
      
      if (playerId && playerScore === 0) {
        if (game.final_scores?.[playerId] !== undefined) {
          playerScore = game.final_scores[playerId];
        } else if (game.gameState?.final_scores?.[playerId] !== undefined) {
          playerScore = game.gameState.final_scores[playerId];
        }
      }
      
      if (playerScore === 0) {
        if (game.final_scores?.[currentPlayer.name] !== undefined) {
          playerScore = game.final_scores[currentPlayer.name];
        } else if (game.gameState?.final_scores?.[currentPlayer.name] !== undefined) {
          playerScore = game.gameState.final_scores[currentPlayer.name];
        }
      }
      
      totalScore += playerScore;
      if (playerScore > highestScore) highestScore = playerScore;
      if (playerScore < lowestScore) lowestScore = playerScore;
      
      // Track best and worst games
      if (playerScore > bestGameScore) {
        bestGameScore = playerScore;
        bestGameData = { score: playerScore, date: game.created_at || game.savedAt, name: game.name };
      }
      if (playerScore < worstGameScore) {
        worstGameScore = playerScore;
        worstGameData = { score: playerScore, date: game.created_at || game.savedAt, name: game.name };
      }
      
      // Count rounds
      const rounds = game.total_rounds || game.gameState?.maxRounds || 0;
      totalRounds += rounds;
      
      // Determine if player won
      const winnerId = game.winner_id || game.gameState?.winner_id;
      const winnerName = game.gameState?.players?.find(p => p.id === winnerId)?.name;
      const isWin = winnerName === currentPlayer.name || winnerId === currentPlayer.id;
      
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
      
      // Performance by player count
      const playerCount = game.gameState?.players?.length || 0;
      if (playerCount > 0) {
        if (!performanceByPlayerCount[playerCount]) {
          performanceByPlayerCount[playerCount] = { games: 0, wins: 0, totalScore: 0 };
        }
        performanceByPlayerCount[playerCount].games++;
        if (isWin) performanceByPlayerCount[playerCount].wins++;
        performanceByPlayerCount[playerCount].totalScore += playerScore;
      }
      
      // Head-to-head tracking
      if (game.gameState?.players) {
        game.gameState.players.forEach(opponent => {
          if (opponent.name !== currentPlayer.name && opponent.id !== currentPlayer.id) {
            const opponentName = opponent.name || opponent.username || 'Unknown';
            if (!headToHeadStats[opponentName]) {
              headToHeadStats[opponentName] = { games: 0, wins: 0, losses: 0 };
            }
            headToHeadStats[opponentName].games++;
            if (isWin) headToHeadStats[opponentName].wins++;
            else headToHeadStats[opponentName].losses++;
          }
        });
      }
      
      // Bid accuracy tracking (if available)
      if (game.gameState?.roundData && Array.isArray(game.gameState.roundData)) {
        let perfectGameRounds = 0;
        let completedGameRounds = 0;
        
        game.gameState.roundData.forEach(round => {
          if (round.players && Array.isArray(round.players)) {
            const roundPlayer = round.players.find(p => 
              p.name === currentPlayer.name || 
              p.id === currentPlayer.id ||
              p.username === currentPlayer.username ||
              p.id === playerId
            );
            
            if (roundPlayer && roundPlayer.call !== null && roundPlayer.made !== null) {
              totalBids++;
              completedGameRounds++;
              
              if (roundPlayer.call === roundPlayer.made) {
                correctBids++;
                perfectGameRounds++;
              }
            }
          }
        });
        
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
      if (isWin && game.gameState?.players) {
        const sortedPlayers = [...game.gameState.players].sort((a, b) => {
          const scoreA = a.totalScore || game.final_scores?.[a.id] || 0;
          const scoreB = b.totalScore || game.final_scores?.[b.id] || 0;
          return scoreB - scoreA;
        });
        
        if (sortedPlayers.length >= 2) {
          const winnerScore = sortedPlayers[0].totalScore || game.final_scores?.[sortedPlayers[0].id] || 0;
          const secondScore = sortedPlayers[1].totalScore || game.final_scores?.[sortedPlayers[1].id] || 0;
          const margin = winnerScore - secondScore;
          
          if (margin > 50) dominantWins++;
          if (margin < 10 && margin > 0) comebackWins++;
        }
      }
      
      // Performance over time
      performanceData.push({
        game: index + 1,
        score: playerScore,
        date: gameDate.toLocaleDateString(),
        winRate: ((wins / totalGames) * 100).toFixed(1)
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

    // Calculate recent trend
    let recentTrend = 'neutral';
    if (games.length >= 10) {
      const recent5 = sortedGames.slice(-5);
      const previous5 = sortedGames.slice(-10, -5);
      
      const recentWins = recent5.filter(game => {
        const winnerId = game.winner_id || game.gameState?.winner_id;
        const winnerName = game.gameState?.players?.find(p => p.id === winnerId)?.name;
        return winnerName === currentPlayer.name || winnerId === currentPlayer.id;
      }).length;
      
      const previousWins = previous5.filter(game => {
        const winnerId = game.winner_id || game.gameState?.winner_id;
        const winnerName = game.gameState?.players?.find(p => p.id === winnerId)?.name;
        return winnerName === currentPlayer.name || winnerId === currentPlayer.id;
      }).length;
      
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
    <div className="performance-stats-container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      
      {/* OVERVIEW SECTION */}
      <div>
        <h3 style={{ margin: '0 0 var(--spacing-md) 0', fontSize: '1.25rem', fontWeight: '600' }}>Overview</h3>
        
        {/* Overall Stats Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: 'var(--spacing-sm)',
          marginBottom: 'var(--spacing-md)'
        }}>
          <StatCard title="Total Games" value={stats.totalGames} />
          <StatCard title="Wins" value={stats.wins} />
          <StatCard title="Losses" value={stats.losses} />
          <StatCard title="Win Rate" value={`${stats.winRate}%`} />
          <StatCard title="Avg Score" value={stats.averageScore} />
          <StatCard title="High Score" value={stats.highestScore} />
        </div>

        {/* Streak & Trend Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--spacing-md)'
        }}>
          {/* Current Streak */}
          {stats.currentStreak.count > 0 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 'var(--spacing-md)',
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
              padding: 'var(--spacing-md)',
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

          {/* Recent Trend */}
          {/* {stats.totalGames >= 10 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 'var(--spacing-md)',
              borderRadius: 'var(--radius-lg)',
              background: stats.recentTrend === 'improving' ? 'rgba(29, 191, 115, 0.1)' : 
                         stats.recentTrend === 'declining' ? 'rgba(255, 92, 92, 0.1)' : 
                         'rgba(107, 114, 128, 0.1)',
              border: `1px solid ${stats.recentTrend === 'improving' ? '#1DBF73' : 
                                    stats.recentTrend === 'declining' ? '#FF5C5C' : '#6B7280'}`,
            }}>
              <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-xs)' }}>
                {stats.recentTrend === 'improving' ? '📈' : stats.recentTrend === 'declining' ? '📉' : '➡️'}
              </div>
              <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>
                {stats.recentTrend === 'improving' ? 'Improving!' : 
                 stats.recentTrend === 'declining' ? 'Needs Work' : 'Stable'}
              </div>
              <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>Last 5 vs Previous 5</div>
            </div>
          )} */}
        </div>
      </div>

      {/* INSIGHTS SECTION */}
      <div>
        <h3 style={{ margin: '0 0 var(--spacing-md) 0', fontSize: '1.25rem', fontWeight: '600' }}>Performance Insights</h3>
        
        {/* Performance Metrics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 'var(--spacing-sm)',
          marginBottom: 'var(--spacing-md)'
        }}>
          {isWizardGame && <StatCard title="Bid Accuracy" value={`${stats.bidAccuracy}%`} />}
          {isWizardGame && <StatCard title="Perfect Games" value={stats.perfectBids} />}
          <StatCard title="Best Score" value={stats.bestGame?.score || 0} />
          <StatCard title="Worst Score" value={stats.worstGame?.score || 0} />
        </div>

        {/* Score Performance Over Time */}
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <h4 style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: '1rem', fontWeight: '500' }}>Score Progression</h4>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.performanceOverTime}>
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
                label={{ value: 'Score', angle: -90, position: 'insideLeft', fill: 'var(--text)' }}
              />
              <Tooltip 
                contentStyle={{ 
                  background: 'var(--card-bg)', 
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  color: 'var(--text)'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="score" 
                stroke="#1DBF73" 
                fill="#1DBF73" 
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Win Rate Over Time */}
        <div>
          <h4 style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: '1rem', fontWeight: '500' }}>Win Rate Progression</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.performanceOverTime}>
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
                label={{ value: 'Win Rate (%)', angle: -90, position: 'insideLeft', fill: 'var(--text)' }}
                domain={[0, 100]}
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

      {/* HEAD-TO-HEAD SECTION */}
      <div>
        <h3 style={{ margin: '0 0 var(--spacing-md) 0', fontSize: '1.25rem', fontWeight: '600' }}>Head-to-Head Performance</h3>
        {stats.topOpponents.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 'var(--spacing-md)'
          }}>
            {stats.topOpponents.map((opponent, idx) => (
              <div key={idx} style={{
                background: 'var(--card-bg)',
                padding: 'var(--spacing-md)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{opponent.name}</div>
                  <div style={{ fontSize: '0.875rem', opacity: 0.8}}>
                    {opponent.games} games
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: '700', color: opponent.winRate >= 50 ? '#1DBF73' : '#FF5C5C' }}>
                    {opponent.winRate}%
                  </div>
                  <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                    {opponent.wins}W - {opponent.losses}L
                  </div>
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
            No opponent data available yet
          </div>
        )}
      </div>

      {/* ACHIEVEMENTS SECTION */}
      <div>
        <h3 style={{ margin: '0 0 var(--spacing-md) 0', fontSize: '1.25rem', fontWeight: '600' }}>Achievements</h3>
        {stats.achievements.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 'var(--spacing-md)'
          }}>
            {stats.achievements.map((achievement, idx) => (
              <div key={idx} style={{
                background: 'var(--card-bg)',
                padding: 'var(--spacing-md)',
                borderRadius: 'var(--radius-md)',
                border: '2px solid var(--primary)',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-xs)' }}>
                  {achievement.icon}
                </div>
                <div style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '0.25rem' }}>
                  {achievement.name}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
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
