import {
  createPlayerMatcher,
  getGamePlayers,
  getPlayerScore,
  isLowIsBetter,
  isTableGame as isTableGameType,
  resolveUserGameResult,
} from '@/shared/utils/playerMatching';
import { evaluateAchievements } from '@/shared/utils/achievements';

// Wizard scores live on a known scale, so its win margins are absolute points.
const WIZARD_CLOSE_MARGIN = 10;
const WIZARD_DOMINANT_MARGIN = 50;
// Other games score on arbitrary scales, so margins are relative to the scores.
const RELATIVE_CLOSE_RATIO = 0.05;
const RELATIVE_DOMINANT_RATIO = 0.25;

const TOP_OPPONENTS = 5;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getGameDate = (game) =>
  new Date(game.created_at || game.savedAt || game.lastPlayed || '1970-01-01');

const isCountable = (game) => !game.isPaused && game.gameFinished !== false;

/** Table games score with a points array instead of final_scores. */
const isTableGame = (game) =>
  isTableGameType(game) || Boolean(game.gameData?.players && !game.gameData?.final_scores);

/** Key an opponent consistently across games - stable ids first, then the name. */
const getOpponentKey = (opponent) =>
  String(opponent.identityId || opponent.userId || opponent.name?.trim() || opponent.id);

/**
 * Classify a win as close and/or dominant from the gap to the runner-up.
 * @returns {{ close: boolean, dominant: boolean }}
 */
const classifyWinMargin = (game, players, tableGame) => {
  const lowIsBetter = isLowIsBetter(game);
  const scores = players
    .map((_, idx) => getPlayerScore(game, players, idx))
    .filter((score) => score !== null)
    .sort((a, b) => (lowIsBetter ? a - b : b - a));

  if (scores.length < 2) return { close: false, dominant: false };

  const margin = Math.abs(scores[0] - scores[1]);
  if (margin === 0) return { close: false, dominant: false };

  if (!tableGame) {
    return {
      close: margin < WIZARD_CLOSE_MARGIN,
      dominant: margin >= WIZARD_DOMINANT_MARGIN,
    };
  }

  const scale = Math.max(Math.abs(scores[0]), Math.abs(scores[1]), 1);
  return {
    close: margin <= Math.max(1, scale * RELATIVE_CLOSE_RATIO),
    dominant: margin / scale >= RELATIVE_DOMINANT_RATIO,
  };
};

/**
 * Compare the user's final score with an opponent's.
 * @returns {'ahead'|'behind'|'tied'|null} null when either score is unknown
 */
const compareFinish = (myScore, theirScore, lowIsBetter) => {
  if (myScore === null || theirScore === null) return null;
  if (myScore === theirScore) return 'tied';
  const ahead = lowIsBetter ? myScore < theirScore : myScore > theirScore;
  return ahead ? 'ahead' : 'behind';
};

/**
 * Walk the round data of one game for bid accuracy and comeback detection.
 */
const analyzeRounds = (game, isCurrentPlayer, playerId) => {
  const roundData =
    game.round_data ||
    game.gameData?.round_data ||
    game.gameState?.round_data ||
    game.gameState?.roundData;
  if (!Array.isArray(roundData)) return null;

  let correct = 0;
  let total = 0;
  // Running totals per player, used to spot whether the player was ever last
  const runningTotals = {};
  const lowIsBetter = isLowIsBetter(game);
  let wasInLastPlace = false;

  roundData.forEach((round, roundIndex) => {
    if (!Array.isArray(round.players)) return;

    const roundPlayer = round.players.find((p) => isCurrentPlayer(p) || p.id === playerId);

    if (roundPlayer && roundPlayer.call !== null && roundPlayer.made !== null) {
      total++;
      if (roundPlayer.call === roundPlayer.made) correct++;
    }

    // Standings after this round
    round.players.forEach((p) => {
      const key = p.id ?? p.name;
      if (key === undefined || key === null) return;
      runningTotals[key] = (runningTotals[key] || 0) + (parseFloat(p.score) || 0);
    });

    const myKey = roundPlayer?.id ?? roundPlayer?.name;
    const otherTotals = Object.entries(runningTotals)
      .filter(([key]) => key !== String(myKey))
      .map(([, value]) => value);

    // Only from the second round on - being last after a single round means little
    if (roundIndex >= 1 && myKey !== undefined && myKey !== null && otherTotals.length > 0) {
      const myTotal = runningTotals[myKey] ?? 0;
      const isLast = lowIsBetter
        ? otherTotals.every((value) => myTotal > value)
        : otherTotals.every((value) => myTotal < value);
      if (isLast) wasInLastPlace = true;
    }
  });

  return { correct, total, wasInLastPlace };
};

/**
 * Calculate the full performance statistics for one user over a set of games.
 *
 * Games the user can't be found in, or whose result can't be determined, are
 * left out entirely (matching `calculateGameStats`) rather than counted as
 * losses, so the overview and the stats tab always agree.
 *
 * @param {Array} games - Wizard and/or table games
 * @param {Object} currentPlayer - User to evaluate (ids, names, identities)
 * @param {Object} [options]
 * @param {boolean} [options.isWizardGame=true] - Include bid-based achievements
 * @returns {Object|null} null when there is nothing to evaluate
 */
export const calculatePerformanceStats = (games, currentPlayer, { isWizardGame = true } = {}) => {
  if (!games || games.length === 0) return null;

  // Resolving which player is the current user lives in one place - see
  // @/shared/utils/playerMatching. It matches identity ids first, then account
  // ids, then names, and ignores fields that are missing on either side so an
  // absent id can never make the first player of a game look like the user.
  const matcher = createPlayerMatcher(currentPlayer);
  const isCurrentPlayer = (p) => matcher.matches(p);

  // Oldest first for chronological performance; resolve the user's own player
  // once per game - the score, the win and every per-player stat below must
  // all describe the same person.
  const evaluatedGames = games
    .filter(isCountable)
    .sort((a, b) => getGameDate(a) - getGameDate(b))
    .map((game) => ({ game, ...resolveUserGameResult(game, matcher) }))
    .filter((entry) => entry.playerIndex !== -1 && typeof entry.won === 'boolean');

  if (evaluatedGames.length === 0) return null;

  const overallLowIsBetter = isLowIsBetter(evaluatedGames[0].game);

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
  let perfectGames = 0;
  let totalBids = 0;
  let correctBids = 0;
  let comebackWins = 0;
  let closeWins = 0;
  let dominantWins = 0;
  let bestPerfectRoundsInGame = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let winStreak = 0;
  let lossStreak = 0;
  let bestGame = null;
  let worstGame = null;
  const dayOfWeekWins = Object.fromEntries(DAYS.map((day) => [day, 0]));
  const dayOfWeekGames = Object.fromEntries(DAYS.map((day) => [day, 0]));
  const hourlyPerformance = Array.from({ length: 24 }, () => ({ games: 0, wins: 0 }));

  evaluatedGames.forEach(({ game, playerIndex, player, won }, index) => {
    const gameNumber = index + 1;
    const gamePlayers = getGamePlayers(game) || [];
    const tableGame = isTableGame(game);
    const lowIsBetter = isLowIsBetter(game);
    const gameDate = getGameDate(game);
    const playerScore = getPlayerScore(game, gamePlayers, playerIndex) ?? 0;

    totalScore += playerScore;
    highestScore = Math.max(highestScore, playerScore);
    lowestScore = Math.min(lowestScore, playerScore);

    // Best/worst game - first occurrence wins ties, so exactly one game is marked
    const gameSummary = {
      game: gameNumber,
      score: playerScore,
      date: game.created_at || game.savedAt,
      name: game.name,
    };
    const beats = (a, b) => (overallLowIsBetter ? a < b : a > b);
    if (!bestGame || beats(playerScore, bestGame.score)) bestGame = gameSummary;
    if (!worstGame || beats(worstGame.score, playerScore)) worstGame = gameSummary;

    totalRounds +=
      game.totalRounds ||
      game.total_rounds ||
      game.gameData?.total_rounds ||
      game.gameState?.total_rounds ||
      game.gameState?.maxRounds ||
      0;

    if (won) {
      wins++;
      winStreak++;
      lossStreak = 0;
      longestWinStreak = Math.max(longestWinStreak, winStreak);
    } else {
      losses++;
      lossStreak++;
      winStreak = 0;
      longestLossStreak = Math.max(longestLossStreak, lossStreak);
    }

    // Performance by player count
    const playerCount = gamePlayers.length || game.playerCount || 0;
    if (playerCount > 0) {
      const bucket = (performanceByPlayerCount[playerCount] ||= { games: 0, wins: 0, totalScore: 0 });
      bucket.games++;
      if (won) bucket.wins++;
      bucket.totalScore += playerScore;
    }

    // Head-to-head: did the user finish ahead of each opponent in this game?
    gamePlayers.forEach((opponent, opponentIdx) => {
      // Skip the current user's own slot (matched above), not merely anyone
      // who happens to share one of their identifiers
      if (opponentIdx === playerIndex || isCurrentPlayer(opponent)) return;

      const key = getOpponentKey(opponent);
      const entry = (headToHeadStats[key] ||= {
        name: opponent.name || opponent.username || 'Unknown',
        userId: opponent.userId,
        games: 0,
        wins: 0,
        losses: 0,
        ahead: 0,
        behind: 0,
        tied: 0,
        lastPlayed: null,
      });
      entry.games++;
      if (won) entry.wins++;
      else entry.losses++;
      entry.lastPlayed = gameDate;

      const finish = compareFinish(
        playerScore,
        getPlayerScore(game, gamePlayers, opponentIdx),
        lowIsBetter
      );
      // Without both scores, a win still means the user finished ahead
      if (finish) entry[finish]++;
      else if (won) entry.ahead++;
    });

    // Bid accuracy and comebacks from the round data
    let gameBidAccuracy = null;
    const rounds = analyzeRounds(game, isCurrentPlayer, player?.id ?? null);
    if (rounds) {
      totalBids += rounds.total;
      correctBids += rounds.correct;
      if (rounds.total > 0) {
        gameBidAccuracy = (rounds.correct / rounds.total) * 100;
        // Every round of the game bid correctly
        if (rounds.correct === rounds.total) perfectGames++;
      }
      bestPerfectRoundsInGame = Math.max(bestPerfectRoundsInGame, rounds.correct);
      // Comeback: dead last at some point during the game and still won it
      if (won && rounds.wasInLastPlace) comebackWins++;
    }

    if (won && gamePlayers.length >= 2) {
      const margin = classifyWinMargin(game, gamePlayers, tableGame);
      if (margin.close) closeWins++;
      if (margin.dominant) dominantWins++;
    }

    // Time-based stats
    const day = DAYS[gameDate.getDay()];
    dayOfWeekGames[day]++;
    if (won) dayOfWeekWins[day]++;
    hourlyPerformance[gameDate.getHours()].games++;
    if (won) hourlyPerformance[gameDate.getHours()].wins++;

    performanceData.push({
      game: gameNumber,
      score: playerScore,
      date: gameDate.toLocaleDateString(),
      winRate: ((wins / gameNumber) * 100).toFixed(1),
      bidAccuracy: gameBidAccuracy !== null ? parseFloat(gameBidAccuracy.toFixed(1)) : null,
      gameId: game._id || game.id || game.gameId,
      isTableGame: tableGame,
      gameType: game.gameType || (tableGame ? 'table' : 'wizard'),
    });

    winLossData.push({
      game: gameNumber,
      result: won ? 'win' : 'loss',
      wins,
      losses,
      date: gameDate.toLocaleDateString(),
    });
  });

  const totalGames = evaluatedGames.length;
  const winRate = (wins / totalGames) * 100;
  const bidAccuracy = totalBids > 0 ? (correctBids / totalBids) * 100 : 0;

  const gamesWithBidAccuracy = performanceData.filter((g) => g.bidAccuracy !== null);
  const bestBidAccuracyGame = gamesWithBidAccuracy.reduce(
    (best, curr) => (!best || curr.bidAccuracy > best.bidAccuracy ? curr : best),
    null
  );
  const worstBidAccuracyGame = gamesWithBidAccuracy.reduce(
    (worst, curr) => (!worst || curr.bidAccuracy < worst.bidAccuracy ? curr : worst),
    null
  );

  // Recent trend - last five games against the five before them
  let recentTrend = 'neutral';
  if (winLossData.length >= 10) {
    const countWins = (list) => list.filter((d) => d.result === 'win').length;
    const recentWins = countWins(winLossData.slice(-5));
    const previousWins = countWins(winLossData.slice(-10, -5));
    if (recentWins > previousWins) recentTrend = 'improving';
    else if (recentWins < previousWins) recentTrend = 'declining';
  }

  // Win rate per table size, against the 1-in-N share a player would expect
  const playerCountData = Object.entries(performanceByPlayerCount)
    .map(([count, data]) => ({
      count: Number(count),
      playerCount: `${count}P`,
      winRate: ((data.wins / data.games) * 100).toFixed(1),
      expectedWinRate: Math.round(100 / Number(count)),
      avgScore: (data.totalScore / data.games).toFixed(1),
      games: data.games,
    }))
    .sort((a, b) => a.count - b.count);

  const dayOfWeekData = DAYS.map((day) => ({
    day,
    winRate: dayOfWeekGames[day] > 0 ? ((dayOfWeekWins[day] / dayOfWeekGames[day]) * 100).toFixed(1) : 0,
    games: dayOfWeekGames[day],
  }));

  const hourlyData = hourlyPerformance
    .map((data, hour) => ({
      hour: `${hour}:00`,
      winRate: data.games > 0 ? ((data.wins / data.games) * 100).toFixed(1) : 0,
      games: data.games,
    }))
    .filter((d) => d.games > 0);

  // Most-played opponents, with the user's finishing record against each
  const topOpponents = Object.entries(headToHeadStats)
    .map(([key, data]) => {
      const decided = data.ahead + data.behind + data.tied;
      return {
        key,
        ...data,
        winRate: ((data.wins / data.games) * 100).toFixed(1),
        aheadRate: decided > 0 ? Math.round((data.ahead / decided) * 100) : null,
      };
    })
    .sort((a, b) => b.games - a.games || b.lastPlayed - a.lastPlayed)
    .slice(0, TOP_OPPONENTS);

  const opponentCount = Object.keys(headToHeadStats).length;

  const achievements = evaluateAchievements(
    {
      totalGames,
      wins,
      winRateValue: winRate,
      longestWinStreak,
      correctBidRounds: correctBids,
      totalBidRounds: totalBids,
      bidAccuracyValue: bidAccuracy,
      bestPerfectRoundsInGame,
      perfectGames,
      dominantWins,
      closeWins,
      comebackWins,
      opponentCount,
      totalRounds,
    },
    { includeBidAchievements: isWizardGame }
  );

  return {
    totalGames,
    wins,
    losses,
    winRate: winRate.toFixed(1),
    averageScore: (totalScore / totalGames).toFixed(1),
    highestScore,
    lowestScore,
    isLowIsBetter: overallLowIsBetter,
    totalRounds,
    averageRoundsPerGame: (totalRounds / totalGames).toFixed(1),
    performanceOverTime: performanceData,
    winLossOverTime: winLossData,
    recentTrend,
    currentStreak: winStreak > 0
      ? { type: 'win', count: winStreak }
      : { type: 'loss', count: lossStreak },
    longestWinStreak,
    longestLossStreak,
    bestGame,
    worstGame,
    bestBidAccuracyGame,
    worstBidAccuracyGame,
    playerCountData,
    dayOfWeekData,
    hourlyData,
    topOpponents,
    bidAccuracy: bidAccuracy.toFixed(1),
    perfectBids: perfectGames,
    perfectGames,
    bestPerfectRoundsInGame,
    opponentCount,
    achievements,
    unlockedAchievements: achievements.filter((a) => a.unlocked).length,
    comebackWins,
    closeWins,
    dominantWins,
  };
};
