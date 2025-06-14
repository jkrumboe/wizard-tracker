import { Client } from 'colyseus.js';

async function testHostIdFix() {
  console.log('🎯 Testing HostId Fix for Room Creation...\n');

  try {
    const client = new Client('ws://localhost:5055');

    // Test: Create room with correct string hostId
    console.log('1️⃣ Creating room with string hostId...');
    const room = await client.create('wizard_game', {
      playerId: 44, // numeric player ID (this is fine)
      playerName: 'Justin',
      roomName: 'HostId Fix Test Room',
      maxPlayers: 4,
      gameMode: 'classic',
      isPublic: true,
      maxRounds: 5,
      hostId: '44' // String format for schema compatibility
    });

    console.log('✅ Room created successfully:', room.sessionId);

    // Listen for state changes
    room.onStateChange((state) => {
      console.log(`📊 Room state: HostId=${state.hostId} (type: ${typeof state.hostId}), Players: ${state.players?.size || 0}`);
      
      // Verify hostId is correct type
      if (typeof state.hostId === 'string') {
        console.log('✅ HostId is correctly stored as string');
      } else {
        console.log('❌ HostId is not a string:', typeof state.hostId);
      }
    });

    // Test player ready functionality
    setTimeout(() => {
      console.log('2️⃣ Testing player ready functionality...');
      room.send('playerReady', { ready: true });
    }, 1000);

    // Clean up after 5 seconds
    setTimeout(() => {
      console.log('3️⃣ Cleaning up...');
      room.leave();
      console.log('✅ HostId fix test completed successfully!\n');
      process.exit(0);
    }, 5000);

  } catch (error) {
    console.error('❌ HostId fix test failed:', error);
    process.exit(1);
  }
}

testHostIdFix();
