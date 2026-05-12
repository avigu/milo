// services/stockDataProvider.js
// Unified stock data provider.
// Quotes:     Finnhub /quote (parallel chunks)
// MarketCap:  delegated to services/marketCap (weekly TTL cache, Finnhub profile)
// Historical: Tiingo daily (primary) -> Alpaca 10y free (fallback) -> Alpha Vantage (last resort), cached 24h
const axios = require('axios');
const { readCache, writeCache } = require('../utils/cache');
const marketCapService = require('./marketCap');
const { getHistoricalBars } = require('./alpaca');
const { createLogger } = require('../utils/logger');

const log = createLogger('STOCK_DATA');

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const TIINGO_API_KEY = process.env.TIINGO_API_KEY;

const QUOTE_CACHE_MS = 4 * 60 * 60 * 1000;
const HISTORICAL_CACHE_MS = 24 * 60 * 60 * 1000;

// Finnhub free tier ~ 60 calls/min; 10 concurrent + 200ms inter-chunk pacing keeps us under burst limits.
const FINNHUB_CONCURRENCY = 10;
const FINNHUB_INTER_CHUNK_MS = 200;

let quoteCache = { data: {}, timestamp: 0 };

async function getBatchQuotes(tickers) {
  if (!tickers || tickers.length === 0) return {};

  const flowStart = log.flowStart('getBatchQuotes', { tickers: tickers.length });
  const now = Date.now();

  const memoryFresh = quoteCache.timestamp && (now - quoteCache.timestamp < QUOTE_CACHE_MS);
  if (memoryFresh) {
    const missing = tickers.filter(t => !quoteCache.data[t]);
    if (missing.length === 0) {
      log.cacheHit('quotes (memory, all tickers)');
      const result = {};
      tickers.forEach(t => { result[t] = quoteCache.data[t]; });
      log.flowEnd('getBatchQuotes', flowStart, { source: 'memory-cache', count: tickers.length });
      return result;
    }
  }

  if (!memoryFresh) {
    const persistedQuotes = await readCache('batch-quotes', QUOTE_CACHE_MS) || {};
    if (Object.keys(persistedQuotes).length > 0) {
      quoteCache = { data: persistedQuotes, timestamp: now };
      log.cacheHit('quotes (persistent)');
    }
  }

  const toFetch = tickers.filter(t => !quoteCache.data[t]);

  if (toFetch.length > 0) {
    log.cacheMiss('quotes', { missing: toFetch.length, total: tickers.length });

    const finnhubResults = await fetchFinnhubQuotesParallel(toFetch);
    log.info('Finnhub quotes received', { hits: Object.keys(finnhubResults).length, requested: toFetch.length });

    if (Object.keys(finnhubResults).length > 0) {
      quoteCache.data = { ...quoteCache.data, ...finnhubResults };
      quoteCache.timestamp = now;
      await writeCache('batch-quotes', quoteCache.data);
      log.cacheWrite('batch-quotes');
    }
  }

  const result = {};
  tickers.forEach(t => { if (quoteCache.data[t]) result[t] = quoteCache.data[t]; });

  log.flowEnd('getBatchQuotes', flowStart, {
    requested: tickers.length,
    received: Object.keys(result).length
  });

  return result;
}

async function fetchFinnhubQuotesParallel(tickers) {
  if (!FINNHUB_API_KEY) {
    log.warn('FINNHUB_API_KEY not set; skipping Finnhub quotes');
    return {};
  }
  const results = {};
  for (let i = 0; i < tickers.length; i += FINNHUB_CONCURRENCY) {
    const chunk = tickers.slice(i, i + FINNHUB_CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map(getFinnhubQuote));
    chunk.forEach((ticker, idx) => {
      const outcome = settled[idx];
      if (outcome.status === 'fulfilled' && outcome.value) {
        results[ticker] = outcome.value;
      }
    });
    if (i + FINNHUB_CONCURRENCY < tickers.length) {
      await new Promise(r => setTimeout(r, FINNHUB_INTER_CHUNK_MS));
    }
  }
  return results;
}

async function getFinnhubQuote(ticker) {
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_API_KEY}`;
    const response = await axios.get(url, { timeout: 10000 });
    if (response.data && response.data.c) {
      return {
        price: response.data.c,
        marketCap: null, // Finnhub /quote doesn't expose market cap; marketCap service handles that.
        previousClose: response.data.pc,
        change: response.data.d,
        changesPercentage: response.data.dp
      };
    }
    return null;
  } catch (error) {
    log.debug('Finnhub quote error', { ticker, error: error.message });
    return null;
  }
}

async function getHistoricalPrices(ticker, fromUnix, toUnix, cacheFiles = {}) {
  if (!Number.isFinite(fromUnix) || !Number.isFinite(toUnix) || fromUnix >= toUnix) {
    log.error('Invalid date range', { ticker, fromUnix, toUnix });
    return { s: 'error', c: [], t: [] };
  }

  const cacheKey = `hist-${ticker}`;
  const rangeKey = `${unixToIsoDate(fromUnix)}-${unixToIsoDate(toUnix)}`;

  if (cacheFiles[cacheKey] && cacheFiles[cacheKey][rangeKey]) {
    return cacheFiles[cacheKey][rangeKey];
  }

  const persistedHist = await readCache(cacheKey, HISTORICAL_CACHE_MS);
  if (persistedHist && persistedHist[rangeKey]) {
    log.cacheHit(`historical-${ticker}`);
    if (!cacheFiles[cacheKey]) cacheFiles[cacheKey] = {};
    cacheFiles[cacheKey][rangeKey] = persistedHist[rangeKey];
    return persistedHist[rangeKey];
  }

  log.cacheMiss(`historical-${ticker}`);

  let result = await getTiingoDaily(ticker, fromUnix, toUnix);
  if (result.s !== 'ok') {
    log.debug('Tiingo miss; falling back to Alpaca', { ticker, status: result.s });
    result = await getHistoricalBars(ticker, fromUnix, toUnix);
  }
  if (result.s !== 'ok') {
    log.debug('Alpaca miss; falling back to AlphaVantage', { ticker, status: result.s });
    result = await getAlphaVantageDaily(ticker, fromUnix, toUnix);
  }

  if (result.s === 'ok') {
    if (!cacheFiles[cacheKey]) cacheFiles[cacheKey] = {};
    cacheFiles[cacheKey][rangeKey] = result;

    const tickerCache = persistedHist || {};
    tickerCache[rangeKey] = result;
    await writeCache(cacheKey, tickerCache);
  }

  return result;
}

function unixToIsoDate(unixSec) {
  return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

async function getTiingoDaily(ticker, fromUnix, toUnix) {
  if (!TIINGO_API_KEY) {
    return { s: 'no_key', c: [], t: [] };
  }

  const apiStart = log.apiCall('Tiingo', `daily(${ticker})`);

  try {
    const startDate = unixToIsoDate(fromUnix);
    const endDate = unixToIsoDate(toUnix);
    const url = `https://api.tiingo.com/tiingo/daily/${encodeURIComponent(ticker)}/prices?startDate=${startDate}&endDate=${endDate}&format=json&token=${TIINGO_API_KEY}`;
    const response = await axios.get(url, { timeout: 15000 });

    log.apiResult('Tiingo', `daily(${ticker})`, apiStart, true);

    if (!Array.isArray(response.data) || response.data.length === 0) {
      return { s: 'no_data', c: [], t: [] };
    }

    const sorted = response.data
      .map(row => ({
        t: Math.floor(new Date(row.date).getTime() / 1000),
        c: typeof row.adjClose === 'number' ? row.adjClose : row.close
      }))
      .filter(d => Number.isFinite(d.t) && Number.isFinite(d.c))
      .sort((a, b) => a.t - b.t);

    if (sorted.length === 0) {
      return { s: 'no_data', c: [], t: [] };
    }

    return {
      s: 'ok',
      c: sorted.map(d => d.c),
      t: sorted.map(d => d.t)
    };
  } catch (error) {
    log.apiResult('Tiingo', `daily(${ticker})`, apiStart, false);
    log.warn('Tiingo request failed', { ticker, error: error.message });
    return { s: 'error', c: [], t: [] };
  }
}

async function getAlphaVantageDaily(ticker, fromUnix, toUnix) {
  if (!ALPHA_VANTAGE_API_KEY) {
    log.warn('ALPHA_VANTAGE_API_KEY not set');
    return { s: 'error', c: [], t: [] };
  }

  const apiStart = log.apiCall('AlphaVantage', `daily(${ticker})`);

  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    const response = await axios.get(url, { timeout: 30000 });

    log.apiResult('AlphaVantage', `daily(${ticker})`, apiStart, true);

    const timeSeries = response.data['Time Series (Daily)'];
    if (!timeSeries) {
      if (response.data.Information || response.data.Note) {
        log.warn('Alpha Vantage rate limited or error', { ticker, note: response.data.Note || response.data.Information });
      }
      return { s: 'no_data', c: [], t: [] };
    }

    const entries = Object.entries(timeSeries);

    const filtered = entries
      .map(([dateStr, vals]) => ({
        t: Math.floor(new Date(dateStr + 'T00:00:00').getTime() / 1000),
        c: parseFloat(vals['4. close'])
      }))
      .filter(d => d.t >= fromUnix && d.t <= toUnix)
      .sort((a, b) => a.t - b.t);

    if (filtered.length === 0) {
      return { s: 'no_data', c: [], t: [] };
    }

    return {
      s: 'ok',
      c: filtered.map(d => d.c),
      t: filtered.map(d => d.t)
    };
  } catch (error) {
    log.apiResult('AlphaVantage', `daily(${ticker})`, apiStart, false);
    log.warn('Alpha Vantage request failed', { ticker, error: error.message });
    return { s: 'error', c: [], t: [] };
  }
}

async function getCurrentPrice(ticker) {
  const quotes = await getBatchQuotes([ticker]);
  return quotes[ticker]?.price || null;
}

async function getMarketCap(ticker) {
  return marketCapService.getMarketCap(ticker);
}

function getApiStatus() {
  return {
    cacheAge: quoteCache.timestamp ? Date.now() - quoteCache.timestamp : null,
    cachedTickers: Object.keys(quoteCache.data).length,
    marketCap: marketCapService.getCacheStats()
  };
}

module.exports = {
  getBatchQuotes,
  getHistoricalPrices,
  getCurrentPrice,
  getMarketCap,
  getApiStatus
};
