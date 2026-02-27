// Shim to maintain original file reference
// Re-export compareRates from the new rate_comparison utility
const { compareRates } = require('./rate_comparison');

module.exports = {
  compareRates,
};