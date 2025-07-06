import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getPlayerById } from "../services/playerService";

const GameHistoryItem = ({ game }) => {
  const [playerDetails, setPlayerDetails] = useState({});
  
  useEffect(() => {
    const fetchPlayerDetails = async () => {
      try {
        // Handle games saved with LocalGameStorage format
        if (game && game.gameState && game.gameState.players) {
          const playerMap = {};
          game.gameState.players.forEach((player) => {
            playerMap[player.id] = player;
          });
          setPlayerDetails(playerMap);
        }
        // Handle legacy local games
        else if (game && game.is_local && game.players) {
          const playerMap = {};
          game.players.forEach((player) => {
            playerMap[player.id] = player;
          });
          setPlayerDetails(playerMap);
        } 
        // Otherwise fetch from the server for online games
        else if (game && game.player_ids) {
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
  
  // Extract data from either format
  const id = game.id;
  const created_at = game.created_at || game.savedAt || new Date().toISOString();
  const player_ids = game.player_ids || 
                   (game.gameState && game.gameState.player_ids) || 
                   (game.gameState && game.gameState.players && game.gameState.players.map(p => p.id)) || [];
  
  // Find winner_id from various possible locations
  const winner_id = game.winner_id || 
                 (game.gameState && game.gameState.winner_id) ||
                 (game.gameState && game.gameState.roundData && determineWinner(game.gameState));
  
  const game_mode = game.game_mode || game.mode || (game.gameState && game.gameState.mode) || "Local";
  const total_rounds = game.total_rounds || game.totalRounds || (game.gameState && game.gameState.maxRounds) || 0;
  
  const formattedDate = new Date(created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  
  // Helper function to determine winner from game state
  function determineWinner(gameState) {
    if (!gameState || !gameState.roundData || !gameState.roundData.length) return null;
    
    const lastRound = gameState.roundData[gameState.roundData.length - 1];
    if (!lastRound || !lastRound.players) return null;
    
    // Find player with highest score
    let highestScore = -Infinity;
    let winnerId = null;
    
    lastRound.players.forEach(player => {
      if (player.totalScore > highestScore) {
        highestScore = player.totalScore;
        winnerId = player.id;
      }
    });
    
    return winnerId;
  }

  return (
    <div className="game-card">
      <div className="game-date">Finished: {formattedDate} | Rounds: {total_rounds}</div>
      {/* <div className="game-rounds"></div> */}
      <div className="game-info">
        <div className="game-winner">
          Winner: {playerDetails[winner_id]?.name || "Unknown"}
        </div>
          <div className="game-players">
            Players:{" "}
            {game.gameState && game.gameState.players 
              ? game.gameState.players.map(player => player.name || "Unknown Player").join(", ")
              : game.is_local && game.players
                ? game.players.map(player => player.name || "Unknown Player").join(", ")
                : Array.isArray(player_ids)
                  ? player_ids
                      .map(
                        (playerId) =>
                          playerDetails[playerId]?.name || "Unknown Player"
                      )
                      .join(", ")
                  : "No players"}
          </div>
        <div className="bottom-game-history">
          <Link to={`/game/${id}`} className="game-details">
            View Details
          </Link>
          <span className={`mode-badge ${(game_mode || 'local').toLowerCase()}`}>
            {game_mode || 'Local'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GameHistoryItem;
