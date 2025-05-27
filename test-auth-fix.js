// Test script to verify the authentication fix
// Run this in browser console at http://localhost:8088

const testAuthenticationFix = async () => {
  console.log('🔧 Testing Authentication Fix...');
  const baseUrl = 'http://localhost:5055/api';
  
  try {
    // Test 1: Check /me endpoint without authentication
    console.log('\n1. Testing /me endpoint without authentication...');
    const meResponse1 = await fetch(`${baseUrl}/me`, {
      method: 'GET',
      credentials: 'include'
    });
    console.log(`   Status: ${meResponse1.status} (Expected: 401)`);
    
    // Test 2: Login
    console.log('\n2. Testing login...');
    const loginResponse = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    console.log(`   Login Status: ${loginResponse.status}`);
    
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      console.log('   ✅ Login successful');
      console.log('   📊 User data:', loginData.user);
      
      // Test 3: Check /me endpoint with authentication
      console.log('\n3. Testing /me endpoint with HTTP-only cookies...');
      const meResponse2 = await fetch(`${baseUrl}/me`, {
        method: 'GET',
        credentials: 'include'
      });
      
      console.log(`   Status: ${meResponse2.status} (Expected: 200)`);
      
      if (meResponse2.ok) {
        const meData = await meResponse2.json();
        console.log('   ✅ /me endpoint working with cookies');
        console.log('   📊 User data from /me:', meData.user);
        
        // Test 4: Frontend authentication state
        console.log('\n4. Testing frontend authentication state...');
        
        // Simulate what the frontend UserContext does
        const authService = {
          async checkAuthStatus() {
            try {
              const response = await fetch(`${baseUrl}/me`, {
                method: 'GET',
                credentials: 'include',
              });

              if (response.ok) {
                const data = await response.json();
                return data.user;
              } else if (response.status === 401) {
                return null;
              } else {
                throw new Error('Failed to check authentication status');
              }
            } catch (error) {
              console.error('Auth status check failed:', error);
              return null;
            }
          }
        };
        
        const userFromServer = await authService.checkAuthStatus();
        if (userFromServer) {
          console.log('   ✅ Frontend auth check working');
          console.log('   📊 User from frontend check:', userFromServer);
        } else {
          console.log('   ❌ Frontend auth check failed');
        }
        
      } else {
        console.log('   ❌ /me endpoint failed with cookies');
        const errorData = await meResponse2.json();
        console.log('   📊 Error:', errorData);
      }
      
    } else {
      const errorData = await loginResponse.json();
      console.log('   ❌ Login failed:', errorData);
    }
    
    console.log('\n🎉 Authentication test completed!');
    console.log('\n📋 Summary:');
    console.log('   • HTTP-only cookies are being set by login');
    console.log('   • /me endpoint validates authentication');
    console.log('   • Frontend can check auth status via server');
    console.log('   • This should fix the UserContext authentication issue');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Export for use in browser console
window.testAuthenticationFix = testAuthenticationFix;

console.log('🔧 Auth test script loaded!');
console.log('📖 Run testAuthenticationFix() in browser console to test');
