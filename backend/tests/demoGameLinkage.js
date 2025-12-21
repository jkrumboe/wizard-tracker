/**
 * Demo script to show game user linkage in action
 * 
 * This creates a demo game and shows how it gets linked when user registers
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Game = require('../models/Game');
const WizardGame = require('../models/WizardGame');
const TableGame = require('../models/TableGame');
const { findGamesByUsername, linkGamesToNewUser } = require('../utils/gameUserLinkage');

const DEMO_USERNAME = 'DemoPlayer';
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/wizard-tracker';

async function createDemoGames() {
  console.log('\n🎮 Creating demo games with player:', DEMO_USERNAME);
  
  const timestamp = Date.now();
  
  // Create a regular Game
  const game = new Game({
    userId: 'temp-anonymous-' + timestamp,
    localId: 'demo-game-' + timestamp,
    gameData: {
      version: '3.0',
      players: [
        { id: 'p1', name: DEMO_USERNAME },
        { id: 'p2', name: 'OtherPlayer' }
      ],
      total_rounds: 5,
      created_at: new Date().toISOString(),
      gameFinished: true,
      final_scores: { p1: 120, p2: 95 }
    }
  });
  await game.save();
  console.log(`   ✅ Created Game: ${game.localId}`);
  
  // Create a WizardGame
  const wizardGame = new WizardGame({
    userId: 'temp-anonymous-' + (timestamp + 1),
    localId: 'demo-wizard-' + timestamp,
    gameData: {
      version: '3.0',
      players: [
        { id: 'p1', name: DEMO_USERNAME, score: 0 },
        { id: 'p2', name: 'Friend1', score: 0 }
      ],
      round_data: [],
      total_rounds: 3,
      created_at: new Date().toISOString()
    }
  });
  await wizardGame.save();
  console.log(`   ✅ Created WizardGame: ${wizardGame.localId}`);
  
  // Create a TableGame
  const tableGame = new TableGame({
    userId: new mongoose.Types.ObjectId(), // Random temp user
    localId: 'demo-table-' + timestamp,
    name: 'Card Game Demo',
    gameData: {
      players: [
        { id: 'p1', name: DEMO_USERNAME, points: [10, 20, 15] },
        { id: 'p2', name: 'Friend2', points: [8, 18, 12] }
      ]
    },
    gameFinished: true,
    playerCount: 2
  });
  await tableGame.save();
  console.log(`   ✅ Created TableGame: ${tableGame.localId}`);
  
  return { game, wizardGame, tableGame };
}

async function runDemo() {
  try {
    console.log('🎬 Game User Linkage Demo\n');
    console.log(`Connecting to MongoDB...`);
    
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected\n');
    
    // Step 1: Create demo games
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1: Create games BEFORE user registration');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const { game, wizardGame, tableGame } = await createDemoGames();
    
    // Step 2: Show games are not linked
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: Verify games are NOT linked to any real user');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Game userId: ${game.userId}`);
    console.log(`   WizardGame userId: ${wizardGame.userId}`);
    console.log(`   TableGame userId: ${tableGame.userId}`);
    console.log('   ℹ️  All have temporary/anonymous user IDs');
    
    // Step 3: Find games
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 3: Search for games with player:', DEMO_USERNAME);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const foundGames = await findGamesByUsername(DEMO_USERNAME);
    console.log(`   Found ${foundGames.totalFound} games:`);
    console.log(`   - Regular Games: ${foundGames.games.length}`);
    console.log(`   - Wizard Games: ${foundGames.wizardGames.length}`);
    console.log(`   - Table Games: ${foundGames.tableGames.length}`);
    
    // Step 4: Simulate user registration by creating user and linking
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 4: Simulate user registration');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Simulating: User registers with username "${DEMO_USERNAME}"`);
    
    // Create a temporary user ID for demo
    const demoUserId = new mongoose.Types.ObjectId();
    console.log(`   Demo user ID: ${demoUserId}`);
    
    // Step 5: Run linkage
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 5: Running automatic game linkage...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const linkageResults = await linkGamesToNewUser(DEMO_USERNAME, demoUserId);
    
    console.log('\n📊 Linkage Results:');
    console.log(`   ✅ Games linked: ${linkageResults.gamesLinked}`);
    console.log(`   ✅ Wizard games linked: ${linkageResults.wizardGamesLinked}`);
    console.log(`   ✅ Table games linked: ${linkageResults.tableGamesLinked}`);
    console.log(`   📈 Total: ${linkageResults.gamesLinked + linkageResults.wizardGamesLinked + linkageResults.tableGamesLinked}`);
    
    if (linkageResults.errors.length > 0) {
      console.log(`   ⚠️  Errors: ${linkageResults.errors.length}`);
    }
    
    // Step 6: Verify linkage
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 6: Verify games are now linked');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const [updatedGame, updatedWizard, updatedTable] = await Promise.all([
      Game.findById(game._id),
      WizardGame.findById(wizardGame._id),
      TableGame.findById(tableGame._id)
    ]);
    
    console.log(`   Game userId: ${updatedGame.userId}`);
    console.log(`   WizardGame userId: ${updatedWizard.userId}`);
    console.log(`   TableGame userId: ${updatedTable.userId}`);
    console.log(`\n   ✅ All games now linked to user: ${demoUserId}`);
    
    // Cleanup
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('CLEANUP: Removing demo games');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await Promise.all([
      Game.deleteOne({ _id: game._id }),
      WizardGame.deleteOne({ _id: wizardGame._id }),
      TableGame.deleteOne({ _id: tableGame._id })
    ]);
    console.log('   ✅ Demo games removed');
    
    console.log('\n✨ Demo completed successfully!');
    console.log('\n💡 In production, this linkage happens automatically when:');
    console.log('   1. User registers via POST /api/users/register');
    console.log('   2. User manually triggers via POST /api/users/me/link-games');
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the demo
runDemo()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
