const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cache = require('./utils/redis');
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

  // Connect to MongoDB
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');
    
    // Run database migrations
    const { runMigrations } = require('./scripts/runMigrations');
    await runMigrations();
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing connections...');
    await cache.disconnect();
    await mongoose.connection.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, closing connections...');
    await cache.disconnect();
    await mongoose.connection.close();
    process.exit(0);
  });

  // Routes with rate limiting
  app.use('/api/users', apiLimiter, userRoutes);
  app.use('/api/games', apiLimiter, gameRoutes);
  app.use('/api/wizard-games', apiLimiter, wizardGameRoutes); // New wizard games collection
  app.use('/api/table-games', apiLimiter, tableGameRoutes);
  app.use('/api/game-templates', apiLimiter, gameTemplateRoutes);
  app.use('/api/games', apiLimiter, gameSyncRoutes); // Game sync endpoints
  app.use('/api/identities', apiLimiter, identityRoutes); // Player identity management

  // Health check route
  app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
  });

  // Error handling middleware
  app.use(errorHandler);

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health\n`);
  });
}

// Start the server
initializeServer().catch(err => {
  console.error('Failed to initialize server:', err);
  process.exit(1);
});

module.exports = app;
