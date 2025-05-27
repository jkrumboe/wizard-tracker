// Test script for multiplayer functionality
import { Client } from 'colyseus.js';

async function testMultiplayerFlow() {
  console.log('🧪 Testing Wizard Tracker Multiplayer Functionality...\n');

  try {    // Test 1: Connect to Colyseus server
    console.log('1️⃣ Testing Colyseus connection...');
    const client = new Client('ws://localhost:5055');
      // Test 2: Join lobby
    console.log('2️⃣ Testing lobby connection...');
    const lobbyRoom = await client.joinOrCreate('lobby', {
      playerId: 12345,
      playerName: 'TestPlayer1'
    });
    console.log('✅ Connected to lobby:', lobbyRoom.sessionId);    // Test 3: Create a game room
    console.log('3️⃣ Testing game room creation...');
    const gameRoom = await client.create('wizard_game', {
      playerId: 12345,
      playerName: 'TestPlayer1',
      roomName: 'Test Game Room',
      maxPlayers: 4,
      gameMode: 'classic',
      isPublic: true,
      hostId: 'test-player-1'
    });
    console.log('✅ Created game room:', gameRoom.sessionId);

    // Test 4: Listen for state changes
    gameRoom.onStateChange((state) => {
      console.log('🔄 Game state updated - Players:', Array.from(state.players.values()).length);
    });

    // Test 5: Test player ready
    setTimeout(() => {
      console.log('4️⃣ Testing player ready functionality...');
      gameRoom.send('playerReady', { ready: true });
    }, 1000);

    // Clean up after 5 seconds
    setTimeout(() => {
      console.log('5️⃣ Cleaning up...');
      gameRoom.leave();
      lobbyRoom.leave();
      console.log('✅ Multiplayer test completed successfully!\n');
      process.exit(0);
    }, 5000);

  } catch (error) {
    console.error('❌ Multiplayer test failed:', error);
    process.exit(1);
  }
}

// Test API endpoints
async function testAPIEndpoints() {
  console.log('🌐 Testing API endpoints...\n');

  try {    // Test active rooms endpoint
    console.log('1️⃣ Testing /api/rooms/active...');
    const response = await fetch('http://localhost:5055/api/rooms/active');
    if (response.ok) {
      const rooms = await response.json();
      console.log('✅ Active rooms fetched:', rooms.length, 'rooms');
    } else {
      console.log('⚠️ Active rooms endpoint returned:', response.status);
    }

    console.log('✅ API endpoints test completed!\n');
  } catch (error) {
    console.error('❌ API test failed:', error);
  }
}

// Run tests
console.log('🎮 Wizard Tracker Multiplayer Test Suite\n');
console.log('='.repeat(50));

testAPIEndpoints().then(() => {
  testMultiplayerFlow();
});
