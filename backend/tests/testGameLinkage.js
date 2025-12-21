/**
 * Test script for game user linkage functionality
 * 
 * This script tests the retroactive game linking when a user creates an account
 * 
 * Usage: node backend/tests/testGameLinkage.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { linkGamesToNewUser, findGamesByUsername } = require('../utils/gameUserLinkage');
const User = require('../models/User');

// Test configuration
const TEST_USERNAME = 'TestPlayer123';
// Use MONGO_URI from environment (Docker) or fall back to localhost
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/wizard-tracker';

async function runTests() {
  try {
    console.log('🧪 Starting Game User Linkage Tests\n');
    console.log(`Connecting to MongoDB: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')}`);
    
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('✅ Connected to MongoDB\n');
    } catch (connectError) {
      console.error('\n❌ Failed to connect to MongoDB');
      console.error('\n💡 To run this test, you need MongoDB running. Try one of these:\n');
      console.error('   Option 1: Start Docker containers (recommended)');
      console.error('     npm run dev\n');
      console.error('   Option 2: Start just the database');
      console.error('     docker compose up -d mongo\n');
      console.error('   Option 3: Set MONGODB_URI environment variable');
      console.error('     $env:MONGODB_URI="mongodb://your-mongo-host:27017/wizard-tracker"\n');
      throw connectError;
    }

    // Test 1: Find games by username (without linking)
    console.log('📋 Test 1: Finding games by username');
    console.log(`   Searching for games with player: "${TEST_USERNAME}"`);
    
    const foundGames = await findGamesByUsername(TEST_USERNAME);
    console.log(`   Found ${foundGames.totalFound} total games:`);
    console.log(`   - Regular Games: ${foundGames.games.length}`);
    console.log(`   - Wizard Games: ${foundGames.wizardGames.length}`);
    console.log(`   - Table Games: ${foundGames.tableGames.length}`);
    
    if (foundGames.totalFound === 0) {
      console.log(`   ℹ️  No games found with player "${TEST_USERNAME}"`);
      console.log(`   💡 To test this feature, create a game with a player named "${TEST_USERNAME}"`);
      console.log(`      before creating a user account with that username.\n`);
    } else {
      console.log('\n   📝 Sample game details:');
      if (foundGames.games.length > 0) {
        const game = foundGames.games[0];
        console.log(`   Regular Game: ${game.localId}`);
        console.log(`     Players: ${game.players.join(', ')}`);
        console.log(`     Currently linked to: ${game.userId || 'none'}`);
      }
      if (foundGames.wizardGames.length > 0) {
        const game = foundGames.wizardGames[0];
        console.log(`   Wizard Game: ${game.localId}`);
        console.log(`     Players: ${game.players.join(', ')}`);
        console.log(`     Currently linked to: ${game.userId || 'none'}`);
      }
      if (foundGames.tableGames.length > 0) {
        const game = foundGames.tableGames[0];
        console.log(`   Table Game: ${game.name} (${game.localId})`);
        console.log(`     Players: ${game.players.join(', ')}`);
        console.log(`     Currently linked to: ${game.userId || 'none'}`);
      }
    }

    // Test 2: Check if test user exists
    console.log(`\n📋 Test 2: Checking if user "${TEST_USERNAME}" exists`);
    const existingUser = await User.findOne({ username: TEST_USERNAME });
    
    if (existingUser) {
      console.log(`   ✅ User exists with ID: ${existingUser._id}`);
      
      // Test 3: Link games to existing user
      console.log(`\n📋 Test 3: Linking games to existing user`);
      const linkageResults = await linkGamesToNewUser(TEST_USERNAME, existingUser._id);
      
      console.log(`   Results:`);
      console.log(`   - Games linked: ${linkageResults.gamesLinked}`);
      console.log(`   - Wizard games linked: ${linkageResults.wizardGamesLinked}`);
      console.log(`   - Table games linked: ${linkageResults.tableGamesLinked}`);
      console.log(`   - Total: ${linkageResults.gamesLinked + linkageResults.wizardGamesLinked + linkageResults.tableGamesLinked}`);
      
      if (linkageResults.errors.length > 0) {
        console.log(`   ⚠️  Errors encountered: ${linkageResults.errors.length}`);
        linkageResults.errors.forEach((err, idx) => {
          console.log(`      ${idx + 1}. ${err.type}: ${err.error}`);
        });
      }
    } else {
      console.log(`   ℹ️  User "${TEST_USERNAME}" does not exist`);
      console.log(`   💡 The linkage will happen automatically when a user registers`);
      console.log(`      with the username "${TEST_USERNAME}"\n`);
    }

    console.log('\n✅ All tests completed successfully');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the tests
runTests()
  .then(() => {
    console.log('\n✨ Test script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test script failed:', error);
    process.exit(1);
  });
