const {
  getRates,
  getDestinationCountries,
  getAgentDetails,
  getCurrentCredit,
  createRemitter,
  searchRemitter,
  updateRemitter,
  createBeneficiary,
  searchBeneficiary,
  createTransaction,
  confirmTransaction,
  getTransactionStatus,
  getTransactionDetails,
  getRemitterTransactions,
  getDeliveryBanks,
  getCollectionPoints,
  getCharges,
  getRemitterBeneficiaries,
  updateBeneficiary,

} = require('../controllers/usi');
const { authJwt } = require('../middlewares/authJwt');

module.exports = (router) => {
  // ============ BASIC INFO ENDPOINTS ============

  // Get exchange rates
  router.post('/usi/getRates', getRates);

  // Get destination countries
  router.post('/usi/destCountries', getDestinationCountries);

  // ============ AGENT ENDPOINTS ============

  // Get agent details and credentials
  router.post('/usi/agent/details', getAgentDetails);

  // Get current credit balance
  router.post('/usi/agent/credit', getCurrentCredit);

  // ============ REMITTER MANAGEMENT ============

  // Create a new remitter
  router.post('/usi/remitter/create', authJwt, createRemitter);

  // Search for existing remitters
  router.post('/usi/remitter/search', searchRemitter);

  // Update remitter information
  router.post('/usi/remitter/update', updateRemitter);

  // Get remitter beneficiaries
  router.post('/usi/remitter/beneficiaries', getRemitterBeneficiaries);

  // ============ BENEFICIARY MANAGEMENT ============

  // Create a new beneficiary
  router.post('/usi/beneficiary/create', createBeneficiary);
  router.post('/usi/beneficiary/update', updateBeneficiary);

  // Search for existing beneficiaries
  router.post('/usi/beneficiary/search', searchBeneficiary);

  // ============ TRANSACTION MANAGEMENT ============

  // Create a new transaction (returns session ID)
  router.post('/usi/transaction/create', createTransaction);

  // Confirm transaction using session ID
  router.post('/usi/transaction/confirm', confirmTransaction);

  // Get transaction status by reference
  router.post('/usi/transaction/status', getTransactionStatus);

  // Get detailed transaction information
  router.post('/usi/transaction/details', getTransactionDetails);

  // Get all transactions for a remitter
  router.post('/usi/transaction/remitter-transactions', getRemitterTransactions);

  // Calculate charges for a transaction
  router.post('/usi/transaction/charges', getCharges);

  // ============ DELIVERY INFORMATION ============

  // Get available delivery banks
  router.post('/usi/delivery/banks', getDeliveryBanks);

  // Get collection points for cash pickup
  router.post('/usi/delivery/collection-points', getCollectionPoints);

};