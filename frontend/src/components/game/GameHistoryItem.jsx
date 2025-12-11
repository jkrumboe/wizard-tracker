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
  
  // Find winner_id from various possible locations - support both single ID and array
  const winner_id_raw = game.winner_id || 
                 (game.gameData && game.gameData.totals && game.gameData.totals.winner_id) ||
                 (game.gameState && game.gameState.winner_id) ||
                 (game.gameState && game.gameState.roundData && determineWinner(game.gameState));
  
  // Normalize winner_id to always be an array
  const winner_ids = Array.isArray(winner_id_raw) ? winner_id_raw : (winner_id_raw ? [winner_id_raw] : []);
  
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
  
  // Helper function to determine winner from game state - returns array for draws
  function determineWinner(gameState) {
    if (!gameState || !gameState.roundData || !gameState.roundData.length) return [];
    
    const lastRound = gameState.roundData[gameState.roundData.length - 1];
    if (!lastRound || !lastRound.players) return [];
    
    // Find player(s) with highest score (supports draws)
    let highestScore = -Infinity;
    let winnerIds = [];
    
    lastRound.players.forEach(player => {
      if (player.totalScore > highestScore) {
        highestScore = player.totalScore;
        winnerIds = [player.id];
      } else if (player.totalScore === highestScore && highestScore > -Infinity) {
        winnerIds.push(player.id);
      }
    });
    
    return winnerIds.length === 1 ? winnerIds[0] : winnerIds;
  }
  
  // Get winner name(s) for display
  const getWinnerDisplay = () => {
    if (isTableGame) return game.winner_name || "Not determined";
    if (winner_ids.length === 0) return "Not determined";
    if (winner_ids.length === 1) return playerDetails[winner_ids[0]]?.name || "Not determined";
    
    // Multiple winners (draw)
    const winnerNames = winner_ids.map(id => playerDetails[id]?.name).filter(Boolean);
    if (winnerNames.length === 0) return "Not determined";
    if (winnerNames.length === 2) return `${winnerNames[0]} & ${winnerNames[1]}`;
    return `${winnerNames.slice(0, -1).join(', ')} & ${winnerNames[winnerNames.length - 1]}`;
  };

  return (
    <div className="game-card">
      {/* <div className="game-rounds"></div> */}
        <div className="game-info">
          <div className="game-name">
            {isTableGame ? game.name : (game.game_name || "Wizard")}
            <div className="game-winner">
              {getWinnerDisplay()}
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
