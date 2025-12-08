/**
 * Performance Monitoring Script
 * Monitors key metrics for database and Redis performance
 * Usage: node scripts/monitor-performance.js
 */

const mongoose = require('mongoose');
const cache = require('../utils/redis');
require('dotenv').config();

async function monitorPerformance() {
  try {
    console.log('🔍 Performance Monitoring\n');
    console.log('='.repeat(60));

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Connect to Redis
    try {
      await cache.connect();
      console.log('✅ Connected to Redis\n');
    } catch (err) {
      console.log('⚠️  Redis not available\n');
    }

    // Load models
    const User = require('../models/User');
    const Game = require('../models/Game');
    const TableGame = require('../models/TableGame');

    // Database Statistics
    console.log('📊 DATABASE STATISTICS');
    console.log('-'.repeat(60));

    const userCount = await User.countDocuments();
    const gameCount = await Game.countDocuments();
    const tableGameCount = await TableGame.countDocuments();

    console.log(`Total Users: ${userCount}`);
    console.log(`Total Games: ${gameCount}`);
    console.log(`Total Table Games: ${tableGameCount}`);
    console.log(`Total Records: ${userCount + gameCount + tableGameCount}\n`);

    // Index Statistics
    console.log('📋 INDEX ANALYSIS');
    console.log('-'.repeat(60));

    const userIndexes = await User.collection.getIndexes();
    const gameIndexes = await Game.collection.getIndexes();
    const tableGameIndexes = await TableGame.collection.getIndexes();

    console.log(`\nUser Indexes (${Object.keys(userIndexes).length}):`);
    Object.keys(userIndexes).forEach(name => console.log(`  - ${name}`));

    console.log(`\nGame Indexes (${Object.keys(gameIndexes).length}):`);
    Object.keys(gameIndexes).forEach(name => console.log(`  - ${name}`));

    console.log(`\nTableGame Indexes (${Object.keys(tableGameIndexes).length}):`);
    Object.keys(tableGameIndexes).forEach(name => console.log(`  - ${name}`));

    // Query Performance Test
    console.log('\n⚡ QUERY PERFORMANCE TEST');
    console.log('-'.repeat(60));

    // Test 1: User lookup (should use index)
    const userStart = Date.now();
    await User.findOne({ username: 'test' });
    const userTime = Date.now() - userStart;
    console.log(`User lookup: ${userTime}ms ${userTime < 10 ? '✅' : '⚠️'}`);

    // Test 2: Game query with pagination
    const gameStart = Date.now();
    await Game.find({}).limit(10).sort({ createdAt: -1 });
    const gameTime = Date.now() - gameStart;
    console.log(`Game query (10 records): ${gameTime}ms ${gameTime < 50 ? '✅' : '⚠️'}`);

    // Test 3: Complex leaderboard query (simulated)
    const leaderboardStart = Date.now();
    await Game.find({}).select('gameData.players gameData.winner_id gameData.final_scores createdAt').lean();
    const leaderboardTime = Date.now() - leaderboardStart;
    console.log(`Leaderboard data fetch: ${leaderboardTime}ms ${leaderboardTime < 200 ? '✅' : '⚠️'}`);

    // Redis Performance (if available)
    if (cache.isConnected) {
      console.log('\n🔴 REDIS PERFORMANCE');
      console.log('-'.repeat(60));

      // Test cache write
      const writeStart = Date.now();
      await cache.set('test_key', { test: 'data' }, 60);
      const writeTime = Date.now() - writeStart;
      console.log(`Cache write: ${writeTime}ms ${writeTime < 5 ? '✅' : '⚠️'}`);

      // Test cache read
      const readStart = Date.now();
      await cache.get('test_key');
      const readTime = Date.now() - readStart;
      console.log(`Cache read: ${readTime}ms ${readTime < 5 ? '✅' : '⚠️'}`);

      // Cleanup
      await cache.del('test_key');
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log('-'.repeat(60));

    const recommendations = [];

    if (userTime > 10) {
      recommendations.push('⚠️  User lookups are slow. Ensure username index exists.');
    }

    if (gameTime > 50) {
      recommendations.push('⚠️  Game queries are slow. Consider adding more indexes.');
    }

    if (leaderboardTime > 200) {
      recommendations.push('⚠️  Leaderboard is slow. Ensure Redis caching is enabled.');
    }

    if (!cache.isConnected) {
      recommendations.push('⚠️  Redis is not connected. Enable Redis for better performance.');
    }

    if (gameCount + tableGameCount > 10000) {
      recommendations.push('💡 Consider archiving old games to improve query performance.');
    }

    if (recommendations.length === 0) {
      console.log('✅ All systems performing well!');
    } else {
      recommendations.forEach(rec => console.log(rec));
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    if (cache.isConnected) {
      await cache.disconnect();
    }
    console.log('\n👋 Monitoring complete\n');
  }
}

// Run monitoring
monitorPerformance();
