const express = require('express');
const {
  login,
  logout,
  enableMFA,
  verifyAndEnableMFA,
  disableMFA,
  getProfile,
  changePassword
} = require('../controllers/adminAuth');
const { adminAuth, requirePermission } = require('../middlewares/adminAuth');

const router = express.Router();

// Public routes
router.post('/login', login);

// Protected routes
router.post('/logout', adminAuth, logout);
router.get('/profile', adminAuth, getProfile);
router.post('/change-password', adminAuth, changePassword);

// MFA routes
router.post('/mfa/enable', adminAuth, requirePermission('manage_system'), enableMFA);
router.post('/mfa/verify', adminAuth, requirePermission('manage_system'), verifyAndEnableMFA);
router.post('/mfa/disable', adminAuth, requirePermission('manage_system'), disableMFA);

module.exports = router;
