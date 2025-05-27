import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getPlayerById } from "../services/playerService";

const GameHistoryItem = ({ game }) => {
  const [playerDetails, setPlayerDetails] = useState({});

  useEffect(() => {
    const fetchPlayerDetails = async () => {
      try {
        if (game && game.player_ids) {
          const playerPromises = game.player_ids.map((playerId) =>
            getPlayerById(playerId)
          );
          const players = await Promise.all(playerPromises);

          const playerMap = {};
          players.forEach((player) => {
            if (player) {
              playerMap[player.id] = player;
            }
          });

          setPlayerDetails(playerMap);
        }
      } catch (error) {
        console.error("Error fetching player details:", error);
      }
    };

    fetchPlayerDetails();
  }, [game]);

  if (!game) return null;

  const { id, created_at, player_ids, winner_id, game_mode, total_rounds } = game;
  const formattedDate = new Date(created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="game-card">

      <div className="game-date">Finished: {formattedDate}</div>
      <div className="game-rounds">Rounds: {total_rounds}</div>
      <div className="game-winner">
        Winner: {playerDetails[winner_id]?.name || "Unknown"}
      </div>
      <div className="game-players">
        Players:{" "}
        {Array.isArray(player_ids)
          ? player_ids
              .map(
                (playerId) =>
                  playerDetails[playerId]?.name || "Unknown Player"
              )
              .join(", ")
          : "No players"}
      </div>
      <Link to={`/game/${id}`} className="game-details">
        View Details
      </Link>
      <span className={`mode-badge ${game_mode.toLowerCase()}`}>
        {game_mode}
      </span>

    </div>
  );
};

export default GameHistoryItem;
