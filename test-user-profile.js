/**
 * Test script to verify user profile endpoint
 * This script tests the /api/users/:userId/profile endpoint
 * to ensure it correctly fetches data from WizardGame and TableGame collections
 */

const fetch = require('node-fetch');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

async function testUserProfile(userId) {
  console.log('\n🧪 Testing User Profile Endpoint');
  console.log('================================\n');
  
  try {
    const endpoint = `${API_BASE_URL}/api/users/${userId}/profile`;
    console.log(`📡 Fetching: ${endpoint}\n`);
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`📊 Response Status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
      console.error('❌ Error:', error);
      return;
    }

    const data = await response.json();
    
    console.log('✅ Profile Data Retrieved Successfully!\n');
    console.log('User Info:');
    console.log('----------');
    console.log(`  ID: ${data.id || data._id}`);
    console.log(`  Username: ${data.username}`);
    console.log(`  Member Since: ${new Date(data.createdAt).toLocaleDateString()}`);
    console.log(`  Total Games: ${data.totalGames || 0}`);
    console.log(`  Total Wins: ${data.totalWins || 0}`);
    console.log(`  Profile Picture: ${data.profilePicture ? 'Yes' : 'No'}\n`);
    
    if (data.games && data.games.length > 0) {
      console.log('Games Breakdown:');
      console.log('----------------');
      
      // Count games by type
      const wizardGames = data.games.filter(g => g.gameType === 'wizard' || g.gameType !== 'table');
      const tableGames = data.games.filter(g => g.gameType === 'table');
      
      console.log(`  Wizard Games: ${wizardGames.length}`);
      console.log(`  Table Games: ${tableGames.length}\n`);
      
      // Show table game types
      if (tableGames.length > 0) {
        const tableGameTypes = {};
        tableGames.forEach(game => {
          const gameType = game.gameTypeName || game.name || 'Unknown';
          tableGameTypes[gameType] = (tableGameTypes[gameType] || 0) + 1;
        });
        
        console.log('  Table Game Types:');
        Object.entries(tableGameTypes).forEach(([type, count]) => {
          console.log(`    - ${type}: ${count}`);
        });
        console.log();
      }
      
      // Show sample games
      console.log('Sample Games:');
      console.log('-------------');
      data.games.slice(0, 5).forEach((game, index) => {
        console.log(`  ${index + 1}. ${game.gameType === 'table' ? `Table: ${game.gameTypeName || game.name}` : 'Wizard'}`);
        console.log(`     Created: ${new Date(game.created_at).toLocaleDateString()}`);
        console.log(`     Players: ${game.gameData?.players?.length || 0}`);
      });
    } else {
      console.log('📭 No games found for this user\n');
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }
}

// Get userId from command line argument or use a default
const userId = process.argv[2];

if (!userId) {
  console.log('\n⚠️  Usage: node test-user-profile.js <userId>');
  console.log('Example: node test-user-profile.js 507f1f77bcf86cd799439011\n');
  process.exit(1);
}

testUserProfile(userId);
