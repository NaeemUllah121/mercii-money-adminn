const admin = require('firebase-admin');

// Use environment variable for Firebase credentials in production, fallback to file in development
let credential;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Parse JSON from environment variable
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  credential = admin.credential.cert(serviceAccount);
} else {
  // Fallback to local file for development
  try {
    const serviceAccount = require('../config/firebaseCreds.json');
    credential = admin.credential.cert(serviceAccount);
  } catch (error) {
    console.warn('Firebase credentials not found. Firebase features will be disabled.');
    credential = null;
  }
}

if (credential) {
  admin.initializeApp({
    credential: credential,
  });
}

module.exports = admin;