const { getRatesComparison, getBankRates } = require('../controllers/rates');

module.exports = (router) => {
  router.post('/rates/comparison', getRatesComparison);
  router.post('/getBankRates', getBankRates);
};
