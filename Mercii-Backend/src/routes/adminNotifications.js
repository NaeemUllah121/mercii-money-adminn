const express = require('express');
const router = express.Router();
const { getRealNotifications } = require('../controllers/adminNotifications');
const { adminAuth } = require('../middlewares/adminAuth');

// Real notifications endpoint
router.get('/real', adminAuth, getRealNotifications);

module.exports = router;
