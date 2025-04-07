import { Link } from "react-router-dom"

const GameHistoryItem = ({ game }) => {
  if (!game) return null

  const { id, date, players, winner } = game

  return (
    <div className="game-card">
      <div className="game-date">{date}</div>
      <div className="game-winner">Winner: {winner}</div>
      <div className="game-players">Players: {Array.isArray(players) ? players.join(", ") : players}</div>
      <Link to={`/game/${id}`} className="game-details">
        View Details
      </Link>
    </div>
  )
}

export default GameHistoryItem

