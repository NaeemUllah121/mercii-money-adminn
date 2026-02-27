const admin = require('firebase-admin');

// Use environment variable for Firebase credentials in production, fallback to file in development
let initialized = false;

try {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Parse JSON from environment variable
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    credential = admin.credential.cert(serviceAccount);
  } else {
    // Fallback to local file for development
    const serviceAccount = require('../config/firebaseCreds.json');
    credential = admin.credential.cert(serviceAccount);
  }

  admin.initializeApp({
    credential: credential,
  });
  initialized = true;
  console.log('Firebase initialized successfully');
} catch (error) {
  console.warn('Firebase initialization failed. Firebase features will be disabled.', error.message);
}

module.exports = admin;