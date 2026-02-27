const express = require('express');
const router = express.Router();
const { login, logout } = require('../controllers/simpleAuth');

// Login endpoint
router.post('/login', login);

// Logout endpoint
router.post('/logout', logout);

module.exports = router;
