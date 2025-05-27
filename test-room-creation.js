// Test Colyseus room creation with database integration
import { Client } from 'colyseus.js';

async function testRoomCreationFlow() {
  console.log('🎮 Testing Complete Room Creation Flow...\n');

  try {
    const client = new Client('ws://localhost:5055');

    // Test 1: Create a public room with database integration
    console.log('1️⃣ Creating public room with database integration...');
    const publicRoom = await client.create('wizard_game', {
      playerId: 12345,
      playerName: 'TestHost',
      roomName: 'Public Test Room',
      maxPlayers: 4,
      gameMode: 'classic',
      isPublic: true,
      maxRounds: 5,
      hostId: 'test-host-1',
      // This should trigger database creation
      saveToDatabase: true
    });

    console.log('✅ Public room created:', publicRoom.sessionId);

    // Wait a moment for database operations
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Create a private room with password
    console.log('2️⃣ Creating private room with password...');
    const privateRoom = await client.create('wizard_game', {
      playerId: 12346,
      playerName: 'PrivateHost',
      roomName: 'Private Test Room',
      maxPlayers: 6,
      gameMode: 'classic',
      isPublic: false,
      password: 'secretpass123',
      maxRounds: 8,
      hostId: 'private-host-1'
    });

    console.log('✅ Private room created:', privateRoom.sessionId);

    // Test 3: Try to join private room without password (should fail)
    console.log('3️⃣ Testing private room access without password...');
    try {
      const client2 = new Client('ws://localhost:5055');
      await client2.joinById(privateRoom.sessionId, {
        playerId: 99999,
        playerName: 'Unauthorized'
        // No password provided
      });
      console.log('❌ Should have rejected access without password');
    } catch (error) {
      console.log('✅ Correctly rejected access without password:', error.code);
    }

    // Test 4: Join private room with correct password
    console.log('4️⃣ Testing private room access with correct password...');
    try {
      const client3 = new Client('ws://localhost:5055');
      const joinedRoom = await client3.joinById(privateRoom.sessionId, {
        playerId: 99998,
        playerName: 'AuthorizedPlayer',
        password: 'secretpass123'
      });
      console.log('✅ Successfully joined private room with password:', joinedRoom.sessionId);
      
      // Clean up this connection
      setTimeout(() => joinedRoom.leave(), 500);
    } catch (error) {
      console.log('❌ Failed to join with correct password:', error.message);
    }

    // Test 5: Test game state updates
    console.log('5️⃣ Testing game state updates...');
    
    publicRoom.onStateChange((state) => {
      console.log(`📊 Public room state: ${state.players?.size || 0} players, Started: ${state.gameStarted}`);
    });

    privateRoom.onStateChange((state) => {
      console.log(`🔒 Private room state: ${state.players?.size || 0} players, Started: ${state.gameStarted}`);
    });

    // Send some test messages
    setTimeout(() => {
      publicRoom.send('playerReady', { ready: true });
      privateRoom.send('playerReady', { ready: true });
      console.log('📤 Sent ready signals to both rooms');
    }, 1000);

    // Test 6: Check lobby for room listings
    console.log('6️⃣ Testing lobby room listings...');
    setTimeout(async () => {
      try {
        const lobby = await client.joinOrCreate('lobby', {
          playerId: 88888,
          playerName: 'LobbyObserver'
        });

        lobby.onStateChange((state) => {
          const publicRooms = state.availableRooms?.filter(room => room.isPublic) || [];
          console.log(`🏛️ Lobby shows ${publicRooms.length} public rooms available`);
        });

        // Clean up lobby
        setTimeout(() => lobby.leave(), 2000);
      } catch (error) {
        console.log('⚠️ Lobby test failed:', error.message);
      }
    }, 1500);

    // Clean up after tests
    setTimeout(() => {
      console.log('🧹 Cleaning up test rooms...');
      publicRoom.leave();
      privateRoom.leave();
      console.log('✅ Room creation flow test completed!');
    }, 5000);

  } catch (error) {
    console.error('❌ Room creation flow test failed:', error);
  }
}

testRoomCreationFlow();
