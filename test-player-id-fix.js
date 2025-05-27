// Test the specific user that was missing player_id
async function testPlayerIdFix() {
  console.log('🔍 Testing Player ID Fix for test@example.com...\n');

  try {
    // Test with the email login (if supported) or username
    console.log('1️⃣ Testing login with test@example.com user...');
    
    // First try with email
    const response1 = await fetch('http://localhost:5055/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        username: 'test@example.com',
        password: 'test123'
      })
    });

    if (response1.ok) {
      const data = await response1.json();
      console.log('✅ Email login successful:', data);
      console.log(`🎮 Player ID in response: ${data.user.player_id || 'MISSING!'}`);
    } else {
      console.log('❌ Email login failed:', response1.status);
      // Try with a username instead
      console.log('2️⃣ Trying with username format...');
      
      const response2 = await fetch('http://localhost:5055/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          username: 'testuser2',
          password: 'test123'
        })
      });

      if (response2.ok) {
        const data = await response2.json();
        console.log('✅ Username login successful:', data);
        console.log(`🎮 Player ID in response: ${data.user.player_id || 'MISSING!'}`);
      } else {
        console.log('❌ Username login also failed:', response2.status);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPlayerIdFix();
