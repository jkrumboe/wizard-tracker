/**
 * Dual-Write Utility
 * 
 * Handles writing to both MongoDB and PostgreSQL during migration period.
 * Provides transaction support, rollback mechanisms, and error handling.
 */

const { getPrisma, usePostgres } = require('../database');

/**
 * Strategy for handling dual-write failures
 */
const FAILURE_STRATEGY = {
  ROLLBACK_BOTH: 'rollback_both',    // Roll back both databases (default)
  PRIORITIZE_MONGO: 'prioritize_mongo', // Keep MongoDB write, log PostgreSQL failure
  PRIORITIZE_POSTGRES: 'prioritize_postgres' // Keep PostgreSQL write, log MongoDB failure
};

/**
 * Execute a dual-write operation with automatic rollback on failure
 * 
 * @param {Object} operations - Database operations to execute
 * @param {Function} operations.mongoWrite - MongoDB write operation (should return created document)
 * @param {Function} operations.postgresWrite - PostgreSQL write operation (should return created record)
 * @param {Function} operations.mongoRollback - MongoDB rollback operation
 * @param {Function} operations.postgresRollback - PostgreSQL rollback operation (optional)
 * @param {string} strategy - Failure handling strategy (default: ROLLBACK_BOTH)
 * @param {string} context - Context string for logging (e.g., 'User Registration')
 * @returns {Promise<{mongo: any, postgres: any, usedPostgres: boolean}>}
 */
async function dualWrite(operations, strategy = FAILURE_STRATEGY.ROLLBACK_BOTH, context = 'DualWrite') {
  const shouldUsePostgres = usePostgres();
  
  let mongoResult = null;
  let postgresResult = null;
  let mongoSuccess = false;
  let postgresSuccess = false;

  try {
    // Execute MongoDB write
    console.log(`[${context}] Writing to MongoDB...`);
    mongoResult = await operations.mongoWrite();
    mongoSuccess = true;
    console.log(`[${context}] ✅ MongoDB write successful`);

    // If PostgreSQL is disabled, return early
    if (!shouldUsePostgres) {
      console.log(`[${context}] ℹ️  PostgreSQL disabled, skipping dual-write`);
      return { mongo: mongoResult, postgres: null, usedPostgres: false };
    }

    // Execute PostgreSQL write
    console.log(`[${context}] Writing to PostgreSQL...`);
    postgresResult = await operations.postgresWrite(mongoResult);
    postgresSuccess = true;
    console.log(`[${context}] ✅ PostgreSQL write successful`);

    return { 
      mongo: mongoResult, 
      postgres: postgresResult, 
      usedPostgres: true 
    };

  } catch (error) {
    console.error(`[${context}] ❌ Dual-write failed:`, error.message);

    // Handle failure based on strategy
    if (strategy === FAILURE_STRATEGY.ROLLBACK_BOTH) {
      await rollbackAll(mongoSuccess, postgresSuccess, operations, context);
      throw new DualWriteError(
        `${context} failed - all operations rolled back`,
        error,
        { mongoSuccess, postgresSuccess }
      );
    } 
    else if (strategy === FAILURE_STRATEGY.PRIORITIZE_MONGO) {
      if (!mongoSuccess) {
        throw new DualWriteError(
          `${context} failed - MongoDB write failed`,
          error,
          { mongoSuccess: false, postgresSuccess }
        );
      }
      // MongoDB succeeded, PostgreSQL failed - log but continue
      console.warn(`[${context}] ⚠️  PostgreSQL write failed, continuing with MongoDB only`);
      return { mongo: mongoResult, postgres: null, usedPostgres: false, postgresError: error };
    }
    else if (strategy === FAILURE_STRATEGY.PRIORITIZE_POSTGRES) {
      if (!postgresSuccess) {
        if (mongoSuccess && operations.mongoRollback) {
          await rollbackMongo(operations, context);
        }
        throw new DualWriteError(
          `${context} failed - PostgreSQL write failed`,
          error,
          { mongoSuccess, postgresSuccess: false }
        );
      }
      return { mongo: mongoResult, postgres: postgresResult, usedPostgres: true };
    }
  }
}

/**
 * Rollback both databases
 */
async function rollbackAll(mongoSuccess, postgresSuccess, operations, context) {
  const rollbackErrors = [];

  // Rollback MongoDB if it succeeded
  if (mongoSuccess && operations.mongoRollback) {
    try {
      await rollbackMongo(operations, context);
    } catch (rollbackError) {
      rollbackErrors.push({ db: 'MongoDB', error: rollbackError });
    }
  }

  // Rollback PostgreSQL if it succeeded
  if (postgresSuccess && operations.postgresRollback) {
    try {
      await rollbackPostgres(operations, context);
    } catch (rollbackError) {
      rollbackErrors.push({ db: 'PostgreSQL', error: rollbackError });
    }
  }

  if (rollbackErrors.length > 0) {
    console.error(`[${context}] ⚠️  Rollback completed with errors:`, rollbackErrors);
  }
}

/**
 * Rollback MongoDB operation
 */
async function rollbackMongo(operations, context) {
  console.log(`[${context}] Rolling back MongoDB...`);
  await operations.mongoRollback();
  console.log(`[${context}] ✅ MongoDB rollback complete`);
}

/**
 * Rollback PostgreSQL operation
 */
async function rollbackPostgres(operations, context) {
  console.log(`[${context}] Rolling back PostgreSQL...`);
  await operations.postgresRollback();
  console.log(`[${context}] ✅ PostgreSQL rollback complete`);
}

/**
 * Custom error class for dual-write failures
 */
class DualWriteError extends Error {
  constructor(message, originalError, metadata = {}) {
    super(message);
    this.name = 'DualWriteError';
    this.originalError = originalError;
    this.metadata = metadata;
  }
}

/**
 * Read from both databases and compare results (for testing/validation)
 * 
 * @param {Function} mongoRead - MongoDB read operation
 * @param {Function} postgresRead - PostgreSQL read operation
 * @param {Function} comparator - Function to compare results (optional)
 * @returns {Promise<{match: boolean, mongo: any, postgres: any}>}
 */
async function dualRead(mongoRead, postgresRead, comparator = null) {
  const shouldUsePostgres = usePostgres();
  
  const mongoResult = await mongoRead();
  
  if (!shouldUsePostgres) {
    return { match: true, mongo: mongoResult, postgres: null };
  }

  const postgresResult = await postgresRead();
  
  let match = true;
  if (comparator) {
    match = comparator(mongoResult, postgresResult);
  }
  
  return { match, mongo: mongoResult, postgres: postgresResult };
}

/**
 * Execute a dual-read that falls back to MongoDB if PostgreSQL fails
 * 
 * @param {Function} mongoRead - MongoDB read operation
 * @param {Function} postgresRead - PostgreSQL read operation  
 * @returns {Promise<any>}
 */
async function dualReadWithFallback(mongoRead, postgresRead) {
  const shouldUsePostgres = usePostgres();
  
  if (!shouldUsePostgres) {
    return await mongoRead();
  }

  try {
    return await postgresRead();
  } catch (error) {
    console.warn('PostgreSQL read failed, falling back to MongoDB:', error.message);
    return await mongoRead();
  }
}

module.exports = {
  dualWrite,
  dualRead,
  dualReadWithFallback,
  FAILURE_STRATEGY,
  DualWriteError
};
