import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getPlayerById } from "@/shared/api/playerService";
import { TrophyIcon, UsersIcon } from "@/components/ui/Icon";

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
  
  // Check if this is a table game
  const isTableGame = game.gameType === 'table';
  
  // Extract data from either format
  const id = game.id;
  const created_at = game.created_at || game.savedAt || game.lastPlayed || new Date().toISOString();
  
  // For table games, get players from the game data
  const player_ids = isTableGame 
    ? (game.players || [])
    : (game.player_ids || 
       (game.gameState && game.gameState.player_ids) || 
       (game.gameState && game.gameState.players && game.gameState.players.map(p => p.id)) || []);
  
  // Find winner_id from various possible locations
  const winner_id = game.winner_id || 
                 (game.gameState && game.gameState.winner_id) ||
                 (game.gameState && game.gameState.roundData && determineWinner(game.gameState));
  
  const game_mode = isTableGame ? game.name : (game.game_mode || game.mode || (game.gameState && game.gameState.mode) || "Local");
  const total_rounds = game.total_rounds || game.totalRounds || (game.gameState && game.gameState.maxRounds) || 0;
  
  const formattedDate = new Date(created_at).toLocaleString("en-DE", {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
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
      {/* <div className="game-rounds"></div> */}
        <div className="game-info">
          <div className="game-name">
            {isTableGame ? game.name : (game.game_name || "Wizard")}
            <div className="game-winner">
              <TrophyIcon size={12} /> Winner: {isTableGame ? game.winner_name : (playerDetails[winner_id]?.name || "Not determined")}
            </div>
          </div>
          {game.isUploaded ? (
            <span className="mode-badge synced" title="Synced to Cloud">Synced</span>
          ) : isTableGame ? (
            <span className="mode-badge table">Table Game</span>
          ) : (
            <span className={`mode-badge ${(game_mode || 'local').toLowerCase()}`}>{game_mode || 'Local'}</span>
          )}
        </div>
        <div className="game-players">
            {/* <UsersIcon size={12} />{" "} */}
            {isTableGame
              ? Array.isArray(game.players) ? game.players.join(", ") : "No players"
              : game.gameState && game.gameState.players 
                ? game.gameState.players.map(player => player.name || "Unknown Player").join(", ")
                : game.is_local && game.players
                  ? Array.isArray(game.players) && typeof game.players[0] === 'string' 
                    ? game.players.join(", ") 
                    : game.players.map(player => player.name || "Unknown Player").join(", ")
                  : Array.isArray(player_ids)
                    ? player_ids
                        .map(
                          (playerId) =>
                            playerDetails[playerId]?.name || "Unknown Player"
                        )
                        .join(", ")
                    : "No players"}
        </div>
        <div className="actions-game-history">
          <div className="bottom-actions-game-history">
            <div className="game-rounds">Rounds: {total_rounds}</div>
            <div className="game-date"> {formattedDate}
            </div>
          </div>
          <Link to={isTableGame ? `/table/${id}` : `/game/${id}`} className="game-details">
            View Details
          </Link>
        </div>
    </div>
  );
};

export default GameHistoryItem;
