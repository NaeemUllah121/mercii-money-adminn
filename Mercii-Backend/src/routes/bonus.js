const express = require('express');
const router = express.Router();
const { getUserBonuses, getBonusPreview, redeemBonus, getMonthlyBonusSummary } = require('../controllers/bonus');
const { authJwt } = require('../middlewares/authJwt');

// GET /api/bonus
router.get('/', authJwt, getUserBonuses);
router.get('/preview', authJwt, getBonusPreview);
router.get('/summary', authJwt, getMonthlyBonusSummary);
router.post('/redeem', authJwt, redeemBonus);

module.exports = router;
