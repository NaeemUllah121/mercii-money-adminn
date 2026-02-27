const axios = require('axios');
const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
  maxContentLength: 25 * 1024 * 1024,
  maxBodyLength: 25 * 1024 * 1024,
  validateStatus: (status) => status >= 200 && status < 300,
});

// Request interceptor for optional Basic Auth
api.interceptors.request.use(
  async (config) => {
    // Basic Auth
    if (config.auth && config.auth.username && config.auth.password) {
      const encoded = Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64');
      config.headers.Authorization = `Basic ${encoded}`;
      delete config.auth;
    }
    // Bearer Token
    if (config.token) {
      config.headers.Authorization = `Bearer ${config.token}`;
      delete config.token;
    }
    if (config.headers) {
      config.headers['x-api-key'] = config.headers['x-api-key'];
    }
    return config;
  },
(error) => Promise.reject(error)
);

// Global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Helper to sleep between retries
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Decide if an error is transient and should be retried
function isTransientError(error) {
  const code = error?.code;
  const status = error?.response?.status;
  if (code && ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)) return true;
  if (status && [502, 503, 504].includes(status)) return true;
  return false;
}

// Generic request function with basic retries
const apiService = async (options) => {
  const retries = typeof options.retries === 'number' ? options.retries : 2;
  const baseDelay = typeof options.retryDelayMs === 'number' ? options.retryDelayMs : 300;
  // Do not forward custom retry options to axios
  const { retries: _r, retryDelayMs: _d, ...axiosOptions } = options;

  let attempt = 0;
  while (true) {
    try {
      const response = await api(axiosOptions);
      return response.data;
    } catch (error) {
      attempt += 1;
      if (attempt <= retries && isTransientError(error)) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await sleep(delay);
        continue;
      }
      // Re-throw original error so callers can inspect error.response, error.code, etc.
      throw error;
    }
  }
};

module.exports = { apiService };
