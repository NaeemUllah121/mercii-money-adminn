const express = require('express');
const router = express.Router();
const {
  getInfrastructureStatus,
  getSecurityAlerts,
  getLowBalanceAlerts,
  getTopUpLog,
  getVPNStatus
} = require('../controllers/adminInfrastructure');
const { adminAuth } = require('../middlewares/adminAuth');

// Infrastructure status
router.get('/status', adminAuth, getInfrastructureStatus);

// Security alerts
router.get('/security-alerts', adminAuth, getSecurityAlerts);

// Low balance alerts
router.get('/low-balance-alerts', adminAuth, getLowBalanceAlerts);

// Top-up log
router.get('/top-up-log', adminAuth, getTopUpLog);

// VPN status
router.get('/vpn-status', adminAuth, getVPNStatus);

module.exports = router;
