/**
 * Builds the highlight facts from ranked standings and per-round scores.
 * @param {Object} params
 * @param {Array<{name: string, score: number, rank: number}>} params.standings - Players sorted best first
 * @param {Array<Array<{name: string, score: number}>>} params.rounds - Score each player made per round
 * @param {boolean} [params.lowIsBetter] - Whether the lowest round score is the best one
 */
export function computeHighlights({ standings, rounds, lowIsBetter = false }) {
  const leaders = standings.filter(p => p.rank === 1)
  const runnerUp = standings.find(p => p.rank > 1)

  let bestRound = null
  rounds.forEach((round, roundIndex) => {
    round.forEach(({ name, score }) => {
      if (typeof score !== 'number' || Number.isNaN(score)) return
      const isBetter = !bestRound || (lowIsBetter ? score < bestRound.score : score > bestRound.score)
      if (isBetter) bestRound = { score, name, round: roundIndex + 1 }
    })
  })

  return {
    leaders,
    margin: leaders.length === 1 && runnerUp ? Math.abs(leaders[0].score - runnerUp.score) : null,
    roundCount: rounds.length,
    playerCount: standings.length,
    bestRound,
  }
}
