const express = require('express');
const cors = require('cors');
const cache = require('./utils/redis');
const { connectDatabases, disconnectDatabases, healthCheck, getActiveDatabase } = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Async function to initialize server
async function initializeServer() {
  // Connect to Redis first (before loading rate limiters)
  try {
    await cache.connect();
  } catch (err) {
    console.warn('Redis unavailable, using memory cache:', err.message);
  }

  // Now load routes and middleware that depend on Redis
  const userRoutes = require('./routes/users');
  const gameRoutes = require('./routes/games');
  const wizardGameRoutes = require('./routes/wizardGames');
  const tableGameRoutes = require('./routes/tableGames');
  const gameTemplateRoutes = require('./routes/gameTemplates');
  const gameSyncRoutes = require('./routes/gameSync');
  const identityRoutes = require('./routes/identities');
  const errorHandler = require('./middleware/errorHandler');
  const { apiLimiter } = require('./middleware/rateLimiter');

  // Middleware
  app.set('trust proxy', 1); // Trust first proxy (nginx/Docker)
  app.use(cors());
  // Increase body size limit to handle base64 encoded images (up to 10MB)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Connect to databases (MongoDB + PostgreSQL)
  try {
    const dbResults = await connectDatabases();
    
    // Log connection status
    console.log(`Active database: ${getActiveDatabase().toUpperCase()}`);
    
    // In test mode, warn if databases are unavailable but don't throw
    if (process.env.NODE_ENV === 'test') {
      if (!dbResults.mongodb.connected) {
        console.warn('⚠️  MongoDB unavailable - some tests may be skipped');
      }
      if (!dbResults.postgres.connected) {
        console.warn('⚠️  PostgreSQL unavailable - some tests may be skipped');
      }
    } else {
      // In production/development, require MongoDB at minimum
      // PostgreSQL is optional until USE_POSTGRES=true
      if (!dbResults.mongodb.connected) {
        throw new Error('MongoDB connection required');
      }
      
      if (process.env.USE_POSTGRES === 'true' && !dbResults.postgres.connected) {
        throw new Error('PostgreSQL connection required when USE_POSTGRES=true');
      }
    }
    
    // Run database migrations only in non-test environments
    if (process.env.NODE_ENV !== 'test') {
      const { runMigrations } = require('./scripts/runMigrations');
      await runMigrations();
    }
  } catch (err) {
    console.error('Database connection error:', err.message);
    if (process.env.NODE_ENV === 'test') {
      console.warn('⚠️  Tests will be skipped due to database connection issues');
    } else {
      throw err;
    }
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing connections...');
    await cache.disconnect();
    await disconnectDatabases();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, closing connections...');
    await cache.disconnect();
    await disconnectDatabases();
    process.exit(0);
  });

  // Routes with rate limiting
  app.use('/api/users', apiLimiter, userRoutes);
  app.use('/api/games', apiLimiter, gameRoutes, gameSyncRoutes); // Game routes and sync endpoints (sync endpoints are rate limited via gameRoutes mount)
  app.use('/api/wizard-games', apiLimiter, wizardGameRoutes); // New wizard games collection
  app.use('/api/table-games', apiLimiter, tableGameRoutes);
  app.use('/api/game-templates', apiLimiter, gameTemplateRoutes);
  app.use('/api/identities', apiLimiter, identityRoutes); // Player identity management

  // Health check route
  app.get('/api/health', async (req, res) => {
    try {
      const dbHealth = await healthCheck();
      const activeDb = getActiveDatabase();
      
      res.json({ 
        status: 'OK', 
        message: 'Server is running',
        database: {
          active: activeDb,
          mongodb: dbHealth.mongodb,
          postgres: dbHealth.postgres
        }
      });
    } catch (error) {
      res.status(500).json({ 
        status: 'ERROR', 
        message: 'Health check failed',
        error: error.message 
      });
    }
  });

  // Error handling middleware
  app.use(errorHandler);

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // Only start listening if not in test mode
  if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/health\n`);
    });
  }
  
  return app;
}

// Start the server only if not in test mode
if (process.env.NODE_ENV !== 'test') {
  initializeServer().catch(err => {
    console.error('Failed to initialize server:', err);
    process.exit(1);
  });
}

// For testing: export both app and initialization function
const exportedModule = {
  app,
  initializeServer
};

// For backward compatibility with code that does require('../server')
exportedModule.app = app;
module.exports = exportedModule;
module.exports.default = app; // Default export is the app
