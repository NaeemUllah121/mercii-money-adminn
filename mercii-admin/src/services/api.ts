import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000/api/v1'
    : `${window.location.protocol}//${window.location.hostname}/api/v1`);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (username: string, password: string, mfaToken?: string) =>
    api.post('/admin/auth/login', { username, password, mfaToken }),
  logout: () => api.post('/admin/auth/logout'),
  getProfile: () => api.get('/admin/auth/profile'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/admin/auth/change-password', { currentPassword, newPassword }),
};

// Overview API
export const overviewAPI = {
  getKPIs: () => api.get('/admin/overview/kpis'),
  getHealth: () => api.get('/admin/overview/health'),
  getAlerts: (severity?: string) => api.get('/admin/overview/alerts', { params: { severity } }),
  getMetrics: (timeframe?: string) => api.get('/admin/overview/metrics', { params: { timeframe } }),
};

// Integration Results
export const integrationResultsAPI = {
  getKYCIntegrationResults: () => api.get('/admin/integration/kyc-results'),
  getAMLIntegrationResults: () => api.get('/admin/integration/aml-results'),
  getPaymentsIntegrationResults: () => api.get('/admin/integration/payments-results'),
  getPayoutsIntegrationResults: () => api.get('/admin/integration/payouts-results'),
  getBackgroundJobs: () => api.get('/admin/integration/background-jobs'),
  getWebhooks: () => api.get('/admin/integration/webhooks'),
  getServiceHealth: () => api.get('/admin/integration/service-health'),
};

// Infrastructure
export const infrastructureAPI = {
  getInfrastructureStatus: () => api.get('/admin/infrastructure/status'),
  getSecurityAlerts: () => api.get('/admin/infrastructure/security-alerts'),
  getLowBalanceAlerts: () => api.get('/admin/infrastructure/low-balance-alerts'),
  getTopUpLog: () => api.get('/admin/infrastructure/top-up-log'),
  getVPNStatus: () => api.get('/admin/infrastructure/vpn-status'),
};

// Notifications
export const notificationsAPI = {
  getRealNotifications: () => api.get('/admin/notifications/real'),
};

// Customer API
export const customerAPI = {
  getCustomers: (params: { page?: number; limit?: number; search?: string; status?: string; kycStatus?: string }) =>
    api.get('/admin/customers', { params }),
  getCustomerProfile: (id: string) => api.get(`/admin/customers/${id}`),
  getCustomerTransactions: (id: string, params?: { page?: number; limit?: number; status?: string }) =>
    api.get(`/admin/customers/${id}/transactions`, { params }),
  suspendCustomer: (id: string, reason: string) =>
    api.post(`/admin/customers/${id}/suspend`, { reason }),
  unsuspendCustomer: (id: string) =>
    api.post(`/admin/customers/${id}/unsuspend`),
  resendKYC: (id: string) => api.post(`/admin/customers/${id}/resend-kyc`),
  adjustLimits: (id: string, transferLimit: number, reason: string) =>
    api.post(`/admin/customers/${id}/adjust-limits`, { transferLimit, reason }),
  amlRescreen: (id: string, reason: string) =>
    api.post(`/admin/customers/${id}/aml-rescreen`, { reason }),
  manageBeneficiary: (customerId: string, beneficiaryId: string, action: string, reason?: string) =>
    api.post(`/admin/customers/${customerId}/beneficiaries/${beneficiaryId}`, { action, reason }),
};

// Transaction API
export const transactionAPI = {
  getTransactions: (params: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get('/admin/transactions/search', { params }),
  refund: (id: string, reason: string) =>
    api.post(`/admin/transactions/${id}/refund`, { reason }),
  cancel: (id: string, reason: string) =>
    api.post(`/admin/transactions/${id}/cancel`, { reason }),
};

// Compliance API
export const complianceAPI = {
  getMLROFlags: (params?: { page?: number; limit?: number; type?: string; severity?: string; status?: string }) =>
    api.get('/admin/compliance/mlro-flags', { params }),
  approveFlag: (id: string, notes: string) =>
    api.post(`/admin/compliance/mlro-flags/${id}/approve`, { notes }),
  rejectFlag: (id: string, notes: string) =>
    api.post(`/admin/compliance/mlro-flags/${id}/reject`, { notes }),
  holdFlag: (id: string, notes: string) =>
    api.post(`/admin/compliance/mlro-flags/${id}/hold`, { notes }),
};

// Operations API
export const operationsAPI = {
  getReconciliation: (date?: string) =>
    api.get('/admin/operations/reconciliation', { params: { date } }),
  exportReconciliationCSV: (date?: string) =>
    api.get('/admin/operations/reconciliation/export', { params: { date }, responseType: 'blob' }),
  getWebhooks: (status?: string) =>
    api.get('/admin/operations/webhooks', { params: { status } }),
  getJobs: (status?: string) =>
    api.get('/admin/operations/jobs', { params: { status } }),
  retryWebhook: (id: string) =>
    api.post(`/admin/operations/webhooks/${id}/retry`),
  resolveVariance: (id: string, resolution: string, notes: string) =>
    api.post(`/admin/operations/variances/${id}/resolve`, { resolution, notes }),
};

export default api;
