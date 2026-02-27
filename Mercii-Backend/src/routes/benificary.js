const { createB, getBenificaries, updateBenificaryContact, delBenificary,updateBenificaryDetails} = require('../controllers/benificary');
const { authJwt } = require('../middlewares/authJwt');

module.exports = (router) => {
  // Step 1: Initiate signup with phone and email
  router.post('/benificary', authJwt, createB);
  router.get('/benificary', authJwt, getBenificaries);
  router.patch('/benificary/:id/contact', authJwt, updateBenificaryContact);
  router.delete('/benificary/:id', authJwt, delBenificary);
  router.patch('/benificary/:id', authJwt, updateBenificaryDetails);

};
