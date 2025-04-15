import { Link } from "react-router-dom"
import defaultAvatar from "../assets/default-avatar.png"

const PlayerCard = ({ player, onClick, showStats = true }) => {
  if (!player) return null

  const { id, name, avatar, elo, winRate, totalGames, tags } = player

  // If onClick is provided, render as a clickable card, otherwise as a link
  const CardWrapper = onClick ? "div" : Link
  const cardProps = onClick
    ? { onClick: () => onClick(player), className: "player-card" }
    : { to: `/profile/${id}`, className: "player-card" }

  return (
    <CardWrapper {...cardProps}>
      <div className="player-card-content">
        <img src={avatar || defaultAvatar} alt={name} className="player-avatar" />
        <div className="player-info">
          <h3 className="player-name">{name}</h3>

          {showStats && (
            <div className="player-stats">
              <div className="stat">
                <span className="stat-label">ELO</span>
                <span className="stat-value">{elo}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Win Rate</span>
                <span className="stat-value">{winRate}%</span>
              </div>
              <div className="stat">
                <span className="stat-label">Games</span>
                <span className="stat-value">{totalGames}</span>
              </div>
            </div>
          )}

          {tags && tags.length > 0 && (
            <div className="player-tags">
              {tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </CardWrapper>
  )
}

export default PlayerCard

