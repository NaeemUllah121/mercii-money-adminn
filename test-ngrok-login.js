const axios = require('axios');

async function testNgrokLogin() {
  try {
    console.log('Testing login via ngrok...');
    
    const response = await axios.post('https://unverbalized-macrobiotically-olene.ngrok-free.dev/api/v1/admin/auth/login', {
      username: 'admin',
      password: 'Admin123!@#'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Ngrok login successful!');
    console.log('Response status:', response.status);
    console.log('Token received:', response.data.token ? 'Yes' : 'No');
    
  } catch (error) {
    console.log('❌ Ngrok login failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

testNgrokLogin();
