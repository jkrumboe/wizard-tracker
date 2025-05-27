// Test password-protected room functionality
import { Client } from 'colyseus.js';

async function testPasswordRooms() {
  console.log('🔐 Testing Password-Protected Room Functionality...\n');

  try {    // Test 1: Create password-protected room via API
    console.log('1️⃣ Creating password-protected room via API...');
    const response = await fetch('http://localhost:5055/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        room_name: 'Test Private Room',
        max_players: 4,
        is_private: true,
        password: 'testpass123',
        game_mode: 'classic',
        settings: {
          maxRounds: 6,
          allowSpectators: false
        },
        host_player_id: 12345
      })
    });

    if (response.ok) {
      const roomData = await response.json();
      console.log('✅ Password-protected room created:', roomData);
      
      // Test 2: Try to join room with wrong password
      console.log('2️⃣ Testing wrong password rejection...');
      const client = new Client('ws://localhost:5055');
      
      try {
        await client.joinById(roomData.colyseus_room_id, {
          playerId: 67890,
          playerName: 'TestPlayer2',
          password: 'wrongpassword'
        });
        console.log('❌ Should have rejected wrong password');
      } catch (error) {
        console.log('✅ Correctly rejected wrong password:', error.message);
      }

      // Test 3: Join room with correct password
      console.log('3️⃣ Testing correct password access...');
      try {
        const room = await client.joinById(roomData.colyseus_room_id, {
          playerId: 67890,
          playerName: 'TestPlayer2',
          password: 'testpass123'
        });
        console.log('✅ Successfully joined with correct password:', room.sessionId);
        
        // Clean up
        setTimeout(() => {
          room.leave();
          console.log('🧹 Cleaned up room connection');
        }, 1000);
        
      } catch (error) {
        console.log('❌ Failed to join with correct password:', error.message);
      }

    } else {
      console.log('❌ Failed to create room:', await response.text());
    }

    // Test 4: Check database persistence
    console.log('4️⃣ Checking database persistence...');
    setTimeout(async () => {
      const roomsResponse = await fetch('http://localhost:5055/api/rooms/active');
      if (roomsResponse.ok) {
        const rooms = await roomsResponse.json();
        console.log('✅ Active rooms in database:', rooms.length);
        rooms.forEach(room => {
          console.log(`  - ${room.room_name} (${room.is_private ? 'Private' : 'Public'})`);
        });
      }
      console.log('🎯 Password room test completed!');
    }, 2000);

  } catch (error) {
    console.error('❌ Password room test failed:', error);
  }
}

testPasswordRooms();
