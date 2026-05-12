// config/fmpApiClient.js
// FMP uses /stable/ endpoints (not /api/v3/ which returns 403 on free tier)
// Batch quotes (?symbol=A,B,C) return 402 on free tier — must use individual calls
const axios = require('axios');
const { createLogger } = require('../utils/logger');

const log = createLogger('FMP_API');

const FMP_API_KEY = process.env.FMP_API_KEY || 'demo';
const BASE_URL = 'https://financialmodelingprep.com/stable';
const DAILY_LIMIT = 250; // Free tier limit

// Delay between sequential quote calls to avoid hitting rate limits
const CALL_DELAY_MS = 50;

// Daily call tracking
let dailyCallCount = 0;
let lastResetDate = new Date().toDateString();

function checkAndResetDailyCount() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    log.info('Daily API call counter reset', { previousCount: dailyCallCount, date: today });
    dailyCallCount = 0;
    lastResetDate = today;
  }
}

function incrementCallCount() {
  checkAndResetDailyCount();
  dailyCallCount++;
  if (dailyCallCount >= DAILY_LIMIT * 0.8) {
    log.warn('Approaching daily API limit', { used: dailyCallCount, limit: DAILY_LIMIT });
  }
}

function canMakeCall() {
  checkAndResetDailyCount();
  return dailyCallCount < DAILY_LIMIT * 0.95;
}

/**
 * Fetch quotes for multiple symbols via individual API calls.
 * FMP free tier does not support batch (?symbol=A,B,C), so we loop.
 * Caching upstream (stockDataProvider) keeps actual call count low.
 * @param {string[]} symbols
 * @returns {Promise<Object>} ticker -> { price, marketCap, ... }
 */
async function getQuotes(symbols) {
  if (!symbols || symbols.length === 0) return {};

  const results = {};
  log.debug('Fetching quotes', { count: symbols.length, remaining: DAILY_LIMIT - dailyCallCount });

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];

    if (!canMakeCall()) {
      log.warn('Daily limit reached, stopping quote fetches', {
        fetched: i,
        total: symbols.length,
        dailyCallsUsed: dailyCallCount
      });
      break;
    }

    const url = `${BASE_URL}/quote?symbol=${symbol}&apikey=${FMP_API_KEY}`;
    const apiStart = log.apiCall('FMP', `quote(${symbol})`);

    try {
      const response = await axios.get(url, { timeout: 15000 });
      incrementCallCount();

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        const q = response.data[0];
        results[q.symbol] = {
          price: q.price,
          marketCap: q.marketCap,
          previousClose: q.previousClose,
          change: q.change,
          changesPercentage: q.changePercentage,
          name: q.name,
          exchange: q.exchange
        };
      }

      log.apiResult('FMP', `quote(${symbol})`, apiStart, true);

      // Respect rate limits between calls
      if (i < symbols.length - 1) {
        await new Promise(resolve => setTimeout(resolve, CALL_DELAY_MS));
      }
    } catch (error) {
      log.apiResult('FMP', `quote(${symbol})`, apiStart, false);
      log.warn('Quote request failed', { symbol, error: error.message });
    }
  }

  log.debug('Quotes complete', {
    requested: symbols.length,
    received: Object.keys(results).length,
    dailyCallsUsed: dailyCallCount
  });

  return results;
}

/**
 * Get a single quote
 * @param {string} symbol
 * @returns {Promise<Object|null>}
 */
async function getQuote(symbol) {
  const results = await getQuotes([symbol]);
  return results[symbol] || null;
}

function getApiStatus() {
  checkAndResetDailyCount();
  return {
    dailyCallsUsed: dailyCallCount,
    dailyLimit: DAILY_LIMIT,
    remainingCalls: DAILY_LIMIT - dailyCallCount,
    percentUsed: Math.round((dailyCallCount / DAILY_LIMIT) * 100),
    resetDate: lastResetDate
  };
}

module.exports = {
  getQuotes,
  getQuote,
  getApiStatus,
  canMakeCall,
  DAILY_LIMIT
};
