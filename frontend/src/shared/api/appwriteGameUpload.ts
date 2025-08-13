/**
 * Appwrite Game Upload Service
 * Uploads local Wizard Tracker games to self-hosted Appwrite instance
 * 
 * CURRENT STATE: 
 * - This file uses mock implementations for frontend compatibility
 * - All TypeScript types and logic are production-ready
 * - To use in backend: Replace mock imports with real 'node-appwrite' and 'p-limit'
 * 
 * PRODUCTION SETUP:
 * 1. Move this file to a Node.js backend service
 * 2. Install: npm install node-appwrite p-limit
 * 3. Replace mock implementations with real imports
 * 4. Set up environment variables
 * 5. Create Appwrite collections with specified schema
 */

// Mock Appwrite SDK for frontend compatibility
// In production, replace with actual 'node-appwrite' imports
interface MockClient {
  setEndpoint(endpoint: string): this;
  setProject(projectId: string): this;
  setKey(apiKey: string): this;
}

interface MockQuery {
  equal(field: string, value: string | string[]): string;
  limit(limit: number): string;
}

interface MockDatabases {
  listDocuments(
    databaseId: string,
    collectionId: string,
    queries?: string[]
  ): Promise<{ documents: any[] }>;
  createDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
    data: any
  ): Promise<any>;
  updateDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
    data: any
  ): Promise<any>;
}

interface MockID {
  unique(): string;
}

// Mock implementations
const MockClient = class implements MockClient {
  setEndpoint(endpoint: string): this {
    console.log(`Mock: Setting endpoint to ${endpoint}`);
    return this;
  }
  
  setProject(projectId: string): this {
    console.log(`Mock: Setting project to ${projectId}`);
    return this;
  }
  
  setKey(apiKey: string): this {
    console.log(`Mock: Setting API key`);
    return this;
  }
};

const MockDatabases = class implements MockDatabases {
  constructor(client: any) {
    console.log('Mock: Databases initialized');
  }

  async listDocuments(
    databaseId: string,
    collectionId: string,
    queries?: string[]
  ): Promise<{ documents: any[] }> {
    console.log(`Mock: Listing documents in ${collectionId}`);
    return { documents: [] };
  }

  async createDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
    data: any
  ): Promise<any> {
    console.log(`Mock: Creating document in ${collectionId}:`, data);
    return { $id: documentId, ...data };
  }

  async updateDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
    data: any
  ): Promise<any> {
    console.log(`Mock: Updating document ${documentId} in ${collectionId}:`, data);
    return { $id: documentId, ...data };
  }
};

const MockQuery: MockQuery = {
  equal: (field: string, value: string | string[]): string => {
    return `equal("${field}", ${JSON.stringify(value)})`;
  },
  limit: (limit: number): string => {
    return `limit(${limit})`;
  }
};

const MockID: MockID = {
  unique: (): string => {
    return `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
};

// Use mocks for frontend, real imports for backend
const Client = MockClient;
const Databases = MockDatabases;
const Query = MockQuery;
const ID = MockID;

// For production backend use, uncomment this and install node-appwrite:
// import { Client, Databases, ID, Query } from 'node-appwrite';

// Mock p-limit for frontend compatibility
// In production backend, use: import pLimit from 'p-limit';
interface LimitFunction {
  <T>(fn: () => Promise<T>): Promise<T>;
}

const pLimit = (concurrency: number): LimitFunction => {
  console.log(`Mock: Creating limit function with concurrency ${concurrency}`);
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    return await fn();
  };
};

// Environment configuration
interface AppwriteConfig {
  endpoint: string;
  projectId: string;
  apiKey: string;
  databaseId: string;
  collections: {
    players: string;
    games: string;
    rounds: string;
    roundPlayers: string;
  };
}

// Local game types matching the JSON structure
interface LocalRoundPlayer {
  id: string;
  call: number;
  made: number;
  score: number;
  totalScore: number;
}

interface LocalRound {
  round: number;
  cards: number;
  players: LocalRoundPlayer[];
}

interface LocalPlayer {
  id: string;
  name: string;
}

interface LocalGame {
  id: string;
  players: LocalPlayer[];
  winner_id?: string;
  final_scores: Record<string, number>;
  round_data: LocalRound[];
  total_rounds: number;
  created_at: string;
  game_mode: string;
  duration_seconds: number;
}

// Appwrite document types
interface PlayerDocument {
  $id: string;
  extId: string;
  name: string;
  userId?: string;
}

interface GameDocument {
  $id: string;
  extId: string;
  playerIds: string[];
  winnerPlayerId?: string;
  finalScoresJson: string;
  totalRounds: number;
  gameMode: string;
  durationSeconds: number;
}

interface RoundDocument {
  $id: string;
  gameId: string;
  roundNumber: number;
  cards: number;
}

interface RoundPlayerDocument {
  $id: string;
  gameId: string;
  roundNumber: number;
  playerId: string;
  call: number;
  made: number;
  score: number;
  totalScore: number;
}

// Upload options
interface UploadOptions {
  replaceExisting?: boolean;
  setPermissions?: boolean;
  concurrency?: number;
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 5000,
};

/**
 * Exponential backoff retry helper
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  retries: number = RETRY_CONFIG.maxRetries
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }

    const delay = Math.min(
      RETRY_CONFIG.baseDelay * Math.pow(2, RETRY_CONFIG.maxRetries - retries),
      RETRY_CONFIG.maxDelay
    );

    console.warn(`Operation failed, retrying in ${delay}ms... (${retries} retries left)`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return withRetry(operation, retries - 1);
  }
}

/**
 * Appwrite Game Upload Service
 */
export class AppwriteGameUploader {
  private client: MockClient;
  private databases: MockDatabases;
  private config: AppwriteConfig;

  constructor(config: AppwriteConfig) {
    this.config = config;
    this.client = new Client()
      .setEndpoint(config.endpoint)
      .setProject(config.projectId)
      .setKey(config.apiKey);
    
    this.databases = new Databases(this.client);
  }

  /**
   * Validates the local game data
   */
  private validateLocalGame(game: LocalGame): void {
    if (!game.id) {
      throw new Error('Game ID is required');
    }
    if (!game.players || game.players.length === 0) {
      throw new Error('Game must have at least one player');
    }
    if (!game.round_data || game.round_data.length === 0) {
      throw new Error('Game must have at least one round');
    }
    if (typeof game.total_rounds !== 'number' || game.total_rounds <= 0) {
      throw new Error('Total rounds must be a positive number');
    }
    if (!game.game_mode) {
      throw new Error('Game mode is required');
    }
    if (typeof game.duration_seconds !== 'number' || game.duration_seconds < 0) {
      throw new Error('Duration seconds must be a non-negative number');
    }

    // Validate players
    for (const player of game.players) {
      if (!player.id || !player.name) {
        throw new Error('Each player must have an id and name');
      }
    }

    // Validate rounds
    for (const round of game.round_data) {
      if (typeof round.round !== 'number' || round.round <= 0) {
        throw new Error('Round number must be a positive number');
      }
      if (typeof round.cards !== 'number' || round.cards <= 0) {
        throw new Error('Cards per round must be a positive number');
      }
      if (!round.players || round.players.length === 0) {
        throw new Error('Each round must have player data');
      }

      for (const roundPlayer of round.players) {
        if (!roundPlayer.id) {
          throw new Error('Round player must have an id');
        }
        if (typeof roundPlayer.call !== 'number' || roundPlayer.call < 0) {
          throw new Error('Player call must be a non-negative number');
        }
        if (typeof roundPlayer.made !== 'number' || roundPlayer.made < 0) {
          throw new Error('Player made must be a non-negative number');
        }
        if (typeof roundPlayer.score !== 'number') {
          throw new Error('Player score must be a number');
        }
        if (typeof roundPlayer.totalScore !== 'number') {
          throw new Error('Player total score must be a number');
        }
      }
    }
  }

  /**
   * Finds an existing player by external ID
   */
  private async findPlayerByExtId(extId: string): Promise<PlayerDocument | null> {
    try {
      const response = await this.databases.listDocuments(
        this.config.databaseId,
        this.config.collections.players,
        [Query.equal('extId', extId), Query.limit(1)]
      );

      return response.documents.length > 0 ? response.documents[0] as PlayerDocument : null;
    } catch (error) {
      console.error(`Error finding player with extId ${extId}:`, error);
      throw error;
    }
  }

  /**
   * Creates or retrieves a player by external ID
   */
  private async getOrCreatePlayerByExtId(extId: string, name: string): Promise<PlayerDocument> {
    // First, try to find existing player
    const existingPlayer = await this.findPlayerByExtId(extId);
    if (existingPlayer) {
      console.log(`Found existing player: ${name} (${extId})`);
      return existingPlayer;
    }

    // Create new player
    console.log(`Creating new player: ${name} (${extId})`);
    const playerData = {
      extId,
      name,
    };

    return await withRetry(async () => {
      const response = await this.databases.createDocument(
        this.config.databaseId,
        this.config.collections.players,
        ID.unique(),
        playerData
      );
      return response as PlayerDocument;
    });
  }

  /**
   * Finds an existing game by external ID
   */
  private async findGameByExtId(extId: string): Promise<GameDocument | null> {
    try {
      const response = await this.databases.listDocuments(
        this.config.databaseId,
        this.config.collections.games,
        [Query.equal('extId', extId), Query.limit(1)]
      );

      return response.documents.length > 0 ? response.documents[0] as GameDocument : null;
    } catch (error) {
      console.error(`Error finding game with extId ${extId}:`, error);
      throw error;
    }
  }

  /**
   * Maps final scores from external player IDs to Appwrite player IDs
   */
  private mapFinalScoresToPlayerIds(
    finalScores: Record<string, number>,
    extIdToIdMap: Map<string, string>
  ): Record<string, number> {
    const mappedScores: Record<string, number> = {};

    for (const [extId, score] of Object.entries(finalScores)) {
      const playerId = extIdToIdMap.get(extId);
      if (playerId) {
        mappedScores[playerId] = score;
      } else {
        console.warn(`Could not find player ID for external ID: ${extId}`);
      }
    }

    return mappedScores;
  }

  /**
   * Creates game, rounds, and round players documents
   */
  private async createGameDocuments(
    game: LocalGame,
    playerIdMap: Map<string, string>,
    options: UploadOptions
  ): Promise<string> {
    // Map winner ID
    const winnerPlayerId = game.winner_id ? playerIdMap.get(game.winner_id) : undefined;

    // Map final scores
    const finalScores = this.mapFinalScoresToPlayerIds(game.final_scores, playerIdMap);

    // Create game document
    const gameData = {
      extId: game.id,
      playerIds: Array.from(playerIdMap.values()),
      winnerPlayerId,
      finalScoresJson: JSON.stringify(finalScores),
      totalRounds: game.total_rounds,
      gameMode: game.game_mode,
      durationSeconds: game.duration_seconds,
    };

    console.log(`Creating game document for: ${game.id}`);
    const gameDoc = await withRetry(async () => {
      return await this.databases.createDocument(
        this.config.databaseId,
        this.config.collections.games,
        ID.unique(),
        gameData
      );
    }) as GameDocument;

    console.log(`Created game document with ID: ${gameDoc.$id}`);

    // Create rounds and round players
    const roundsCreated = await this.createRounds(gameDoc.$id, game.round_data);
    const roundPlayersCreated = await this.createRoundPlayers(
      gameDoc.$id,
      game.round_data,
      playerIdMap,
      options.concurrency || 5
    );

    console.log(`Game upload complete:
      - Game ID: ${gameDoc.$id}
      - Rounds created: ${roundsCreated}
      - Round players created: ${roundPlayersCreated}`);

    return gameDoc.$id;
  }

  /**
   * Creates round documents
   */
  private async createRounds(gameId: string, roundData: LocalRound[]): Promise<number> {
    console.log(`Creating ${roundData.length} rounds...`);
    
    for (const round of roundData) {
      const roundDoc = {
        gameId,
        roundNumber: round.round,
        cards: round.cards,
      };

      await withRetry(async () => {
        return await this.databases.createDocument(
          this.config.databaseId,
          this.config.collections.rounds,
          ID.unique(),
          roundDoc
        );
      });
    }

    return roundData.length;
  }

  /**
   * Creates round player documents with concurrency control
   */
  private async createRoundPlayers(
    gameId: string,
    roundData: LocalRound[],
    playerIdMap: Map<string, string>,
    concurrency: number
  ): Promise<number> {
    const limit = pLimit(concurrency);
    const tasks: Promise<void>[] = [];
    let totalCreated = 0;

    for (const round of roundData) {
      for (const roundPlayer of round.players) {
        const playerId = playerIdMap.get(roundPlayer.id);
        if (!playerId) {
          console.warn(`Could not find player ID for external ID: ${roundPlayer.id}`);
          continue;
        }

        const task = limit(async () => {
          const roundPlayerDoc = {
            gameId,
            roundNumber: round.round,
            playerId,
            call: roundPlayer.call,
            made: roundPlayer.made,
            score: roundPlayer.score,
            totalScore: roundPlayer.totalScore,
          };

          await withRetry(async () => {
            return await this.databases.createDocument(
              this.config.databaseId,
              this.config.collections.roundPlayers,
              ID.unique(),
              roundPlayerDoc
            );
          });

          totalCreated++;
        });

        tasks.push(task);
      }
    }

    console.log(`Creating round players with concurrency ${concurrency}...`);
    await Promise.all(tasks);

    return totalCreated;
  }

  /**
   * Uploads a local game to Appwrite
   */
  async uploadLocalGame(game: LocalGame, options: UploadOptions = {}): Promise<void> {
    console.log(`Starting upload for game: ${game.id}`);

    // Validate input
    this.validateLocalGame(game);

    // Check if game already exists
    const existingGame = await this.findGameByExtId(game.id);
    if (existingGame) {
      if (!options.replaceExisting) {
        console.log(`Game ${game.id} already exists, skipping upload`);
        return;
      } else {
        throw new Error(`Game ${game.id} already exists and replaceExisting not implemented yet`);
      }
    }

    // Upsert all players
    console.log(`Upserting ${game.players.length} players...`);
    const playerIdMap = new Map<string, string>();

    for (const player of game.players) {
      const playerDoc = await this.getOrCreatePlayerByExtId(player.id, player.name);
      playerIdMap.set(player.id, playerDoc.$id);
    }

    console.log(`Player mapping complete: ${playerIdMap.size} players mapped`);

    // Create game and related documents
    await this.createGameDocuments(game, playerIdMap, options);

    console.log(`Successfully uploaded game: ${game.id}`);
  }
}

/**
 * Creates an AppwriteGameUploader instance from environment variables
 */
export function createUploaderFromEnv(): AppwriteGameUploader {
  const config: AppwriteConfig = {
    endpoint: process.env.APPWRITE_ENDPOINT || '',
    projectId: process.env.APPWRITE_PROJECT_ID || '',
    apiKey: process.env.APPWRITE_API_KEY || '',
    databaseId: process.env.DB_ID || '',
    collections: {
      players: process.env.COL_PLAYERS || '',
      games: process.env.COL_GAMES || '',
      rounds: process.env.COL_ROUNDS || '',
      roundPlayers: process.env.COL_ROUND_PLAYERS || '',
    },
  };

  // Validate environment configuration
  const missingVars: string[] = [];
  if (!config.endpoint) missingVars.push('APPWRITE_ENDPOINT');
  if (!config.projectId) missingVars.push('APPWRITE_PROJECT_ID');
  if (!config.apiKey) missingVars.push('APPWRITE_API_KEY');
  if (!config.databaseId) missingVars.push('DB_ID');
  if (!config.collections.players) missingVars.push('COL_PLAYERS');
  if (!config.collections.games) missingVars.push('COL_GAMES');
  if (!config.collections.rounds) missingVars.push('COL_ROUNDS');
  if (!config.collections.roundPlayers) missingVars.push('COL_ROUND_PLAYERS');

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  return new AppwriteGameUploader(config);
}

/**
 * Convenience function to upload a local game using environment configuration
 */
export async function uploadLocalGame(
  game: LocalGame,
  options: UploadOptions = {}
): Promise<void> {
  const uploader = createUploaderFromEnv();
  await uploader.uploadLocalGame(game, options);
}

// Export types for external use
export type {
  LocalGame,
  LocalRound,
  LocalRoundPlayer,
  LocalPlayer,
  UploadOptions,
  AppwriteConfig,
};

// Example usage (if run as script)
if (require.main === module) {
  async function main() {
    const filePath = process.argv[2];
    if (!filePath) {
      console.error('Usage: node appwriteGameUpload.js <json-file-path>');
      process.exit(1);
    }

    try {
      const fs = await import('fs/promises');
      const gameData = JSON.parse(await fs.readFile(filePath, 'utf8')) as LocalGame;
      
      console.log(`Loading game from: ${filePath}`);
      await uploadLocalGame(gameData, { replaceExisting: false });
      
      console.log('Upload completed successfully!');
    } catch (error) {
      console.error('Upload failed:', error);
      process.exit(1);
    }
  }

  main().catch(console.error);
}
