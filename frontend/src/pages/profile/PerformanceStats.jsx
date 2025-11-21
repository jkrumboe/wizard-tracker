import { useMemo, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import StatCard from '@/components/ui/StatCard';

const PerformanceStats = ({ games, currentPlayer }) => {
  const [selectedView, setSelectedView] = useState('overview'); // 'overview', 'detailed', 'headToHead'
  
  // Calculate comprehensive statistics from games
  const stats = useMemo(() => {
    if (!games || games.length === 0) {
      return {
        totalGames: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        totalRounds: 0,
        averageRoundsPerGame: 0,
        performanceOverTime: [],
        winLossOverTime: [],
        scoreDistribution: [],
        recentTrend: 'neutral',
        currentStreak: { type: 'none', count: 0 },
        longestWinStreak: 0,
        longestLossStreak: 0,
        performanceByPlayerCount: {},
        bestGame: null,
        worstGame: null,
        headToHead: {},
        bidAccuracy: 0,
        perfectBids: 0,
        achievements: [],
        timeStats: {},
        comebackWins: 0,
        dominantWins: 0
      };
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
    const timeStats = {};

    // Sort games by date (oldest first for chronological performance)
    const sortedGames = [...games].sort((a, b) => {
      const dateA = new Date(a.created_at || a.savedAt || a.lastPlayed || '1970-01-01');
      const dateB = new Date(b.created_at || b.savedAt || b.lastPlayed || '1970-01-01');
      return dateA - dateB;
    });

    console.log('Calculating stats for player:', currentPlayer.name);
    console.log('Sample game data:', sortedGames[0]);

    sortedGames.forEach((game, index) => {
      totalGames++;
      
      // Get player's final score - scores are stored with player IDs as keys
      let playerScore = 0;
      let playerId = null;
      
      // Find the player's ID from the game
      if (game.gameState?.players) {
        const player = game.gameState.players.find(p => 
          p.name === currentPlayer.name || 
          p.id === currentPlayer.id ||
          p.username === currentPlayer.username
        );
        if (player) {
          playerId = player.id;
          // Also check if player has totalScore in their object
          if (player.totalScore !== undefined) {
            playerScore = player.totalScore;
          }
        }
      }
      
      // If we found a player ID and haven't found a score yet, look it up in final_scores
      if (playerId && playerScore === 0) {
        if (game.final_scores?.[playerId] !== undefined) {
          playerScore = game.final_scores[playerId];
        } else if (game.gameState?.final_scores?.[playerId] !== undefined) {
          playerScore = game.gameState.final_scores[playerId];
        }
      }
      
      // Fallback: try with player name
      if (playerScore === 0) {
        if (game.final_scores?.[currentPlayer.name] !== undefined) {
          playerScore = game.final_scores[currentPlayer.name];
        } else if (game.gameState?.final_scores?.[currentPlayer.name] !== undefined) {
          playerScore = game.gameState.final_scores[currentPlayer.name];
        }
      }
      
      if (index === 0) {
        console.log('First game score calculation:', {
          playerScore,
          playerId,
          final_scores: game.final_scores,
          gameState_final_scores: game.gameState?.final_scores,
          players: game.gameState?.players?.map(p => ({ name: p.name, id: p.id, totalScore: p.totalScore }))
        });
      }
      
      totalScore += playerScore;
      
      if (playerScore > highestScore) highestScore = playerScore;
      if (playerScore < lowestScore) lowestScore = playerScore;
      
      // Count rounds
      const rounds = game.total_rounds || game.gameState?.maxRounds || 0;
      totalRounds += rounds;
      
      // Determine if player won
      const winnerId = game.winner_id || game.gameState?.winner_id;
      const winnerName = game.gameState?.players?.find(p => p.id === winnerId)?.name;
      const isWin = winnerName === currentPlayer.name || winnerId === currentPlayer.id;
      
      if (isWin) {
        wins++;
      } else {
        losses++;
      }
      
      // Performance over time
      const gameDate = new Date(game.created_at || game.savedAt || game.lastPlayed);
      performanceData.push({
        game: index + 1,
        score: playerScore,
        date: gameDate.toLocaleDateString(),
        winRate: ((wins / totalGames) * 100).toFixed(1)
      });
      
      // Win/Loss over time
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

    // Calculate recent trend (last 5 games vs previous 5 games)
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
      recentTrend
    };
  }, [games, currentPlayer]);

  if (!games || games.length === 0) {
    return (
      <div className="performance-stats-container" style={{ padding: 'var(--spacing-md)' }}>
        <h2>Performance Statistics</h2>
        <div className="empty-message" style={{ textAlign: 'center', color: 'var(--text)' }}>
          No games played yet. Start playing to see your performance statistics!
        </div>
      </div>
    );
  }

  return (
    <div className="performance-stats-container" style={{ display: 'flex', flexDirection: 'column', paddingTop: 'var(--spacing-md)', gap: 'var(--spacing-md)' }}>
      <h2 style={{ margin: '0' }}>Performance Statistics</h2>
      
      {/* Overall Stats Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: 'var(--spacing-md)'
      }}>
        <StatCard title="Total Games" value={stats.totalGames} />
        <StatCard title="Wins" value={stats.wins} />
        <StatCard title="Losses" value={stats.losses} />
        <StatCard title="Win Rate" value={`${stats.winRate}%`} />
        <StatCard title="Avg Score" value={stats.averageScore} />
        <StatCard title="High Score" value={stats.highestScore} />
      </div>

      {/* Performance Trend Indicator */}
      {stats.totalGames >= 10 && (
        <div style={{
          padding: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-lg)',
          borderRadius: 'var(--radius-lg)',
          background: stats.recentTrend === 'improving' ? 'rgba(29, 191, 115, 0.1)' : 
                     stats.recentTrend === 'declining' ? 'rgba(255, 92, 92, 0.1)' : 
                     'rgba(107, 114, 128, 0.1)',
          border: `1px solid ${stats.recentTrend === 'improving' ? '#1DBF73' : 
                                stats.recentTrend === 'declining' ? '#FF5C5C' : '#6B7280'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)'
        }}>
          <span style={{ fontSize: '1.5rem' }}>
            {stats.recentTrend === 'improving' ? '📈' : 
             stats.recentTrend === 'declining' ? '📉' : '➡️'}
          </span>
          <span style={{ fontWeight: '500' }}>
            Recent Trend: {stats.recentTrend === 'improving' ? 'Improving!' : 
                          stats.recentTrend === 'declining' ? 'Needs Work' : 'Stable'}
          </span>
        </div>
      )}

      {/* Score Performance Over Time */}
      <div style={{ 
        background: 'var(--card-bg)',
        padding: 'var(--spacing-lg)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)'
      }}>
        <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Score Progression</h3>
        <ResponsiveContainer width="100%" height={250}>
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
      <div style={{
        background: 'var(--card-bg)',
        padding: 'var(--spacing-lg)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)'
      }}>
        <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Win Rate Progression</h3>
        <ResponsiveContainer width="100%" height={250}>
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

      {/* Cumulative Wins vs Losses */}
      <div style={{ 
        background: 'var(--card-bg)',
        padding: 'var(--spacing-lg)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)'
      }}>
        <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Cumulative Wins vs Losses</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={stats.winLossOverTime}>
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
              label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: 'var(--text)' }}
            />
            <Tooltip 
              contentStyle={{ 
                background: 'var(--card-bg)', 
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--text)'
              }}
            />
            <Legend wrapperStyle={{ color: 'var(--text)' }} />
            <Area 
              type="monotone" 
              dataKey="wins" 
              stackId="1"
              stroke="#1DBF73" 
              fill="#1DBF73" 
              fillOpacity={0.6}
              name="Wins"
            />
            <Area 
              type="monotone" 
              dataKey="losses" 
              stackId="2"
              stroke="#FF5C5C" 
              fill="#FF5C5C" 
              fillOpacity={0.6}
              name="Losses"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Additional Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--spacing-md)'
      }}>
        <div style={{
          background: 'var(--card-bg)',
          padding: 'var(--spacing-md)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)'
        }}>
          <div style={{ color: 'var(--text)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
            Total Rounds Played
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>
            {stats.totalRounds}
          </div>
        </div>
        
        <div style={{
          background: 'var(--card-bg)',
          padding: 'var(--spacing-md)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)'
        }}>
          <div style={{ color: 'var(--text)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
            Avg Rounds per Game
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>
            {stats.averageRoundsPerGame}
          </div>
        </div>
        
        <div style={{
          background: 'var(--card-bg)',
          padding: 'var(--spacing-md)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)'
        }}>
          <div style={{ color: 'var(--text)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
            Lowest Score
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>
            {stats.lowestScore}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceStats;
