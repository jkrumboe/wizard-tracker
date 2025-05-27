// Test login functionality
async function testLogin() {
  console.log('🔐 Testing Login Functionality...\n');

  try {
    console.log('1️⃣ Testing login with test user...');
    const response = await fetch('http://localhost:5055/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        username: 'testuser',
        password: 'testpass123'
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Login successful:', data);
      
      // Test authenticated endpoint
      console.log('2️⃣ Testing authenticated endpoint...');
      const profileResponse = await fetch('http://localhost:5055/api/profile', {
        credentials: 'include'
      });
      
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        console.log('✅ Profile data:', profile);
      } else {
        console.log('❌ Profile request failed:', profileResponse.status);
      }
      
    } else {
      const error = await response.text();
      console.log('❌ Login failed:', response.status, error);
    }

    // Test other users
    console.log('3️⃣ Testing other test users...');
    const testUsers = ['player1', 'player2', 'gamer123', 'wizardpro', 'admin'];
    
    for (const username of testUsers) {
      const userResponse = await fetch('http://localhost:5055/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          username: username,
          password: 'testpass123'
        })
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        console.log(`✅ ${username} login successful`);
      } else {
        console.log(`❌ ${username} login failed:`, userResponse.status);
      }
    }

  } catch (error) {
    console.error('❌ Login test failed:', error);
  }
}

testLogin();
