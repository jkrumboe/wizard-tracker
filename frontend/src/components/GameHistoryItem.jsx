import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { playerAPI } from "../services/api";

const GameHistoryItem = ({ game }) => {
  const [playerDetails, setPlayerDetails] = useState({});

  useEffect(() => {
    const fetchPlayerDetails = async () => {
      try {
        if (game && game.players) {
          const playerPromises = game.players.map((playerId) =>
            playerAPI.getById(playerId)
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

  const { id, date, players, winner } = game;

  return (
    <div className="game-card">
      <div className="game-date">{date}</div>
      <div className="game-winner">
        Winner: {playerDetails[winner]?.name || "Unknown"}
      </div>
      <div className="game-players">
        Players:{" "}
        {Array.isArray(players)
          ? players
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
    </div>
  );
};

export default GameHistoryItem;
