const express = require('express');
const router = express.Router();
const {
  getKYCIntegrationResults,
  getAMLIntegrationResults,
  getPaymentsIntegrationResults,
  getPayoutsIntegrationResults,
  getBackgroundJobs,
  getWebhooks,
  getServiceHealth
} = require('../controllers/adminIntegration');
const { adminAuth } = require('../middlewares/adminAuth');

// Integration Results
router.get('/kyc-results', adminAuth, getKYCIntegrationResults);
router.get('/aml-results', adminAuth, getAMLIntegrationResults);
router.get('/payments-results', adminAuth, getPaymentsIntegrationResults);
router.get('/payouts-results', adminAuth, getPayoutsIntegrationResults);

// Background Jobs & Webhooks
router.get('/background-jobs', adminAuth, getBackgroundJobs);
router.get('/webhooks', adminAuth, getWebhooks);

// Service Health
router.get('/service-health', adminAuth, getServiceHealth);

module.exports = router;
