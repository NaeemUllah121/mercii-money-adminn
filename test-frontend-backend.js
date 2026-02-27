const axios = require('axios');

async function testFrontendBackendConnection() {
  try {
    console.log('Testing frontend-backend connection...');
    
    // Test backend directly
    console.log('1. Testing backend directly...');
    const backendResponse = await axios.post('http://localhost:3000/api/v1/admin/auth/login', {
      username: 'admin',
      password: 'Admin123!@#'
    });
    console.log('✅ Backend direct login successful');

    // Test frontend (should serve React app)
    console.log('2. Testing frontend...');
    const frontendResponse = await axios.get('http://localhost:3002/');
    console.log('✅ Frontend serving React app');

    // Test API through frontend (should fail since frontend doesn't proxy)
    console.log('3. Testing API through frontend (expected to fail)...');
    try {
      await axios.post('http://localhost:3002/api/v1/admin/auth/login', {
        username: 'admin',
        password: 'Admin123!@#'
      });
      console.log('❌ Unexpected: API through frontend worked');
    } catch (error) {
      console.log('✅ Expected: API through frontend failed (404)');
    }

    console.log('\n🎯 Current Status:');
    console.log('- Backend (port 3000): ✅ Working');
    console.log('- Frontend (port 3002): ✅ Working');
    console.log('- API Connection: ❌ Needs proxy or direct connection');
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testFrontendBackendConnection();
