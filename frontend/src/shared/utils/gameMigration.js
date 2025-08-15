/**
 * Game Data Migration Utility
 * Handles migration of game data from old formats to new schema
 */

import { LocalGameStorage } from '@/shared/api/localGameStorage';
import { migrateToNewSchema, validateGameSchema, toLegacyFormat } from '@/shared/schemas/gameSchema';

export class GameMigrationService {
  
  /**
   * Migrates all local games to new schema format
   * @param {boolean} dryRun - If true, only validates without saving
   * @returns {Object} - Migration results
   */
  static async migrateAllLocalGames(dryRun = false) {
    const results = {
      total: 0,
      migrated: 0,
      failed: 0,
      errors: [],
      games: []
    };
    
    try {
      const allGames = LocalGameStorage.getAllSavedGames();
      results.total = Object.keys(allGames).length;
      
      for (const [gameId, game] of Object.entries(allGames)) {
        try {
          // Check if game is already in new format
          if (this.isNewSchemaFormat(game)) {
            console.debug(`Game ${gameId} already in new format, skipping`);
            continue;
          }
          
          // Migrate the game
          const migratedGame = migrateToNewSchema(game);
          
          // Validate the migration
          const validation = validateGameSchema(migratedGame);
          if (!validation.isValid) {
            results.failed++;
            results.errors.push({
              gameId,
              error: `Validation failed: ${validation.errors.join(', ')}`
            });
            continue;
          }
          
          // Convert back to legacy format for storage compatibility
          const legacyFormat = toLegacyFormat(migratedGame);
          
          results.games.push({
            gameId,
            original: game,
            migrated: migratedGame,
            legacy: legacyFormat
          });
          
          // Save if not dry run
          if (!dryRun) {
            // Update the game in storage
            const games = LocalGameStorage.getAllSavedGames();
            games[gameId] = legacyFormat;
            localStorage.setItem('wizardTracker_localGames', JSON.stringify(games));
          }
          
          results.migrated++;
          
        } catch (error) {
          console.error(`Error migrating game ${gameId}:`, error);
          results.failed++;
          results.errors.push({
            gameId,
            error: error.message
          });
        }
      }
      
    } catch (error) {
      console.error('Error during migration:', error);
      results.errors.push({
        gameId: 'GENERAL',
        error: error.message
      });
    }
    
    return results;
  }
  
  /**
   * Migrates a single game to new schema
   * @param {string} gameId - Game ID to migrate
   * @param {boolean} dryRun - If true, only validates without saving
   * @returns {Object} - Migration result
   */
  static async migrateSingleGame(gameId, dryRun = false) {
    try {
      const allGames = LocalGameStorage.getAllSavedGames();
      const game = allGames[gameId];
      
      if (!game) {
        return {
          success: false,
          error: `Game with ID ${gameId} not found`
        };
      }
      
      // Check if already migrated
      if (this.isNewSchemaFormat(game)) {
        return {
          success: true,
          alreadyMigrated: true,
          message: 'Game already in new format'
        };
      }
      
      // Migrate
      const migratedGame = migrateToNewSchema(game);
      
      // Validate
      const validation = validateGameSchema(migratedGame);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
      }
      
      // Convert to legacy format for storage
      const legacyFormat = toLegacyFormat(migratedGame);
      
      // Save if not dry run
      if (!dryRun) {
        allGames[gameId] = legacyFormat;
        localStorage.setItem('wizardTracker_localGames', JSON.stringify(allGames));
      }
      
      return {
        success: true,
        original: game,
        migrated: migratedGame,
        legacy: legacyFormat
      };
      
    } catch (error) {
      console.error(`Error migrating game ${gameId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Validates all local games against new schema
   * @returns {Object} - Validation results
   */
  static async validateAllLocalGames() {
    const results = {
      total: 0,
      valid: 0,
      invalid: 0,
      errors: []
    };
    
    try {
      const allGames = LocalGameStorage.getAllSavedGames();
      results.total = Object.keys(allGames).length;
      
      for (const [gameId, game] of Object.entries(allGames)) {
        try {
          // Convert to new schema for validation
          const schemaGame = this.isNewSchemaFormat(game) ? game : migrateToNewSchema(game);
          
          const validation = validateGameSchema(schemaGame);
          if (validation.isValid) {
            results.valid++;
          } else {
            results.invalid++;
            results.errors.push({
              gameId,
              errors: validation.errors
            });
          }
          
        } catch (error) {
          console.error(`Error validating game ${gameId}:`, error);
          results.invalid++;
          results.errors.push({
            gameId,
            errors: [error.message]
          });
        }
      }
      
    } catch (error) {
      console.error('Error during validation:', error);
      results.errors.push({
        gameId: 'GENERAL',
        errors: [error.message]
      });
    }
    
    return results;
  }
  
  /**
   * Creates a backup of all local games before migration
   * @returns {string} - Backup data as JSON string
   */
  static createBackup() {
    try {
      const allGames = LocalGameStorage.getAllSavedGames();
      const backup = {
        timestamp: new Date().toISOString(),
        version: 'pre-schema-migration',
        games: allGames
      };
      
      return JSON.stringify(backup, null, 2);
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    }
  }
  
  /**
   * Restores games from backup
   * @param {string} backupData - JSON backup data
   * @returns {boolean} - Success status
   */
  static restoreFromBackup(backupData) {
    try {
      const backup = JSON.parse(backupData);
      
      if (!backup.games) {
        throw new Error('Invalid backup format: missing games data');
      }
      
      localStorage.setItem('wizardTracker_localGames', JSON.stringify(backup.games));
      return true;
      
    } catch (error) {
      console.error('Error restoring from backup:', error);
      return false;
    }
  }
  
  /**
   * Checks if a game is already in new schema format
   * @param {Object} game - Game object to check
   * @returns {boolean} - True if new format
   */
  static isNewSchemaFormat(game) {
    return game.version === 1 && game.schema === 'wizard-tracker@1';
  }
  
  /**
   * Gets migration statistics
   * @returns {Object} - Statistics about current games
   */
  static async getMigrationStats() {
    try {
      const allGames = LocalGameStorage.getAllSavedGames();
      const total = Object.keys(allGames).length;
      let newFormat = 0;
      let oldFormat = 0;
      
      for (const game of Object.values(allGames)) {
        if (this.isNewSchemaFormat(game)) {
          newFormat++;
        } else {
          oldFormat++;
        }
      }
      
      return {
        total,
        newFormat,
        oldFormat,
        migrationNeeded: oldFormat > 0
      };
      
    } catch (error) {
      console.error('Error getting migration stats:', error);
      return {
        total: 0,
        newFormat: 0,
        oldFormat: 0,
        migrationNeeded: false,
        error: error.message
      };
    }
  }
}

export default GameMigrationService;
