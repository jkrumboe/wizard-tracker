/**
 * Database Connection Manager
 * Manages connections to both MongoDB (Mongoose) and PostgreSQL (Prisma)
 * during the migration period
 */

const mongoose = require('mongoose');
const { PrismaClient } = require('@prisma/client');

// Singleton instances
let mongooseConnection = null;
let prismaClient = null;

/**
 * Initialize Prisma client
 * @returns {PrismaClient}
 */
function getPrismaClient() {
  if (!prismaClient) {
    prismaClient = new PrismaClient({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'error', 'warn'] 
        : ['error'],
      errorFormat: 'pretty'
    });
  }
  return prismaClient;
}

/**
 * Connect to both databases
 * @returns {Promise<Object>} Connection status
 */
async function connectDatabases() {
  const results = {
    mongodb: { connected: false, error: null },
    postgres: { connected: false, error: null }
  };

  // Connect to MongoDB
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/wizard-tracker';
    
    if (!mongooseConnection || mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
      mongooseConnection = mongoose.connection;
      console.log('✅ MongoDB connected');
    }
    results.mongodb.connected = true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    results.mongodb.error = error.message;
  }

  // Connect to PostgreSQL
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable not set');
    }

    const prisma = getPrismaClient();
    
    // Test connection
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    
    console.log('✅ PostgreSQL connected');
    results.postgres.connected = true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    results.postgres.error = error.message;
    
    // If PostgreSQL fails but it's not required yet, don't throw
    if (process.env.USE_POSTGRES === 'true') {
      throw error;
    }
  }

  return results;
}

/**
 * Disconnect from both databases
 * @returns {Promise<void>}
 */
async function disconnectDatabases() {
  const promises = [];

  // Disconnect MongoDB
  if (mongooseConnection && mongoose.connection.readyState === 1) {
    promises.push(
      mongoose.disconnect()
        .then(() => console.log('MongoDB disconnected'))
        .catch(err => console.error('Error disconnecting MongoDB:', err))
    );
  }

  // Disconnect PostgreSQL
  if (prismaClient) {
    promises.push(
      prismaClient.$disconnect()
        .then(() => console.log('PostgreSQL disconnected'))
        .catch(err => console.error('Error disconnecting PostgreSQL:', err))
    );
  }

  await Promise.all(promises);
}

/**
 * Get connection status for both databases
 * @returns {Object} Status of both connections
 */
function getConnectionStatus() {
  return {
    mongodb: {
      connected: mongoose.connection.readyState === 1,
      state: mongoose.connection.readyState
    },
    postgres: {
      connected: !!prismaClient,
      hasClient: !!prismaClient
    }
  };
}

/**
 * Health check for both databases
 * @returns {Promise<Object>} Health status
 */
async function healthCheck() {
  const health = {
    mongodb: { healthy: false, latency: null, error: null },
    postgres: { healthy: false, latency: null, error: null }
  };

  // MongoDB health check
  try {
    const startMongo = Date.now();
    await mongoose.connection.db.admin().ping();
    health.mongodb.healthy = true;
    health.mongodb.latency = Date.now() - startMongo;
  } catch (error) {
    health.mongodb.error = error.message;
  }

  // PostgreSQL health check
  try {
    const prisma = getPrismaClient();
    const startPostgres = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    health.postgres.healthy = true;
    health.postgres.latency = Date.now() - startPostgres;
  } catch (error) {
    health.postgres.error = error.message;
  }

  return health;
}

/**
 * Determine which database to use based on environment
 * @returns {string} 'mongodb' or 'postgres'
 */
function getActiveDatabase() {
  return process.env.USE_POSTGRES === 'true' ? 'postgres' : 'mongodb';
}

/**
 * Check if PostgreSQL should be used
 * @returns {boolean}
 */
function usePostgres() {
  return process.env.USE_POSTGRES === 'true';
}

/**
 * Get Mongoose connection
 * @returns {mongoose.Connection}
 */
function getMongoose() {
  return mongoose;
}

/**
 * Get Prisma client instance
 * @returns {PrismaClient}
 */
function getPrisma() {
  return getPrismaClient();
}

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received. Closing database connections...');
  await disconnectDatabases();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received. Closing database connections...');
  await disconnectDatabases();
  process.exit(0);
});

module.exports = {
  connectDatabases,
  disconnectDatabases,
  getConnectionStatus,
  healthCheck,
  getActiveDatabase,
  usePostgres,
  getMongoose,
  getPrisma,
  mongoose, // Export for backward compatibility
  prisma: getPrismaClient // Export Prisma client getter
};
