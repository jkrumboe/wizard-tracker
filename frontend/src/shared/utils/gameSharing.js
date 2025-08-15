// Game sharing functionality

/**
 * Generate a shareable link for a game
 * @param {Object} game - The game object to share
 * @returns {string} The shareable URL
 */
export function generateShareableLink(game) {
  const baseUrl = window.location.origin;
  // Use the game ID directly in the URL - much simpler!
  return `${baseUrl}/shared/${game.id}`;
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
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
    const winnerName = game.players?.find(p => p.id === game.winner_id)?.name || 'Unknown';
    const shareData = {
      title: 'Wizard Tracker Game',
      text: `Check out this Wizard game! Winner: ${winnerName} with ${game.final_scores?.[game.winner_id] || 0} points.`,
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
