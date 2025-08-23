// Shared game service for handling shared games in Appwrite
import { Client, Databases, Query } from 'appwrite';

// Initialize Appwrite client for shared game access
const client = new Client();
client
  .setEndpoint(import.meta.env.VITE_APPWRITE_PUBLIC_ENDPOINT || 'https://appwrite.jkrumboe.dev/v1')
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID || '688cd65e00060f0e4d43');

// Note: For shared games, we rely on the collections having proper read permissions
// for anonymous/guest users, since API keys cannot be used in frontend code

const databases = new Databases(client);

// Configuration
const config = {
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID || '688cfb4b002d001bc2e5',
  collections: {
    games: 'games',
    players: 'players',
    rounds: 'rounds',
    roundPlayers: 'roundPlayers'
  }
};

/**
 * Store a shared game reference in the cloud
 * @param {Object} game - The game object to make shareable
 * @param {string} shareId - The unique share identifier
 * @returns {Promise<Object>} The shared game record
 */
export async function createSharedGameRecord(game, shareId) {
  // No need to store anything - we'll reconstruct from existing game data
  console.debug('Game sharing enabled for:', { shareId, gameId: game.id });
  
  return {
    success: true,
    shareId: shareId,
    gameId: game.id
  };
}

/**
 * Get the full game data for a shared game by reconstructing it from Appwrite collections
 * @param {string} originalGameId - The original game ID (extId in Appwrite)
 * @returns {Promise<Object|null>} The reconstructed complete game data
 */
export async function getSharedGameData(originalGameId) {
  try {
    console.debug('Reconstructing game data for:', originalGameId);
    
    // 1. Get the game record
    const gameResult = await databases.listDocuments(
      config.databaseId,
      config.collections.games,
      [Query.equal('extId', originalGameId)]
    );

    if (gameResult.documents.length === 0) {
      console.debug('Game not found with extId:', originalGameId);
      return null;
    }

    const gameDoc = gameResult.documents[0];
    console.debug('Found game document:', gameDoc);

    // 2. Get all players for this game using the playerIds array
    const playerDocs = [];
    if (gameDoc.playerIds && gameDoc.playerIds.length > 0) {
      // Query players by their document IDs
      const playersResult = await databases.listDocuments(
        config.databaseId,
        config.collections.players,
        [Query.equal('$id', gameDoc.playerIds)]
      );
      playerDocs.push(...playersResult.documents);
    }

    console.debug('Found players:', playerDocs);

    // 3. Get all rounds for this game
    const roundsResult = await databases.listDocuments(
      config.databaseId,
      config.collections.rounds,
      [Query.equal('gameId', gameDoc.$id)]
    );

    console.debug('Found rounds:', roundsResult.documents);

    // 4. Get all round players data for this game
    const roundPlayersResult = await databases.listDocuments(
      config.databaseId,
      config.collections.roundPlayers,
      [Query.equal('gameId', gameDoc.$id)]
    );

    console.debug('Found round players:', roundPlayersResult.documents);

    // 5. Reconstruct the game data
    const reconstructedGame = reconstructGameFromAppwriteData(
      gameDoc,
      playerDocs,
      roundsResult.documents,
      roundPlayersResult.documents
    );

    console.debug('Reconstructed game:', reconstructedGame);
    return reconstructedGame;

  } catch (error) {
    console.error('Failed to get shared game data:', error);
    throw new Error('Failed to load shared game');
  }
}

/**
 * Reconstruct the complete game object from Appwrite data
 * @param {Object} gameDoc - Game document from Appwrite
 * @param {Array} playerDocs - Player documents
 * @param {Array} roundDocs - Round documents  
 * @param {Array} roundPlayerDocs - Round player documents
 * @returns {Object} Complete game object in the original format
 */
function reconstructGameFromAppwriteData(gameDoc, playerDocs, roundDocs, roundPlayerDocs) {
  // Create player lookup maps
  const playerById = {};
  const playerNameById = {};
  
  playerDocs.forEach(player => {
    playerById[player.$id] = player;
    playerNameById[player.$id] = player.name;
  });

  // Reconstruct players array with original IDs
  const players = playerDocs.map(player => ({
    id: player.extId, // Use the original player ID
    name: player.name
  }));


  // Build a map of roundNumber to round object for quick lookup
  const roundByNumber = {};
  roundDocs.forEach(round => {
    roundByNumber[round.roundNumber] = round;
  });

  // Build a map of roundNumber to all roundPlayerDocs for that round
  const roundPlayersByRound = {};
  roundPlayerDocs.forEach(rp => {
    if (!roundPlayersByRound[rp.roundNumber]) roundPlayersByRound[rp.roundNumber] = [];
    roundPlayersByRound[rp.roundNumber].push(rp);
  });

  // Ensure all rounds up to total_rounds are present, and all players are included in each round
  const totalRounds = gameDoc.totalRounds || (roundDocs.length > 0 ? Math.max(...roundDocs.map(r => r.roundNumber)) : 0);
  const allPlayerIds = playerDocs.map(p => p.$id);
  const allPlayerExtIds = playerDocs.map(p => p.extId);

  const round_data = [];
  for (let roundNum = 1; roundNum <= totalRounds; roundNum++) {
    const round = roundByNumber[roundNum] || { roundNumber: roundNum, cards: roundNum };
    const roundPlayers = roundPlayersByRound[roundNum] || [];

    // Map of playerId (Appwrite) to roundPlayerDoc
    const roundPlayerMap = {};
    roundPlayers.forEach(rp => { roundPlayerMap[rp.playerId] = rp; });

    // For each player, ensure an entry exists (fill with zeros if missing)
    const roundPlayersData = allPlayerIds.map((playerId, idx) => {
      const rp = roundPlayerMap[playerId];
      const extId = allPlayerExtIds[idx];
      const name = playerNameById[playerId];
      return {
        id: extId,
        name,
        call: rp ? rp.call : 0,
        made: rp ? rp.made : 0,
        score: rp ? rp.score : 0,
        totalScore: rp ? rp.totalScore : 0
      };
    });

    round_data.push({
      round: roundNum,
      cards: round.cards,
      players: roundPlayersData
    });
  }

  // Parse final scores
  const final_scores = {};
  try {
    const parsedScores = JSON.parse(gameDoc.finalScoresJson || '{}');
    console.debug('Parsed final scores from JSON:', parsedScores);
    
    // The finalScoresJson already contains original player IDs, not Appwrite IDs
    // So we can use it directly
    Object.assign(final_scores, parsedScores);
  } catch (error) {
    console.error('Failed to parse final scores:', error);
  }

  // Find winner using original player ID
  let winner_id = null;
  if (gameDoc.winnerPlayerId) {
    const winnerPlayer = playerById[gameDoc.winnerPlayerId];
    if (winnerPlayer) {
      winner_id = winnerPlayer.extId;
    }
  }

  // Reconstruct the complete game object
  return {
    id: gameDoc.extId,
    players: players,
    winner_id: winner_id,
    final_scores: final_scores,
    round_data: round_data,
    total_rounds: gameDoc.totalRounds,
    created_at: gameDoc.$createdAt,
    game_mode: gameDoc.gameMode || 'online',
    duration_seconds: null, // Not stored in Appwrite schema
    // Mark as shared
    isShared: true,
    sharedFrom: 'cloud',
    // Add properties needed for GameDetails.jsx compatibility
    is_local: true,
    player_ids: players.map(p => p.id)
  };
}

/**
 * Import a shared game into local storage
 * @param {Object} gameData - The reconstructed game data
 * @param {Object} shareInfo - Information about the share (contains gameId, timestamp)
 * @returns {Promise<string>} The new local game ID
 */
export async function importSharedGame(gameData, shareInfo) {
  const { LocalGameStorage } = await import('../api/localGameStorage');
  
  try {
    // Check if this game was already imported
    const existingGames = LocalGameStorage.getAllSavedGames();
    const alreadyImported = Object.values(existingGames).some(game => {
      return game.originalGameId === shareInfo.gameId || 
             game.gameState?.originalGameId === shareInfo.gameId;
    });
    
    if (alreadyImported) {
      throw new Error('This game has already been imported');
    }
    
    // Create a new game ID for the imported game
    const newGameId = `shared_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Prepare the game data for local storage
    const localGameData = {
      ...gameData,
      gameId: newGameId, // Add gameId field that LocalGameStorage expects
      // Mark as imported from share
      isShared: true,
      isImported: true,
      originalGameId: shareInfo.gameId,
      importedAt: new Date().toISOString(),
      sharedFrom: `Shared game from ${gameData.players?.find(p => p.id === gameData.winner_id)?.name || 'Unknown'}`,
      // Clean up any Appwrite-specific fields that might have leaked through
      $id: undefined,
      $createdAt: undefined,
      $updatedAt: undefined,
      // Add properties needed for GameDetails.jsx compatibility
      is_local: true,
      player_ids: gameData.players?.map(p => p.id) || []
    };

    // Save to local storage - saveGame(gameState, gameName, isPaused)
    const savedGameId = LocalGameStorage.saveGame(
      localGameData, 
      `Shared: ${gameData.players?.find(p => p.id === gameData.winner_id)?.name || 'Unknown'} won`, 
      false // isPaused = false since this is a finished game
    );
    
    return savedGameId;
  } catch (error) {
    console.error('Failed to import shared game:', error);
    throw new Error('Failed to import shared game');
  }
}
