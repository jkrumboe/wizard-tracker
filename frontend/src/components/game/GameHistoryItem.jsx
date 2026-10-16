import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getPlayerById } from "@/shared/api/playerService";
import { TrophyIcon, UsersIcon } from "@/components/ui/Icon";
import { useTranslation } from 'react-i18next';
import GameThumbnail from "@/components/game/GameThumbnail";
import { getGameTemplateName } from "@/shared/utils/templateGames";
import "@/styles/components/history-card.css";

const namesOf = (list) => list.map(player => (typeof player === 'object' ? player?.name : player)).filter(Boolean);

/**
 * One finished game: box art, game name, winner, players and when it was played.
 * The whole card opens the game's details.
 * @param {Object} props
 * @param {Object} props.game - Game in any stored format (v3, legacy, cloud, table)
 * @param {(name: string) => Object|null} [props.findTemplate] - Template lookup for box art
 */
const GameHistoryItem = ({ game, findTemplate }) => {
  const [playerDetails, setPlayerDetails] = useState({});
  const { t } = useTranslation();
  
  useEffect(() => {
    const fetchPlayerDetails = async () => {
      try {
        // Check if v3.0 format (flat structure with players at root)
        if (game && game.version === '3.0' && game.players) {
          const playerMap = {};
          game.players.forEach((player) => {
            playerMap[player.id] = player;
          });
          setPlayerDetails(playerMap);
        }
        // Handle API response with gameData.players
        else if (game && game.gameData && game.gameData.players) {
          const playerMap = {};
          game.gameData.players.forEach((player) => {
            if (typeof player === 'object' && player.id) {
              playerMap[player.id] = player;
            }
          });
          setPlayerDetails(playerMap);
        }
        // Handle cloud games with players array
        else if (game && game.isCloud && game.players && Array.isArray(game.players)) {
          const playerMap = {};
          game.players.forEach((player) => {
            if (typeof player === 'object' && player.id) {
              playerMap[player.id] = player;
            }
          });
          setPlayerDetails(playerMap);
        }
        // Handle legacy format with gameState wrapper
        else if (game && game.gameState && game.gameState.players) {
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
  
  // Check if this is a table-like game
  const isScoreboardGame =
    game.gameType === 'scoreboard'
    || game.gameData?.gameType === 'scoreboard'
    || game.scoreEntryMode === 'twoSideGesture'
    || game.gameData?.scoreEntryMode === 'twoSideGesture'
    || game.rawData?.gameData?.scoreEntryMode === 'twoSideGesture'
    || game.gameTypeName === 'Volleyball'
    || game.gameTypeName === 'Basketball'
    || game.name === 'Volleyball'
    || game.name === 'Basketball'
    || game.id?.startsWith?.('scoreboard_game_');
  const isTableGame = game.gameType === 'table' || isScoreboardGame;
  
  // Check if this is v3.0 format
  const isV3Format = game.version === '3.0';
  
  // Extract data from either format
  const id = game.id;
  const created_at = game.created_at || game.savedAt || game.lastPlayed || new Date().toISOString();
  
  // For table games, get players from the game data
  // For v3.0, players are at root level
  // For legacy, check gameState or root
  const player_ids = isTableGame 
    ? (game.players || [])
    : (game.player_ids || 
       (isV3Format ? (game.players ? game.players.map(p => p.id) : []) :
       ((game.gameState && game.gameState.player_ids) || 
       (game.gameState && game.gameState.players && game.gameState.players.map(p => p.id)) || [])));
  
  const total_rounds = game.total_rounds || game.totalRounds || (game.gameState && game.gameState.maxRounds) || 0;
  
  const formattedDate = new Date(created_at).toLocaleString("en-DE", {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  
  // Helper function to determine winner from final scores
  function determineWinnerFromScores(players, finalScores) {
    if (!players || !finalScores) return [];
    
    let highestScore = -Infinity;
    let winnerIds = [];
    
    players.forEach(player => {
      const score = finalScores[player.id] || finalScores[player.name] || 0;
      if (score > highestScore) {
        highestScore = score;
        winnerIds = [player.id];
      } else if (score === highestScore && highestScore > -Infinity) {
        winnerIds.push(player.id);
      }
    });
    
    return winnerIds;
  }
  
  // Determine winner_ids with multiple fallbacks
  let winner_id_raw = game.winner_ids ||  // From API response (wizard games)
                 game.winner_id || 
                 (game.gameData && game.gameData.winner_ids) ||  // Check gameData.winner_ids
                 (game.gameData && game.gameData.totals && game.gameData.totals.winner_ids) ||
                 (game.gameData && game.gameData.totals && game.gameData.totals.winner_id) ||
                 (game.gameState && game.gameState.winner_id);
  
  // If still no winner, try to determine from final_scores
  if (!winner_id_raw || (Array.isArray(winner_id_raw) && winner_id_raw.length === 0)) {
    const players = game.gameData?.players || game.players || game.gameState?.players;
    const finalScores = game.gameData?.final_scores || game.gameData?.totals?.final_scores || game.final_scores || game.gameState?.final_scores;
    
    if (players && finalScores) {
      winner_id_raw = determineWinnerFromScores(players, finalScores);
    }
  }
  
  // Normalize winner_id to always be an array
  let winner_ids = Array.isArray(winner_id_raw) ? winner_id_raw : (winner_id_raw ? [winner_id_raw] : []);
  
  // Map originalIds to actual player ids if needed
  const players = game.gameData?.players || game.players || game.gameState?.players || [];
  winner_ids = winner_ids.map(winnerId => {
    // Check if this is an originalId that needs to be mapped
    const playerWithOriginalId = players.find(p => p.originalId === winnerId);
    return playerWithOriginalId ? playerWithOriginalId.id : winnerId;
  });

  // Get winner name(s) for display
  const getWinnerDisplay = () => {
    if (isTableGame) return game.winner_name || t('common.notDetermined');
    if (winner_ids.length === 0) return t('common.notDetermined');
    if (winner_ids.length === 1) return playerDetails[winner_ids[0]]?.name || t('common.notDetermined');
    
    // Multiple winners (draw)
    const winnerNames = winner_ids.map(id => playerDetails[id]?.name).filter(Boolean);
    if (winnerNames.length === 0) return t('common.notDetermined');
    if (winnerNames.length === 2) return `${winnerNames[0]} & ${winnerNames[1]}`;
    return `${winnerNames.slice(0, -1).join(', ')} & ${winnerNames[winnerNames.length - 1]}`;
  };

  // Player names across the stored formats (falls back to looked-up players by id)
  const getPlayerNames = () => {
    if (isTableGame) return Array.isArray(game.players) ? namesOf(game.players) : [];
    if (game.gameData?.players) return namesOf(game.gameData.players);
    if (game.isCloud && Array.isArray(game.players)) return namesOf(game.players);
    if (isV3Format && game.players) return namesOf(game.players);
    if (game.gameState?.players) return namesOf(game.gameState.players);
    if (game.is_local && Array.isArray(game.players)) return namesOf(game.players);
    if (Array.isArray(player_ids)) return player_ids.map(playerId => playerDetails[playerId]?.name).filter(Boolean);
    return [];
  };

  const templateName = isTableGame
    ? (game.name || game.gameTypeName)
    : getGameTemplateName({ ...game, gameType: 'wizard' });
  const template = findTemplate?.(templateName) || { name: templateName || t('common.wizard') };
  const displayName = isTableGame ? game.name : (game.game_name || templateName || t('common.wizard'));
  const playerNames = getPlayerNames();
  const detailsPath = isTableGame ? (isScoreboardGame ? `/scoreboard-game/${id}` : `/table-game/${id}`) : `/game/${id}`;

  return (
    <Link to={detailsPath} className="history-card" aria-label={`${displayName}, ${t('gameHistory.viewDetails')}`}>
      <span className="history-card-art" aria-hidden="true">
        <span className="history-card-initial">{(displayName || '?').charAt(0)}</span>
        <GameThumbnail template={template} />
      </span>

      <span className="history-card-body">
        <span className="history-card-top">
          <span className="history-card-name">{displayName}</span>
          <span className="history-card-date">{formattedDate}</span>
        </span>
        <span className="history-card-winner">
          <TrophyIcon size={14} aria-hidden="true" />
          <span>{getWinnerDisplay()}</span>
        </span>
        <span className="history-card-meta">
          <UsersIcon size={13} aria-hidden="true" />
          <span className="history-card-players">
            {playerNames.length > 0 ? playerNames.join(', ') : t('common.noPlayers')}
          </span>
          <span className="history-card-rounds">
            {t(isScoreboardGame ? 'gameHistory.setsCount' : 'gameHistory.roundsCount', { count: total_rounds })}
          </span>
        </span>
      </span>
    </Link>
  );
};

export default GameHistoryItem;
