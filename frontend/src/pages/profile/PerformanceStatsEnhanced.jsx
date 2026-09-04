import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter, ComposedChart, ReferenceLine } from 'recharts';
import { CircleSlash2, Trophy, TrendingDown, TrendingUp, Lock, CircleCheck, Target, ExternalLink } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import { useUserElo } from '@/shared/hooks/useElo';
import {
  createPlayerMatcher,
  getGamePlayers,
  getPlayerScore,
  resolveUserGameResult,
} from '@/shared/utils/playerMatching';
import { evaluateAchievements, formatAchievementProgress, getAchievementGateKey } from '@/shared/utils/achievements';
import '@/styles/pages/account.css';
import "@/styles/pages/performancestats.css";

const PerformanceStatsEnhanced = ({ games, currentPlayer, isWizardGame = true, gameType = 'wizard', identityId = null }) => {
  const { t } = useTranslation();
  // Calculate comprehensive statistics from games
  const stats = useMemo(() => {
    if (!games || games.length === 0) {
      return null;
    }

    // Resolving which player is the current user lives in one place - see
    // @/shared/utils/playerMatching. It matches identity ids first, then account
    // ids, then names, and ignores fields that are missing on either side so an
    // absent id can never make the first player of a game look like the user.
    const matcher = createPlayerMatcher(currentPlayer);
    const isCurrentPlayer = (p) => matcher.matches(p);

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
    let closeWins = 0;
    let dominantWins = 0;
    let bestPerfectRoundsInGame = 0;
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
      
      // Resolve the user's own player once - the score, the win and every
      // per-player stat below must all describe the same person.
      const gamePlayers = getGamePlayers(game) || [];
      const { playerIndex: currentPlayerIdx, player: userPlayer, won } =
        resolveUserGameResult(game, matcher);
      const playerId = userPlayer?.id ?? null;

      // Table games score with a points array instead of final_scores
      const isTableGame =
        game.gameType === 'table' || (game.gameData?.players && !game.gameData?.final_scores);

      // Get player's final score (points array, totalScore or final_scores)
      const resolvedScore =
        currentPlayerIdx === -1 ? null : getPlayerScore(game, gamePlayers, currentPlayerIdx);
      const playerScore = resolvedScore ?? 0;

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
      
      // Determine if player won - resolved together with the player above so a
      // win can never be read off a different player's slot.
      const isWin = won === true;

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
      const playerCount = gamePlayers.length || game.playerCount || 0;
      if (playerCount > 0) {
        if (!performanceByPlayerCount[playerCount]) {
          performanceByPlayerCount[playerCount] = { games: 0, wins: 0, totalScore: 0 };
        }
        performanceByPlayerCount[playerCount].games++;
        if (isWin) performanceByPlayerCount[playerCount].wins++;
        performanceByPlayerCount[playerCount].totalScore += playerScore;
      }
      
      // Head-to-head tracking
      const players = gamePlayers;
      if (players.length > 0) {
        players.forEach((opponent, opponentIdx) => {
          // Skip the current user's own slot (matched above), not merely anyone
          // who happens to share one of their identifiers
          if (opponentIdx === currentPlayerIdx || isCurrentPlayer(opponent)) {
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
        // Running totals per player, used to spot whether the player was ever last
        const runningTotals = {};
        const roundLowIsBetter = game.lowIsBetter || game.gameData?.lowIsBetter || false;
        let wasInLastPlace = false;
        
        roundData.forEach((round, roundIndex) => {
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
            
            // Standings after this round
            round.players.forEach(p => {
              const key = p.id ?? p.name;
              if (key === undefined || key === null) return;
              runningTotals[key] = (runningTotals[key] || 0) + (parseFloat(p.score) || 0);
            });
            
            const myKey = roundPlayer?.id ?? roundPlayer?.name;
            const otherTotals = Object.entries(runningTotals)
              .filter(([key]) => key !== String(myKey))
              .map(([, total]) => total);
            
            // Only from the second round on - being last after a single round means little
            if (roundIndex >= 1 && myKey !== undefined && myKey !== null && otherTotals.length > 0) {
              const myTotal = runningTotals[myKey] ?? 0;
              const isLast = roundLowIsBetter
                ? otherTotals.every(total => myTotal > total)
                : otherTotals.every(total => myTotal < total);
              if (isLast) wasInLastPlace = true;
            }
          }
        });
        
        // Calculate bid accuracy for this game
        if (gameTotalBids > 0) {
          gameBidAccuracy = (gameCorrectBids / gameTotalBids) * 100;
        }
        
        if (perfectGameRounds > bestPerfectRoundsInGame) {
          bestPerfectRoundsInGame = perfectGameRounds;
        }
        
        // Check if ALL rounds in this game were perfect
        if (completedGameRounds > 0 && perfectGameRounds === completedGameRounds) {
          perfectBidsCount++;
        }
        
        // Comeback: dead last at some point during the game and still won it
        if (isWin && wasInLastPlace) comebackWins++;
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
        const allPlayers = gamePlayers;
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
            
            if (margin >= 50) dominantWins++;
            if (margin < 10 && margin > 0) closeWins++;
          }
        }
      }
      
      // Performance over time
      performanceData.push({
        game: index + 1,
        score: playerScore,
        date: gameDate.toLocaleDateString(),
        winRate: ((wins / totalGames) * 100).toFixed(1),
        bidAccuracy: gameBidAccuracy !== null ? parseFloat(gameBidAccuracy.toFixed(1)) : null,
        gameId: game._id || game.id || game.gameId,
        isTableGame,
        gameType: game.gameType || (isTableGame ? 'table' : 'wizard')
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

    const opponentCount = Object.keys(headToHeadStats).length;

    // Everything an achievement can be measured against
    const achievementStats = {
      totalGames,
      wins,
      winRateValue: winRate,
      longestWinStreak,
      correctBidRounds: correctBids,
      totalBidRounds: totalBids,
      bidAccuracyValue: bidAccuracy,
      bestPerfectRoundsInGame,
      perfectGames: perfectBidsCount,
      dominantWins,
      closeWins,
      comebackWins,
      opponentCount,
      totalRounds
    };
    const achievements = evaluateAchievements(achievementStats, { includeBidAchievements: isWizardGame });

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
      perfectGames: perfectBidsCount,
      bestPerfectRoundsInGame,
      opponentCount,
      achievements,
      unlockedAchievements: achievements.filter(a => a.unlocked).length,
      comebackWins,
      closeWins,
      dominantWins
    };
  }, [games, currentPlayer, isWizardGame]);

  if (!games || games.length === 0) {
    return (
      <div className="performance-stats-container">
        {/* <h2>Performance Statistics</h2> */}
        <div className="empty-message" style={{ textAlign: 'center', color: 'var(--text)', marginTop: 'var(--spacing-xl)' }}>
          {t('profile.noGamesPlayed')}
        </div>
      </div>
    );
  }

  if (!stats) return null;

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
          onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light, rgba(79,70,229,0.1))'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
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
          onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light, rgba(79,70,229,0.1))'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {t('profile.viewGame')} <ExternalLink size={12} />
        </button>
      )}
    </div>
  );
};

// Separate component to use useState (since stats is computed in useMemo)
const PerformanceStatsContent = ({ stats, isWizardGame, gameType, identityId = null }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
        {/* Overall Stats Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: 'var(--spacing-sm)',
          marginBottom: 'var(--spacing-sm)'
        }}>
          <StatCard title={t('common.totalGames')} value={stats.totalGames} />
          <StatCard title={t('common.winRate')} value={`${stats.winRate}%`} />
          <StatCard title={t('common.wins')} value={stats.wins} />
          <StatCard title={t('common.losses')} value={stats.losses} />
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
                {t(stats.currentStreak.type === 'win' ? 'profile.winStreak' : 'profile.lossStreak', { count: stats.currentStreak.count })}
              </div>
              <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>{t('profile.currentlyActive')}</div>
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
            <div style={{ fontWeight: '600', fontSize: '1.1rem', color: 'var(--primary)'}}>{t('profile.streaks')}</div>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)'}}>
              <div><strong>{t('profile.best')}:</strong> {stats.longestWinStreak} {t('common.wins')}</div>
              <div><strong>{t('profile.worst')}:</strong> {stats.longestLossStreak} {t('common.losses')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* INSIGHTS SECTION */}
      <div>
        <div className="performance-insights-header">          
          {/* Insight Type Selector */}
          {isWizardGame && (
            <select
              value={insightType}
              onChange={(e) => setInsightType(e.target.value)}
              className="game-type-selector"
              style={{ width: 'auto', minWidth: '140px' }}
            >
              <option value="score">{t('profile.scoresOption')}</option>
              <option value="bidAccuracy">{t('profile.bidAccuracy')}</option>
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
              <StatCard title={t('profile.averageScore')} icon={<CircleSlash2 size={16} />} value={stats.averageScore} />
              <StatCard title={t('profile.bestScore')} icon={<Trophy size={16} />} value={stats.bestGame?.score || 0} color="green" />
              <StatCard title={t('profile.worstScore')} icon={<TrendingDown size={16} />} value={stats.worstGame?.score || 0} color="red" />
            </div>

            {/* Score Chart with Avg Line and Best/Worst Highlighted */}
            <div style={{ marginBottom: 'var(--spacing-xs)' }}>
              {/* <h4 style={{ margin: '0 0 var(--spacing-xs) 0', fontSize: '1rem', fontWeight: '500', color: 'var(--primary)' }}>Score Progression</h4> */}
              
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
                    content={<GameTooltip 
                      navigate={navigate} 
                      formatter={(value, name) => {
                        if (name === 'score') return [value, t('common.score')];
                        return [value, name];
                      }}
                    />}
                    wrapperStyle={{ pointerEvents: 'auto' }}
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
                <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#1DBF73', marginRight: 4 }}></span>{t('profile.best')}</span>
                <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#EF4444', marginRight: 4 }}></span>{t('profile.worst')}</span>
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
              <StatCard title={t('profile.averageAccuracy')} icon={<CircleSlash2 size={16} />} value={`${stats.bidAccuracy}%`} />
              <StatCard title={t('profile.bestAccuracy')} icon={<Target size={16} />} value={stats.bestBidAccuracyGame?.bidAccuracy !== undefined ? `${stats.bestBidAccuracyGame.bidAccuracy}%` : t('common.na')} color="green" />
              <StatCard title={t('profile.worstAccuracy')} icon={<TrendingDown size={16} />} value={stats.worstBidAccuracyGame?.bidAccuracy !== undefined ? `${stats.worstBidAccuracyGame.bidAccuracy}%` : t('common.na')} color="red" />
            </div>

            {/* Bid Accuracy Chart */}
            <div style={{ marginBottom: 'var(--spacing-xs)' }}>
              {/* <h4 style={{ margin: '0 0 var(--spacing-xs) 0', fontSize: '1rem', fontWeight: '500', color: 'var(--primary)' }}>Bid Accuracy Progression</h4> */}
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
                    content={<GameTooltip 
                      navigate={navigate} 
                      formatter={(value, name) => {
                        if (name === 'bidAccuracy') return [`${value}%`, t('profile.bidAccuracy')];
                        return [value, name];
                      }}
                    />}
                    wrapperStyle={{ pointerEvents: 'auto' }}
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
                <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#1DBF73', marginRight: 4 }}></span>{t('profile.best')}</span>
                <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#EF4444', marginRight: 4 }}></span>{t('profile.worst')}</span>
                <span><span style={{ display: 'inline-block', width: 20, height: 2, background: '#F59E0B', marginRight: 4, verticalAlign: 'middle' }}></span>Average</span>
              </div>
            </div>
          </>
        )}

        {/* ELO Rating Section */}
        <EloRatingSection gameType={gameType} identityId={identityId} />
      </div>      

      {/* ACHIEVEMENTS SECTION */}
      <div>
        <div className="achievements-header">
          <h2>{t('profile.achievements')}</h2>
          <span className="achievements-count">
            {t('profile.achievementsUnlocked', { unlocked: stats.unlockedAchievements, total: stats.achievements.length })}
          </span>
        </div>
        {stats.unlockedAchievements === 0 && (
          <div className="achievements-hint">{t('profile.keepPlayingAchievements')}</div>
        )}
        <div className="achievements-grid">
          {stats.achievements.map((achievement) => {
            const gateKey = getAchievementGateKey(achievement);

            return (
              <div
                key={achievement.id}
                className={`achievement-card ${achievement.unlocked ? 'is-unlocked' : 'is-locked'}`}
                title={t(`achievements.${achievement.id}Desc`)}
              >
                <span className="achievement-badge" aria-hidden="true">
                  {achievement.unlocked
                    ? <CircleCheck size={11} />
                    : <Lock size={10} />}
                </span>
                <div className="achievement-name">{t(`achievements.${achievement.id}`)}</div>
                <div className="achievement-description">{t(`achievements.${achievement.id}Desc`)}</div>
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
      </div>

    </div>
  );
};

// ELO Rating Section Component
const EloRatingSection = ({ gameType = 'wizard', identityId = null }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  // Normalize game type for API
  const normalizedGameType = gameType?.toLowerCase().trim().replace(/\s+/g, '-') || 'wizard';
  const { elo, loading: eloLoading } = useUserElo(normalizedGameType, identityId);

  // Get ELO display values
  const currentRating = elo?.currentRating || elo?.rating || 1000;
  const peakRating = elo?.peak || currentRating;
  const floorRating = elo?.floor || currentRating;
  const _eloGamesPlayed = elo?.gamesPlayed || 0;
  const _streak = elo?.streak || 0;
  const hasElo = elo?.hasIdentity !== false;

  // Prepare ELO history for chart with best/worst markers
  const eloHistoryData = useMemo(() => {
    if (!elo?.history || elo.history.length === 0) return [];
    
    // Reverse to show chronological order (oldest first)
    const history = [...elo.history].reverse();
    let runningRating = 1000;
    
    const data = history.map((entry, idx) => {
      runningRating = entry.ratingAfter || (runningRating + entry.change);
      return {
        game: idx + 1,
        rating: runningRating,
        change: entry.change,
        placement: entry.placement || null,
        date: entry.date ? new Date(entry.date).toLocaleDateString() : '',
        gameId: entry.gameId || null
      };
    });

    // Find best and worst ratings
    if (data.length > 0) {
      const ratings = data.map(d => d.rating);
      const maxRating = Math.max(...ratings);
      const minRating = Math.min(...ratings);
      
      data.forEach(d => {
        d.isBest = d.rating === maxRating;
        d.isWorst = d.rating === minRating;
      });
    }

    return data;
  }, [elo?.history]);

  // Custom dot renderer for highlighting best/worst
  const renderEloDot = (props) => {
    const { cx, cy, payload } = props;
    if (payload.isBest) {
      return <circle cx={cx} cy={cy} r={6} fill="#1DBF73" stroke="#fff" strokeWidth={2} />;
    }
    if (payload.isWorst) {
      return <circle cx={cx} cy={cy} r={6} fill="#EF4444" stroke="#fff" strokeWidth={2} />;
    }
    return <circle cx={cx} cy={cy} r={3} fill="#4F46E5" />;
  };

  return (
    <div className="elo-rating-card">
      <div className="elo-header">
        <h4 style={{ margin: '0', fontSize: '1rem', fontWeight: '500', color: 'var(--primary)' }}>{t('profile.eloRating')}</h4>
        {eloLoading && <span className="elo-loading">{t('common.loading')}</span>}
      </div>
      
      {hasElo ? (
        <div className="elo-content">
          {/* ELO Progression Chart */}
          {eloHistoryData.length > 1 && (
            <div>
              {/* ELO Metrics */}
              <div style={{
                display: 'flex',
                width: '100%',
                justifyContent: 'space-between',
                gap: 'var(--spacing-md)',
                marginBottom: 'var(--spacing-sm)'
              }}>
                <StatCard title={t('profile.eloRating')} icon={<TrendingUp size={16} />} value={currentRating} />
                <StatCard title={t('profile.peak')} icon={<Trophy size={16} />} value={peakRating} color="green" />
                <StatCard title={t('profile.floor')} icon={<TrendingDown size={16} />} value={floorRating} color="red" />
              </div>

              {/* <h4 style={{ margin: '0 0 var(--spacing-xs) 0', fontSize: '1rem', fontWeight: '500', color: 'var(--primary)' }}>Rating Progression</h4> */}
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={eloHistoryData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis 
                    dataKey="game" 
                    stroke="var(--text)"
                    tick={{ fill: 'var(--text)' }}
                  />
                  <YAxis 
                    stroke="var(--text)"
                    tick={{ fill: 'var(--text)' }}
                    domain={['dataMin - 50', 'dataMax + 50']}
                  />
                  <Tooltip 
                    content={<EloTooltip navigate={navigate} gameType={normalizedGameType} />}
                    wrapperStyle={{ pointerEvents: 'auto' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="rating" 
                    stroke="#4F46E5" 
                    fill="#4F46E5" 
                    fillOpacity={0.2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="rating" 
                    stroke="#4F46E5"
                    strokeWidth={2}
                    dot={renderEloDot}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 'var(--spacing-md)', fontSize: '0.75rem', marginBottom: 'var(--spacing-xs)', justifyContent: 'center' }}>
                <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#1DBF73', marginRight: 4 }}></span>{t('profile.best')}</span>
                <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#EF4444', marginRight: 4 }}></span>{t('profile.worst')}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="elo-no-data">
          <p>{t('profile.playRankedGames')}</p>
        </div>
      )}
    </div>
  );
};

export default PerformanceStatsEnhanced;
