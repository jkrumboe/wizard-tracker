// Simple API test script using fetch
console.log('🌐 Testing Wizard Tracker API endpoints...\n');

async function testAPIEndpoints() {
  const baseUrl = 'http://localhost:5055'; // Backend runs on port 5055 in Docker
  
  try {
    // Test 1: Health check
    console.log('1️⃣ Testing server health...');
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    if (healthResponse.ok) {
      console.log('✅ Server is healthy');
    } else {
      console.log('⚠️ Health check failed:', healthResponse.status);
    }

    // Test 2: Active rooms endpoint
    console.log('2️⃣ Testing /api/rooms/active...');
    const roomsResponse = await fetch(`${baseUrl}/api/rooms/active`);
    if (roomsResponse.ok) {
      const rooms = await roomsResponse.json();
      console.log('✅ Active rooms fetched:', rooms.length, 'rooms');
      console.log('📊 Rooms data:', JSON.stringify(rooms, null, 2));
    } else {
      console.log('⚠️ Active rooms endpoint returned:', roomsResponse.status);
      const errorText = await roomsResponse.text();
      console.log('Error details:', errorText);
    }

    // Test 3: Test database connection via API
    console.log('3️⃣ Testing database connection...');
    try {
      const dbTestResponse = await fetch(`${baseUrl}/api/players`);
      if (dbTestResponse.ok) {
        console.log('✅ Database connection working');
      } else {
        console.log('⚠️ Database test failed:', dbTestResponse.status);
      }
    } catch (error) {
      console.log('❌ Database test error:', error.message);
    }

    console.log('\n✅ API endpoints test completed!');
  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
}

// Test WebSocket connection
async function testWebSocketConnection() {
  console.log('\n🔌 Testing WebSocket connection...\n');
  
  try {
    // We'll use a simple WebSocket to test if the Colyseus server is responding
    const WebSocket = (await import('ws')).default;
    const ws = new WebSocket('ws://localhost:5055');
    
    ws.on('open', () => {
      console.log('✅ WebSocket connection successful');
      ws.close();
    });
    
    ws.on('error', (error) => {
      console.log('❌ WebSocket connection failed:', error.message);
    });
    
  } catch (error) {
    console.log('⚠️ WebSocket test skipped (ws package not available)');
  }
}

// Run tests
console.log('🎮 Wizard Tracker API Test Suite');
console.log('='.repeat(50));

testAPIEndpoints().then(() => {
  testWebSocketConnection();
});
