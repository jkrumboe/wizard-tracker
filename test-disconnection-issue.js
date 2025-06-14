import { Client } from 'colyseus.js';
import fetch from 'node-fetch';

// Test the specific disconnection issue
async function testDisconnectionIssue() {
  console.log('🔍 Testing Room Creation Disconnection Issue...\n');

  try {
    // Step 1: Create room via database API (simulating frontend flow)
    console.log('1️⃣ Creating room via database API...');
    const createResponse = await fetch('http://localhost:5055/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test_token' // This might not work, but let's see
      },
      body: JSON.stringify({
        roomName: 'Test Disconnection Room',
        maxPlayers: 4,
        isPrivate: false,
        gameMode: 'classic'
      })
    });

    if (!createResponse.ok) {
      console.log('❌ Database room creation failed, trying direct Colyseus creation...');
      return testDirectColyseusCreation();
    }

    const roomData = await createResponse.json();
    console.log('✅ Database room created:', roomData);

    // Step 2: Create Colyseus room with database room ID
    console.log('2️⃣ Creating Colyseus room...');
    const client = new Client('ws://localhost:5055');
    
    const room = await client.create('wizard_game', {
      dbRoomId: roomData.roomId,
      roomName: 'Test Disconnection Room',
      maxPlayers: 4,
      gameMode: 'classic',
      isPublic: true,
      hostId: '1', // String format
      playerId: 1,
      playerName: 'TestHost',
      avatar: '',
      elo: 1000
    });

    console.log('✅ Colyseus room created:', room.sessionId);

    // Step 3: Set up listeners to catch disconnection
    let disconnected = false;
    let welcomeReceived = false;

    room.onMessage('welcome', (message) => {
      console.log('✅ Welcome message received:', message);
      welcomeReceived = true;
    });

    room.onStateChange((state) => {
      console.log(`📊 State change: ${state.players?.size || 0} players`);
    });

    room.onError((code, message) => {
      console.log('❌ Room error:', code, message);
    });

    room.onLeave((code) => {
      console.log(`👋 Room left with code: ${code}`);
      disconnected = true;
    });

    // Step 4: Wait and monitor for disconnection
    console.log('3️⃣ Monitoring room for 10 seconds...');
    
    for (let i = 0; i < 100; i++) { // 10 seconds
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (disconnected) {
        console.log(`❌ DISCONNECTION DETECTED after ${i * 100}ms`);
        console.log(`   Welcome received: ${welcomeReceived}`);
        return;
      }
    }

    console.log('✅ Room remained connected for 10 seconds');
    console.log(`   Welcome received: ${welcomeReceived}`);

    // Clean up
    room.leave();

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testDirectColyseusCreation() {
  console.log('🔄 Testing direct Colyseus room creation...');
  
  try {
    const client = new Client('ws://localhost:5055');
    
    const room = await client.create('wizard_game', {
      roomName: 'Direct Test Room',
      maxPlayers: 4,
      gameMode: 'classic',
      isPublic: true,
      hostId: '1',
      playerId: 1,
      playerName: 'DirectTestHost'
    });

    console.log('✅ Direct Colyseus room created:', room.sessionId);

    let disconnected = false;
    let welcomeReceived = false;

    room.onMessage('welcome', (message) => {
      console.log('✅ Welcome message received:', message);
      welcomeReceived = true;
    });

    room.onLeave((code) => {
      console.log(`👋 Room left with code: ${code}`);
      disconnected = true;
    });

    // Monitor for 5 seconds
    for (let i = 0; i < 50; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (disconnected) {
        console.log(`❌ DIRECT CREATION DISCONNECTION after ${i * 100}ms`);
        return;
      }
    }

    console.log('✅ Direct creation room remained connected');
    room.leave();

  } catch (error) {
    console.error('❌ Direct creation test failed:', error.message);
  }
}

// Run the test
testDisconnectionIssue();
