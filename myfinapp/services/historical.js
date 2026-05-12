// services/historical.js
// This module is kept for backward compatibility but now delegates to stockDataProvider
const stockDataProvider = require('./stockDataProvider');
const { createLogger } = require('../utils/logger');

const log = createLogger('HISTORICAL');

/**
 * Get historical prices for a ticker
 * This is a legacy wrapper that delegates to stockDataProvider
 * @param {string} indexKey - Index key (e.g., 'sp500') - unused, kept for API compatibility
 * @param {string} ticker - Stock ticker symbol
 * @param {number} from - Unix timestamp for start date
 * @param {number} to - Unix timestamp for end date
 * @param {Object} historicalCacheFiles - Per-request cache object
 * @returns {Promise<Object>} - { s, c, t } format
 */
async function getHistoricalPrices(indexKey, ticker, from, to, historicalCacheFiles = {}) {
  log.debug('getHistoricalPrices called', { indexKey, ticker, from, to });
  return stockDataProvider.getHistoricalPrices(ticker, from, to, historicalCacheFiles);
}

module.exports = {
  getHistoricalPrices,
};
