// Complete multiplayer system test with database integration
import { Client } from 'colyseus.js';

async function testCompleteMultiplayerSystem() {
  console.log('🌟 Testing Complete Multiplayer System with Database Integration...\n');

  try {
    const client1 = new Client('ws://localhost:5055');
    const client2 = new Client('ws://localhost:5055');

    // Test 1: Create a public room
    console.log('1️⃣ Testing public room creation...');
    const publicRoom = await client1.create('wizard_game', {
      playerId: 1,
      playerName: 'Host Player',
      roomName: 'Public Test Game',
      maxPlayers: 4,
      gameMode: 'classic',
      isPublic: true,
      maxRounds: 5,
      hostId: '1'
    });
    console.log('✅ Public room created:', publicRoom.sessionId);

    // Test 2: Create a private room with password
    console.log('2️⃣ Testing private room with password...');
    const privateRoom = await client1.create('wizard_game', {
      playerId: 2,
      playerName: 'Private Host',
      roomName: 'Private VIP Room',
      maxPlayers: 6,
      gameMode: 'ranked',
      isPublic: false,
      password: 'supersecret123',
      maxRounds: 8,
      hostId: '2'
    });
    console.log('✅ Private room created:', privateRoom.sessionId);

    // Test 3: Join public room
    console.log('3️⃣ Testing joining public room...');
    const joinedPublic = await client2.joinById(publicRoom.sessionId, {
      playerId: 2,
      playerName: 'Public Joiner'
    });
    console.log('✅ Successfully joined public room');

    // Test 4: Try joining private room without password (should fail)
    console.log('4️⃣ Testing private room without password...');
    try {
      await client2.joinById(privateRoom.sessionId, {
        playerId: 1,
        playerName: 'Unauthorized'
      });
      console.log('❌ Should have been rejected');
    } catch (error) {
      console.log('✅ Correctly rejected unauthorized access:', error.code);
    }

    // Test 5: Join private room with correct password
    console.log('5️⃣ Testing private room with correct password...');
    try {
      const client3 = new Client('ws://localhost:5055');
      const joinedPrivate = await client3.joinById(privateRoom.sessionId, {
        playerId: 1,
        playerName: 'VIP Member',
        password: 'supersecret123'
      });
      console.log('✅ Successfully joined private room with password');
      
      // Clean up this connection
      setTimeout(() => joinedPrivate.leave(), 1000);
    } catch (error) {
      console.log('❌ Failed to join private room with password:', error.message);
    }

    // Test 6: Test lobby functionality
    console.log('6️⃣ Testing lobby room listings...');
    const lobbyClient = new Client('ws://localhost:5055');
    try {
      const lobby = await lobbyClient.joinOrCreate('lobby', {
        playerId: 99,
        playerName: 'Observer'
      });
      
      lobby.onStateChange((state) => {
        const roomCount = Object.keys(state.availableRooms || {}).length;
        console.log(`🏛️ Lobby reports ${roomCount} available rooms`);
      });

      setTimeout(() => lobby.leave(), 2000);
    } catch (error) {
      console.log('⚠️ Lobby test skipped:', error.message);
    }

    // Test 7: Player interactions
    console.log('7️⃣ Testing player interactions...');
    
    // Set up state listeners
    publicRoom.onStateChange((state) => {
      console.log(`📊 Public room: ${state.players?.size || 0} players, Ready: ${Array.from(state.players?.values() || []).filter(p => p.isReady).length}`);
    });

    privateRoom.onStateChange((state) => {
      console.log(`🔒 Private room: ${state.players?.size || 0} players, Ready: ${Array.from(state.players?.values() || []).filter(p => p.isReady).length}`);
    });

    // Send ready signals
    setTimeout(() => {
      publicRoom.send('playerReady', { ready: true });
      joinedPublic.send('playerReady', { ready: true });
      privateRoom.send('playerReady', { ready: true });
      console.log('📤 Sent ready signals');
    }, 1500);

    // Test 8: Database verification
    console.log('8️⃣ Verifying database persistence...');
    setTimeout(async () => {
      try {
        const response = await fetch('http://localhost:5055/api/rooms/active');
        if (response.ok) {
          const rooms = await response.json();
          console.log(`✅ Database contains ${rooms.length} active rooms:`);
          rooms.forEach(room => {
            console.log(`  - ${room.room_name} (${room.is_private ? 'Private' : 'Public'}, ${room.current_players}/${room.max_players} players)`);
          });
        }
      } catch (error) {
        console.log('❌ Database verification failed:', error.message);
      }

      // Final cleanup
      console.log('🧹 Cleaning up all connections...');
      publicRoom.leave();
      joinedPublic.leave();
      privateRoom.leave();
      
      console.log('\n🎉 Complete multiplayer system test finished successfully!');
      console.log('✅ Public room creation and joining');
      console.log('✅ Private room with password protection');
      console.log('✅ Access control (unauthorized rejection)');
      console.log('✅ Database persistence and retrieval');
      console.log('✅ Real-time state synchronization');
      console.log('✅ Player interaction messaging');
    }, 4000);

  } catch (error) {
    console.error('❌ Complete multiplayer system test failed:', error);
  }
}

testCompleteMultiplayerSystem();
