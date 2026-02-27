const { callback, kyc, simpleKyc, callbackSimple, getKycresults, saveKycAddress, getKycStatus } = require('../controllers/kyc');
const { authJwt } = require('../middlewares/authJwt');

module.exports = (router) => {
  // Step 1: Initiate signup with phone and email
  router.post('/kyc/callback', callback);
  router.post('/kyc/sp-notify-callback', callbackSimple);
  router.post('/kyc/simpleKyc', authJwt, simpleKyc);
  router.post('/kyc', authJwt, kyc);
  router.get('/kyc/results', authJwt, getKycresults);
  router.get('/kyc/status', authJwt, getKycStatus);
  router.post('/kyc/address', authJwt, saveKycAddress);
};
