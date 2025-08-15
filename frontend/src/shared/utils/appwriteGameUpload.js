/**
 * Frontend Appwrite Game Upload Service
 * Uploads local Wizard Tracker games to Appwrite instance
 */

// Import the actual Appwrite SDK for frontend
import { Client, Databases, Query, ID } from 'appwrite';

/**
 * Configuration from environment variables
 */
const config = {
  endpoint: import.meta.env.VITE_APPWRITE_PUBLIC_ENDPOINT || 'https://appwrite.jkrumboe.dev/v1',
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID || '688cd65e00060f0e4d43',
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID || '688cfb4b002d001bc2e5',
  // For game uploads, we need API key access (normally this would be backend-only)
  apiKey: import.meta.env.VITE_APPWRITE_API_KEY || import.meta.env.APPWRITE_API_KEY,
  collections: {
    players: 'players',
    games: 'games',
    rounds: 'rounds',
    roundPlayers: 'roundPlayers'
  }
};

/**
 * Frontend Appwrite Game Uploader Class
 */
class FrontendAppwriteGameUploader {
  constructor(customConfig = {}) {
    this.config = { ...config, ...customConfig };
    
    // Initialize Appwrite client (frontend SDK doesn't support setKey)
    this.client = new Client()
      .setEndpoint(this.config.endpoint)
      .setProject(this.config.projectId);
    
    this.databases = new Databases(this.client);
    
    console.log('🚀 Frontend Appwrite uploader initialized:', {
      endpoint: this.config.endpoint,
      projectId: this.config.projectId,
      databaseId: this.config.databaseId
    });
  }

  /**
   * Check authentication and create session if needed
   */
  async ensureAuthentication() {
    const { Account } = await import('appwrite');
    const account = new Account(this.client);
    
    try {
      // Try to get current session
      const session = await account.get();
      this.userId = session.$id; // Store user ID
      console.log('✅ Authenticated as:', session.email || session.name || 'Anonymous');
      return true;
    } catch {
      console.log('🔐 No authentication found, creating anonymous session...');
      
      try {
        // Create anonymous session for game uploads
        const session = await account.createAnonymousSession();
        this.userId = session.userId || session.$id; // Store user ID from anonymous session
        console.log('✅ Anonymous session created:', session.$id);
        return true;
      } catch (anonError) {
        console.error('❌ Failed to create anonymous session:', anonError);
        console.error('📋 To fix this, go to your Appwrite console and set collection permissions to allow "role:guests" or "role:any"');
        throw new Error('Authentication required for game uploads. Please configure Appwrite collection permissions for guests.');
      }
    }
  }

  /**
   * Upload a complete game to Appwrite
   */
  async uploadLocalGame(gameData, options = {}) {
    const { replaceExisting = false } = options;
    
    try {
      console.log('📤 Starting game upload:', gameData.id);
      
      // Ensure we have proper authentication
      await this.ensureAuthentication();

      // Step 0: Check for duplicates using content-based detection
      const { generateGameContentHash } = await import('@/shared/utils/gameIdentifier');
      
      // Get all existing games to check for duplicates
      // Since createdBy field doesn't exist in schema, we'll check all games
      const existingGames = await this.databases.listDocuments(
        this.config.databaseId,
        this.config.collections.games
      );

      // Generate content identifiers for comparison
      const currentContentHash = generateGameContentHash(gameData);
      console.log('🔗 Generated content hash for duplicate check:', currentContentHash);

      // Check each existing game for content match
      for (const existingGame of existingGames.documents) {
        // Compare key game data fields to detect duplicates
        const samePlayerCount = existingGame.playerIds?.length === (gameData.players?.length || 0);
        const sameTotalRounds = existingGame.totalRounds === (gameData.total_rounds || 0);
        const sameFinalScores = existingGame.finalScoresJson === JSON.stringify(gameData.final_scores || {});
        
        if (samePlayerCount && sameTotalRounds && sameFinalScores && !replaceExisting) {
          console.log('� Duplicate game detected! Game already exists in cloud:', existingGame.$id);
          console.log('📊 Match details:', {
            playerCount: `${existingGame.playerIds?.length} vs ${gameData.players?.length}`,
            totalRounds: `${existingGame.totalRounds} vs ${gameData.total_rounds}`,
            finalScores: 'Match',
            existingExtId: existingGame.extId,
            currentGameId: gameData.id
          });
          
          // Mark the local game as uploaded to prevent future uploads
          const { LocalGameStorage } = await import('@/shared/api/localGameStorage');
          LocalGameStorage.markGameAsUploaded(gameData.id, existingGame.$id);
          
          return {
            success: true,
            isDuplicate: true,
            gameId: existingGame.$id,
            appwriteGameId: existingGame.$id,
            message: `Game already exists in cloud (${existingGame.extId}) - marked as uploaded locally`
          };
        }
      }

      console.log('✅ No duplicate games found, proceeding with upload...');
      
      // Step 1: Ensure all players exist
      const playerMapping = await this.ensurePlayersExist(gameData.players);
      console.log('✅ Players processed:', Object.keys(playerMapping).length);
      
      // Step 2: Create or update the game record (without cloudLookupKey for now)
      const gameRecord = await this.createGameRecord(gameData, playerMapping, replaceExisting);
      console.log('✅ Game record created:', gameRecord.$id);
      
      // Step 3: Upload all rounds
      await this.uploadRounds(gameData, gameRecord.$id);
      console.log('✅ Rounds uploaded:', gameData.round_data?.length || 0);
      
      // Step 4: Upload round players data
      await this.uploadRoundPlayers(gameData, gameRecord.$id, playerMapping);
      console.log('✅ Round players uploaded');
      
      // Step 5: Mark the local game as uploaded
      const { LocalGameStorage } = await import('@/shared/api/localGameStorage');
      LocalGameStorage.markGameAsUploaded(gameData.id, gameRecord.$id);
      
      console.log('🎉 Game upload completed successfully!');
      
      return {
        success: true,
        isDuplicate: false,
        gameId: gameRecord.$id,
        appwriteGameId: gameRecord.$id,
        playersCreated: Object.keys(playerMapping).length,
        roundsCreated: gameData.round_data?.length || 0
      };
      
    } catch (error) {
      console.error('❌ Game upload failed:', error);
      throw new Error(`Game upload failed: ${error.message}`);
    }
  }

  /**
   * Ensure all players exist in Appwrite, create if needed
   */
  async ensurePlayersExist(players) {
    const playerMapping = {};
    
    for (const player of players) {
      try {
        // Try to find existing player by external ID
        const existingPlayers = await this.databases.listDocuments(
          this.config.databaseId,
          this.config.collections.players,
          [Query.equal('extId', player.id)]
        );
        
        if (existingPlayers.documents.length > 0) {
          // Player exists, use existing ID
          playerMapping[player.id] = existingPlayers.documents[0].$id;
          console.log(`♻️  Using existing player: ${player.name} (${player.id})`);
        } else {
          // Create new player
          const newPlayer = await this.databases.createDocument(
            this.config.databaseId,
            this.config.collections.players,
            ID.unique(),
            {
              extId: player.id,
              name: player.name || 'Unknown Player',
              userId: null // Could be linked to user account later
            }
          );
          
          playerMapping[player.id] = newPlayer.$id;
          console.log(`➕ Created new player: ${player.name} (${player.id})`);
        }
      } catch (error) {
        console.error(`Failed to process player ${player.id}:`, error);
        throw error;
      }
    }
    
    return playerMapping;
  }

  /**
   * Create the main game record
   */
  async createGameRecord(gameData, playerMapping, replaceExisting = false) {
    // Normalize game mode to match Appwrite enum (lowercase)
    let normalizedGameMode = 'local'; // default
    if (gameData.game_mode) {
      const mode = gameData.game_mode.toLowerCase();
      if (['local', 'online'].includes(mode)) {
        normalizedGameMode = mode;
      }
    }

    const gameDocument = {
      extId: gameData.id,
      playerIds: Object.values(playerMapping),
      winnerPlayerId: playerMapping[gameData.winner_id] || null,
      finalScoresJson: JSON.stringify(gameData.final_scores || {}),
      totalRounds: gameData.total_rounds || 0,
      gameMode: normalizedGameMode // Use normalized lowercase value
      // Removed durationSeconds and createdBy - not in your Appwrite schema
    };

    console.log('📋 Game document to create:', gameDocument);

    try {
      // Check if game already exists
      const existingGames = await this.databases.listDocuments(
        this.config.databaseId,
        this.config.collections.games,
        [Query.equal('extId', gameData.id)]
      );

      if (existingGames.documents.length > 0) {
        if (replaceExisting) {
          // Update existing game
          return await this.databases.updateDocument(
            this.config.databaseId,
            this.config.collections.games,
            existingGames.documents[0].$id,
            gameDocument
          );
        } else {
          throw new Error(`Game ${gameData.id} already exists. Use replaceExisting=true to overwrite.`);
        }
      } else {
        // Create new game
        return await this.databases.createDocument(
          this.config.databaseId,
          this.config.collections.games,
          ID.unique(),
          gameDocument
        );
      }
    } catch (error) {
      console.error('Failed to create game record:', error);
      throw error;
    }
  }

  /**
   * Upload all rounds data
   */
  async uploadRounds(gameData, appwriteGameId) {
    if (!gameData.round_data || gameData.round_data.length === 0) {
      console.log('No rounds to upload');
      return;
    }

    for (const round of gameData.round_data) {
      try {
        await this.databases.createDocument(
          this.config.databaseId,
          this.config.collections.rounds,
          ID.unique(),
          {
            gameId: appwriteGameId,
            roundNumber: round.round,
            cards: round.cards
          }
        );
      } catch (error) {
        console.error(`Failed to upload round ${round.round}:`, error);
        throw error;
      }
    }
  }

  /**
   * Upload round players data (individual player performance per round)
   */
  async uploadRoundPlayers(gameData, appwriteGameId, playerMapping) {
    if (!gameData.round_data || gameData.round_data.length === 0) {
      console.log('No round players data to upload');
      return;
    }

    for (const round of gameData.round_data) {
      for (const player of round.players || []) {
        try {
          const appwritePlayerId = playerMapping[player.id];
          if (!appwritePlayerId) {
            console.warn(`Player mapping not found for ${player.id}`);
            continue;
          }

          await this.databases.createDocument(
            this.config.databaseId,
            this.config.collections.roundPlayers,
            ID.unique(),
            {
              gameId: appwriteGameId,
              roundNumber: round.round,
              playerId: appwritePlayerId,
              call: player.call || 0,
              made: player.made || 0,
              score: player.score || 0,
              totalScore: player.totalScore || 0
            }
          );
        } catch (error) {
          console.error(`Failed to upload round player data for round ${round.round}, player ${player.id}:`, error);
          throw error;
        }
      }
    }
  }
}

/**
 * Main upload function (matches the expected interface)
 */
export async function uploadLocalGame(gameData, options = {}) {
  const uploader = new FrontendAppwriteGameUploader();
  return await uploader.uploadLocalGame(gameData, options);
}

/**
 * Create uploader with custom configuration
 */
export function createUploaderFromEnv() {
  return new FrontendAppwriteGameUploader();
}

export { FrontendAppwriteGameUploader };
export default uploadLocalGame;
