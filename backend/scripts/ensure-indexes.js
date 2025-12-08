/**
 * Script to ensure all database indexes are created
 * Run this after deployment or when indexes need to be updated
 * Usage: node scripts/ensure-indexes.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function ensureIndexes() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Load models to register schemas
    const User = require('../models/User');
    const Game = require('../models/Game');
    const TableGame = require('../models/TableGame');
    const FriendRequest = require('../models/FriendRequest');

    console.log('\n📊 Creating indexes...\n');

    // Ensure indexes for each model
    console.log('Creating User indexes...');
    await User.createIndexes();
    console.log('✅ User indexes created');

    console.log('Creating Game indexes...');
    await Game.createIndexes();
    console.log('✅ Game indexes created');

    console.log('Creating TableGame indexes...');
    await TableGame.createIndexes();
    console.log('✅ TableGame indexes created');

    console.log('Creating FriendRequest indexes...');
    await FriendRequest.createIndexes();
    console.log('✅ FriendRequest indexes created');

    // List all indexes
    console.log('\n📋 Current indexes:');
    
    console.log('\n--- User Collection ---');
    const userIndexes = await User.collection.getIndexes();
    Object.entries(userIndexes).forEach(([name, index]) => {
      console.log(`  ${name}:`, JSON.stringify(index.key));
    });

    console.log('\n--- Game Collection ---');
    const gameIndexes = await Game.collection.getIndexes();
    Object.entries(gameIndexes).forEach(([name, index]) => {
      console.log(`  ${name}:`, JSON.stringify(index.key));
    });

    console.log('\n--- TableGame Collection ---');
    const tableGameIndexes = await TableGame.collection.getIndexes();
    Object.entries(tableGameIndexes).forEach(([name, index]) => {
      console.log(`  ${name}:`, JSON.stringify(index.key));
    });

    console.log('\n✅ All indexes created successfully!\n');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the script
ensureIndexes();
