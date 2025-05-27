// Test simple room creation with proper data types
import { Client } from 'colyseus.js';

async function testSimpleRoomCreation() {
  console.log('🎯 Testing Simple Room Creation with Correct Data Types...\n');

  try {
    const client = new Client('ws://localhost:5055');    // Test: Create room with all numeric IDs
    console.log('1️⃣ Creating room with valid player ID...');
    const room = await client.create('wizard_game', {
      playerId: 1, // Use existing player ID
      playerName: 'TestPlayer',
      roomName: 'Database Test Room',
      maxPlayers: 4,
      gameMode: 'classic',
      isPublic: true,
      maxRounds: 5,
      hostId: '1' // String format for schema compatibility
    });

    console.log('✅ Room created successfully:', room.sessionId);

    // Listen for state changes
    room.onStateChange((state) => {
      console.log(`📊 Room state: ${state.players?.size || 0} players, Host: ${state.hostId}`);
    });

    // Keep room alive for database to process
    setTimeout(() => {
      console.log('🧹 Leaving room...');
      room.leave();
      
      // Check database after cleanup
      setTimeout(async () => {
        console.log('🔍 Checking database...');
        try {
          const response = await fetch('http://localhost:5055/api/rooms/active');
          if (response.ok) {
            const rooms = await response.json();
            console.log(`✅ Found ${rooms.length} rooms in database`);
            rooms.forEach(r => console.log(`  - ${r.room_name} (${r.colyseus_room_id})`));
          } else {
            console.log('❌ Failed to fetch rooms from API');
          }
        } catch (error) {
          console.log('❌ API request failed:', error.message);
        }
        
        console.log('🎯 Simple room creation test completed!');
      }, 2000);
    }, 3000);

  } catch (error) {
    console.error('❌ Simple room creation test failed:', error);
  }
}

testSimpleRoomCreation();
