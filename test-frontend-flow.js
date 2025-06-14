import { Client } from 'colyseus.js';

// Test the exact issue: Create room directly without database pre-creation
async function testFrontendFlow() {
  console.log('🎯 Testing Frontend Room Creation Flow...\n');

  try {
    console.log('1️⃣ Creating room directly with Colyseus (like createGameRoom)...');
    const client = new Client('ws://localhost:5055');
    
    // This mimics the colyseusOptions from createGameRoom method
    const colyseusOptions = {
      dbRoomId: null, // No pre-created database room
      roomName: 'Frontend Flow Test Room',
      maxPlayers: 4,
      gameMode: 'classic',
      maxRounds: 10,
      isPublic: true,
      hostId: '44', // String format as in frontend
      playerId: 44,
      playerName: 'TestPlayer',
      avatar: '',
      elo: 1000
    };

    console.log('📤 Creating room with options:', JSON.stringify(colyseusOptions, null, 2));
    
    const room = await client.create('wizard_game', colyseusOptions);
    console.log('✅ Room created successfully:', room.sessionId);

    // Set up monitoring like in MultiplayerGame.jsx
    let welcomeReceived = false;
    let stateReceived = false;
    let disconnected = false;
    let disconnectCode = null;

    room.onMessage('welcome', (message) => {
      console.log('📨 Welcome message received:', message);
      welcomeReceived = true;
    });

    room.onStateChange((state) => {
      console.log('📊 State change received:', {
        players: state.players?.size || 0,
        gameStarted: state.gameStarted,
        hostId: state.hostId
      });
      stateReceived = true;
    });

    room.onError((code, message) => {
      console.log('❌ Room error received:', code, message);
    });

    room.onLeave((code) => {
      console.log('👋 Room disconnected with code:', code);
      disconnected = true;
      disconnectCode = code;
    });

    // Monitor for 5 seconds like a real user would
    console.log('2️⃣ Monitoring room stability for 5 seconds...');
    
    for (let i = 0; i < 50; i++) { // 5 seconds, 100ms intervals
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (disconnected) {
        console.log(`❌ DISCONNECTION DETECTED after ${i * 100}ms`);
        console.log(`   Disconnect code: ${disconnectCode}`);
        console.log(`   Welcome received: ${welcomeReceived}`);
        console.log(`   State received: ${stateReceived}`);
        
        if (disconnectCode === 4000) {
          console.log('🔍 Code 4000 = Normal closure by server');
        } else if (disconnectCode === 1000) {
          console.log('🔍 Code 1000 = Normal closure by client');
        }
        return;
      }
      
      // Log progress every second
      if (i % 10 === 0) {
        console.log(`   ... ${i/10}s - still connected`);
      }
    }

    console.log('✅ Room remained stable for 5 seconds!');
    console.log(`   Welcome received: ${welcomeReceived}`);
    console.log(`   State received: ${stateReceived}`);

    // Test navigation-like behavior
    console.log('3️⃣ Simulating navigation to game room...');
    
    // Don't leave room, just stop monitoring (like navigation would do)
    console.log('   Room should remain active for reconnection');

    // Wait a bit more to see if it auto-disconnects
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (disconnected) {
      console.log('❌ Room disconnected after simulated navigation');
    } else {
      console.log('✅ Room remained active after simulated navigation');
    }

    // Clean up
    room.leave();

  } catch (error) {
    console.error('❌ Frontend flow test failed:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testFrontendFlow();
