const {
  getOverviewKPIs,
  getCustomers,
  getTransactions,
  getMLROFlags,
  approveMLROFlag,
  rejectMLROFlag,
  holdMLROFlag,
  refundTransaction,
  cancelBeforePayout,
  resendKYC,
  suspendCustomer,
  unsuspendCustomer,
  getServiceHealth,
  getAlerts,
  exportReconciliationCSV
} = require('../controllers/admin');

const {
  getCustomerProfile,
  adjustCustomerLimits,
  getCustomerTransactions,
  manageBeneficiary,
  triggerAMLRescreen
} = require('../controllers/adminCustomer');

const {
  getReconciliationReport,
  getWebhookStatus,
  getBackgroundJobs,
  retryWebhook,
  markVarianceResolved,
  getSystemMetrics
} = require('../controllers/adminOperations');

const { adminAuth, requirePermission, auditAction } = require('../middlewares/adminAuth');

module.exports = (router) => {
  // Overview endpoints
  router.get('/overview/kpis', adminAuth, requirePermission('read'), auditAction('READ', 'SYSTEM'), getOverviewKPIs);
  router.get('/overview/health', adminAuth, requirePermission('read'), auditAction('READ', 'SYSTEM'), getServiceHealth);
  router.get('/overview/alerts', adminAuth, requirePermission('read'), auditAction('READ', 'SYSTEM'), getAlerts);
  router.get('/overview/metrics', adminAuth, requirePermission('read'), auditAction('READ', 'SYSTEM'), getSystemMetrics);

  // Customer management endpoints
  router.get('/customers', adminAuth, requirePermission('read'), auditAction('READ', 'USER'), getCustomers);
  router.get('/customers/:id', adminAuth, requirePermission('read'), auditAction('READ', 'USER'), getCustomerProfile);
  router.get('/customers/:id/transactions', adminAuth, requirePermission('read'), auditAction('READ', 'USER'), getCustomerTransactions);
  router.post('/customers/:id/suspend', adminAuth, requirePermission('suspend_customers'), auditAction('SUSPEND_CUSTOMER', 'USER'), suspendCustomer);
  router.post('/customers/:id/unsuspend', adminAuth, requirePermission('suspend_customers'), auditAction('UNSUSPEND_CUSTOMER', 'USER'), unsuspendCustomer);
  router.post('/customers/:id/resend-kyc', adminAuth, requirePermission('resend_kyc'), auditAction('RESEND_KYC', 'USER'), resendKYC);
  router.post('/customers/:id/adjust-limits', adminAuth, requirePermission('write'), auditAction('ADJUST_LIMITS', 'USER'), adjustCustomerLimits);
  router.post('/customers/:id/aml-rescreen', adminAuth, requirePermission('write'), auditAction('AML_RESCREEN', 'USER'), triggerAMLRescreen);
  router.post('/customers/:customerId/beneficiaries/:beneficiaryId', adminAuth, requirePermission('write'), auditAction('MANAGE_BENEFICIARY', 'BENEFICIARY'), manageBeneficiary);

  // Transaction management endpoints
  router.get('/transactions/search', adminAuth, requirePermission('read'), auditAction('READ', 'TRANSACTION'), getTransactions);
  router.post('/transactions/:id/refund', adminAuth, requirePermission('write'), auditAction('REFUND_TRANSACTION', 'TRANSACTION'), refundTransaction);
  router.post('/transactions/:id/cancel', adminAuth, requirePermission('write'), auditAction('CANCEL_TRANSACTION', 'TRANSACTION'), cancelBeforePayout);

  // Compliance endpoints
  router.get('/compliance/mlro-flags', adminAuth, requirePermission('read'), auditAction('READ', 'MLRO_FLAG'), getMLROFlags);
  router.post('/compliance/mlro-flags/:id/approve', adminAuth, requirePermission('approve_mlro'), auditAction('APPROVE_MLRO', 'MLRO_FLAG'), approveMLROFlag);
  router.post('/compliance/mlro-flags/:id/reject', adminAuth, requirePermission('approve_mlro'), auditAction('REJECT_MLRO', 'MLRO_FLAG'), rejectMLROFlag);
  router.post('/compliance/mlro-flags/:id/hold', adminAuth, requirePermission('approve_mlro'), auditAction('HOLD_MLRO', 'MLRO_FLAG'), holdMLROFlag);

  // Operations endpoints
  router.get('/operations/reconciliation', adminAuth, requirePermission('read'), auditAction('READ', 'SYSTEM'), getReconciliationReport);
  router.get('/operations/reconciliation/export', adminAuth, requirePermission('read'), auditAction('EXPORT_DATA', 'TRANSACTION'), exportReconciliationCSV);
  router.get('/operations/webhooks', adminAuth, requirePermission('read'), auditAction('READ', 'SYSTEM'), getWebhookStatus);
  router.get('/operations/jobs', adminAuth, requirePermission('read'), auditAction('READ', 'SYSTEM'), getBackgroundJobs);
  router.post('/operations/webhooks/:id/retry', adminAuth, requirePermission('write'), auditAction('RETRY_WEBHOOK', 'SYSTEM'), retryWebhook);
  router.post('/operations/variances/:id/resolve', adminAuth, requirePermission('write'), auditAction('RESOLVE_VARIANCE', 'SYSTEM'), markVarianceResolved);

  return router;
};
