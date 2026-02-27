const { createTransaction, VolumeWebHook, deepRoutes, listTransactions, listAllTransactions, listFailedTransactions } = require('../controllers/transaction');
const { authJwt, canMakeTransaction } = require('../middlewares/authJwt');
const { ipWhitelist } = require('../middlewares/ipWhitelist');
const { verifyVolumeSignature } = require('../middlewares/verifyVolumeSignature');

module.exports = (router) => {

  router.get('/transaction/redirect', deepRoutes);
  router.put('/transaction/VolumeWebHook', ipWhitelist, verifyVolumeSignature, VolumeWebHook);

  router.post('/transaction', authJwt, createTransaction);
  router.get('/transaction/failed', authJwt, listFailedTransactions);
  router.get('/transaction/:id', authJwt, listTransactions);
  router.get('/transaction', authJwt, listAllTransactions);

};
