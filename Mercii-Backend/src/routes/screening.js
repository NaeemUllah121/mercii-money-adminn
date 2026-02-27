const { checkIndividual, checkIndividualAdverseMedia } = require('../controllers/screening');
const { authJwt } = require('../middlewares/authJwt');


module.exports = (router) => {
  // Step 1: Initiate signup with phone and email
  router.post('/screening/single',authJwt, checkIndividual);
  router.post('/screening/adverseMedia', authJwt, checkIndividualAdverseMedia);

};
