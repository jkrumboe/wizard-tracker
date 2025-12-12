// Game sharing functionality

/**
 * Generate a shareable link for a game
 * @param {Object} game - The game object to share
 * @returns {string} The shareable URL
 */
export function generateShareableLink(game) {
  const baseUrl = globalThis.location.origin;
  
  // For imported/shared games, use the original game ID for sharing
  // This allows re-sharing of imported games
  let gameIdToShare = game.id;
  
  // Check if this is an imported game with an original ID
  // Support both v3.0 format (flat) and legacy format (nested gameState)
  if (game.originalGameId) {
    gameIdToShare = game.originalGameId;
  } else if (game._internalState?.originalGameId) {
    // v3.0 format stores internal state separately
    gameIdToShare = game._internalState.originalGameId;
  } else if (game.gameState?.originalGameId) {
    // Legacy format with gameState wrapper
    gameIdToShare = game.gameState.originalGameId;
  }
  
  // Use the game ID directly in the URL - much simpler!
  return `${baseUrl}/shared/${gameIdToShare}`;
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && globalThis.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Share using native Web Share API if available
 * @param {string} url - URL to share
 * @param {Object} game - Game object for title/text
 * @returns {Promise<boolean>} Success status
 */
export async function shareNatively(url, game) {
  if (!navigator.share) {
    return false; // Web Share API not supported
  }

  try {
    // Handle both direct and nested game structures
    const players = game.players || game.gameState?.players || [];
    const winnerIdRaw = game.winner_ids || game.gameData?.totals?.winner_ids || game.gameData?.winner_ids || game.gameState?.winner_ids ||
                       game.winner_id || game.gameData?.totals?.winner_id || game.gameState?.winner_id;
    const winnerIds = Array.isArray(winnerIdRaw) ? winnerIdRaw : (winnerIdRaw ? [winnerIdRaw] : []);
    const finalScores = game.final_scores || game.gameData?.totals?.final_scores || game.gameState?.final_scores || {};
    
    // console.debug('Share debug - Players:', players);
    // console.debug('Share debug - Winner IDs:', winnerIds);
    // console.debug('Share debug - Final Scores:', finalScores);
    
    const winnerNames = winnerIds.map(id => players.find(p => p.id === id)?.name).filter(Boolean);
    const winnerDisplay = winnerNames.length === 0 ? 'Unknown' :
                         winnerNames.length === 1 ? winnerNames[0] :
                         winnerNames.length === 2 ? `${winnerNames[0]} & ${winnerNames[1]}` :
                         `${winnerNames.slice(0, -1).join(', ')} & ${winnerNames[winnerNames.length - 1]}`;
    const winnerScore = winnerIds.length > 0 ? (finalScores[winnerIds[0]] || 0) : 0;
    
    // console.debug('Share debug - Winner Display:', winnerDisplay);
    // console.debug('Share debug - Winner Score:', winnerScore);
    
    const shareData = {
      title: 'Wizard Tracker',
      text: `Check out this Wizard game! Winner: ${winnerDisplay} with ${winnerScore} points.`,
      url: url
    };

    await navigator.share(shareData);
    return true;
  } catch (error) {
    if (error.name === 'AbortError') {
      // User cancelled sharing
      return false;
    }
    console.error('Native sharing failed:', error);
    return false;
  }
}

/**
 * Handle sharing a game with both clipboard and native sharing
 * @param {Object} game - Game object to share
 * @returns {Promise<{success: boolean, method: string, url: string}>}
 */
export async function shareGame(game) {
  console.debug('shareGame called with:', game);
  console.debug('Game ID:', game.id);
  
  const url = generateShareableLink(game);
  console.debug('Generated shareable URL:', url);
  
  // Try native sharing first on mobile devices
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    const nativeSuccess = await shareNatively(url, game);
    if (nativeSuccess) {
      return { success: true, method: 'native', url };
    }
  }
  
  // Fallback to clipboard
  const clipboardSuccess = await copyToClipboard(url);
  return { 
    success: clipboardSuccess, 
    method: 'clipboard', 
    url 
  };
}
