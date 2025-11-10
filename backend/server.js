const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const userRoutes = require('./routes/users');
const gameRoutes = require('./routes/games');
const tableGameRoutes = require('./routes/tableGames');
const onlineRoutes = require('./routes/online');
const gameSyncRoutes = require('./routes/gameSync');
const errorHandler = require('./middleware/errorHandler');
const OnlineStatus = require('./models/OnlineStatus');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
// Increase body size limit to handle base64 encoded images (up to 10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.debug('Connected to MongoDB');
    
    // Initialize default online status document if none exists
    try {
      const statusCount = await OnlineStatus.countDocuments();
      if (statusCount === 0) {
        await OnlineStatus.create({
          status: true,
          message: 'All features are available',
          updatedBy: 'system'
        });
        console.debug('Default online status document created');
      } else {
        console.debug('Online status document already exists');
      }
    } catch (error) {
      console.error('Error initializing online status:', error);
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/table-games', tableGameRoutes);
app.use('/api/games', gameSyncRoutes); // Game sync endpoints
app.use('/api/online', onlineRoutes);

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
  console.debug(`Server is running on port ${PORT}`);
});

module.exports = app;
