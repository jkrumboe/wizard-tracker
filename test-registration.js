async function testRegistration() {
  try {
    const registerData = {
      username: 'newuser123',
      email: 'newuser@test.com',
      password: 'TestPass123'
    };

    console.log('🔧 Testing registration with:', {
      username: registerData.username,
      email: registerData.email,
      password: '***'
    });

    const response = await fetch('http://localhost:5055/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registerData),
      credentials: 'include' // Include cookies for JWT
    });

    console.log('📡 Registration response status:', response.status);

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Registration successful:', result);
      
      // Test immediate profile access
      const profileResponse = await fetch('http://localhost:5055/api/me', {
        method: 'GET',
        credentials: 'include' // Include cookies for JWT
      });
      
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        console.log('✅ Profile data after registration:', profile);
      } else {
        console.log('❌ Profile request failed:', profileResponse.status);
        const errorText = await profileResponse.text();
        console.log('Error text:', errorText);
      }
    } else {
      const error = await response.json();
      console.log('❌ Registration failed:', error);
    }
  } catch (error) {
    console.error('🔥 Error during registration test:', error);
  }
}

testRegistration();
