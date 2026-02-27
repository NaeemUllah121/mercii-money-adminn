const { createFcm } = require('../controllers/user');
const { authJwt } = require('../middlewares/authJwt');

module.exports = (router) => {
  // Step 1: Initiate signup with phone and email
  router.post('/fcm', createFcm);

};
