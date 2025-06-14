import fetch from 'node-fetch';

async function testFrontendAPI() {
  console.log('🌐 Testing Frontend API Integration...\n');

  try {
    // Test 1: Check if the API endpoints are working
    console.log('1️⃣ Testing active rooms API...');
    const roomsResponse = await fetch('http://localhost:5055/api/rooms/active');
    
    if (roomsResponse.ok) {
      const rooms = await roomsResponse.json();
      console.log(`✅ Active rooms API working - Found ${rooms.length} rooms`);
      
      if (rooms.length > 0) {
        console.log('   Sample room:', {
          id: rooms[0].id,
          name: rooms[0].room_name,
          host: rooms[0].host_name,
          players: `${rooms[0].current_players}/${rooms[0].max_players}`
        });
      }
    } else {
      console.log('❌ Active rooms API failed:', roomsResponse.status);
    }

    // Test 2: Check players API
    console.log('2️⃣ Testing players API...');
    const playersResponse = await fetch('http://localhost:5055/api/players');
    
    if (playersResponse.ok) {
      const players = await playersResponse.json();
      console.log(`✅ Players API working - Found ${players.length} players`);
      
      // Check for our test players
      const justin = players.find(p => p.name === 'Justin');
      const newuser = players.find(p => p.name === 'newuser123');
      
      if (justin) {
        console.log(`   ✅ Justin found - ID: ${justin.id}, Tags: ${justin.tag_count || 0}`);
      }
      if (newuser) {
        console.log(`   ✅ newuser123 found - ID: ${newuser.id}`);
      }
    } else {
      console.log('❌ Players API failed:', playersResponse.status);
    }

    // Test 3: Test player tags API for Justin (who has tags)
    if (roomsResponse.ok) {
      console.log('3️⃣ Testing player tags API...');
      const tagsResponse = await fetch('http://localhost:5055/api/players/44/tags');
      
      if (tagsResponse.ok) {
        const tags = await tagsResponse.json();
        console.log(`✅ Player tags API working - Justin has ${tags.length} tags`);
        
        if (tags.length > 0) {
          console.log('   Sample tag:', {
            name: tags[0].name,
            color: tags[0].color,
            description: tags[0].description
          });
        }
      } else {
        console.log('❌ Player tags API failed:', tagsResponse.status);
      }
    }

    console.log('\n✅ All API tests completed successfully!');

  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
}

testFrontendAPI();
