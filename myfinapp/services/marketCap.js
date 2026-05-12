// services/marketCap.js
// Market-cap cache layer.
// - Per-ticker TTL: 7 days (market cap is sticky enough at the filtering threshold).
// - Persistent storage: utils/cache (GCS or local fallback).
// - Data source: Finnhub /stock/profile2.
// - `recordMarketCap[s]()` lets other flows piggy-back observed market caps for free.
const axios = require('axios');
const { readCache, writeCache } = require('../utils/cache');
const { createLogger } = require('../utils/logger');

const log = createLogger('MARKETCAP');

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const MARKETCAP_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_KEY = 'marketcap-all';
// Cold-start of ~200 tickers happens once per week. Pacing keeps us under
// Finnhub free tier (60 calls/minute): 5 calls/chunk × ~1.1s = ~5 calls/sec.
const FETCH_CONCURRENCY = 5;
const INTER_CHUNK_MS = 1100;
const FLUSH_DEBOUNCE_MS = 1000;

let memoryCache = {};
let memoryLoaded = false;
let loadPromise = null;
let dirty = false;
let flushTimer = null;

async function ensureLoaded() {
  if (memoryLoaded) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const persisted = await readCache(CACHE_KEY, Number.MAX_SAFE_INTEGER);
    if (persisted && typeof persisted === 'object') {
      memoryCache = persisted;
      log.info('Market-cap cache loaded', { entries: Object.keys(memoryCache).length });
    } else {
      memoryCache = {};
      log.info('Market-cap cache cold start (no persisted data)');
    }
    memoryLoaded = true;
  })();
  return loadPromise;
}

function isFresh(entry) {
  return entry
    && typeof entry.marketCap === 'number'
    && entry.marketCap > 0
    && typeof entry.fetchedAt === 'number'
    && Date.now() - entry.fetchedAt < MARKETCAP_TTL_MS;
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    if (!dirty) return;
    dirty = false;
    try {
      await writeCache(CACHE_KEY, memoryCache);
      log.debug('Market-cap cache flushed', { entries: Object.keys(memoryCache).length });
    } catch (err) {
      log.warn('Market-cap cache flush failed', { error: err.message });
    }
  }, FLUSH_DEBOUNCE_MS);
  if (typeof flushTimer.unref === 'function') flushTimer.unref();
}

function setEntry(ticker, marketCap) {
  if (!ticker || typeof marketCap !== 'number' || !(marketCap > 0)) return false;
  memoryCache[ticker] = { marketCap, fetchedAt: Date.now() };
  dirty = true;
  scheduleFlush();
  return true;
}

/**
 * Record an externally-observed market cap (e.g., from a quote fetch) into the cache.
 * Lets other services share data they already paid for without changing this module's API.
 */
function recordMarketCap(ticker, marketCap) {
  if (!memoryLoaded) {
    // Lazy-init in fire-and-forget mode; safe because setEntry only mutates memoryCache.
    ensureLoaded().then(() => setEntry(ticker, marketCap)).catch(() => {});
    return;
  }
  setEntry(ticker, marketCap);
}

function recordMarketCaps(map) {
  if (!map) return;
  for (const [ticker, mc] of Object.entries(map)) {
    recordMarketCap(ticker, mc);
  }
}

async function fetchFinnhubProfile(ticker) {
  if (!FINNHUB_API_KEY) return null;
  try {
    const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_API_KEY}`;
    const res = await axios.get(url, { timeout: 8000 });
    if (res.data && typeof res.data.marketCapitalization === 'number' && res.data.marketCapitalization > 0) {
      return res.data.marketCapitalization * 1e6;
    }
    return null;
  } catch (err) {
    log.debug('Finnhub profile fetch failed', { ticker, error: err.message });
    return null;
  }
}

async function fetchOne(ticker) {
  return fetchFinnhubProfile(ticker);
}

async function getMarketCap(ticker) {
  await ensureLoaded();
  const entry = memoryCache[ticker];
  if (isFresh(entry)) return entry.marketCap;

  const fetched = await fetchOne(ticker);
  if (fetched) {
    setEntry(ticker, fetched);
    return fetched;
  }
  return entry ? entry.marketCap : null;
}

async function getBatchMarketCaps(tickers) {
  await ensureLoaded();
  if (!tickers || tickers.length === 0) return {};

  const result = {};
  const stale = [];
  for (const ticker of tickers) {
    const entry = memoryCache[ticker];
    if (isFresh(entry)) {
      result[ticker] = entry.marketCap;
    } else {
      stale.push(ticker);
    }
  }

  if (stale.length > 0) {
    log.info('Fetching missing/stale market caps', { stale: stale.length, total: tickers.length });
    for (let i = 0; i < stale.length; i += FETCH_CONCURRENCY) {
      const chunk = stale.slice(i, i + FETCH_CONCURRENCY);
      const fetched = await Promise.all(chunk.map(t => fetchOne(t).then(mc => ({ t, mc }))));
      for (const { t, mc } of fetched) {
        if (mc && mc > 0) {
          setEntry(t, mc);
          result[t] = mc;
        } else if (memoryCache[t]) {
          result[t] = memoryCache[t].marketCap;
        } else {
          result[t] = null;
        }
      }
      if (i + FETCH_CONCURRENCY < stale.length) {
        await new Promise(r => setTimeout(r, INTER_CHUNK_MS));
      }
    }
    if (dirty) {
      dirty = false;
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      try {
        await writeCache(CACHE_KEY, memoryCache);
      } catch (err) {
        log.warn('Market-cap cache flush failed at end of batch', { error: err.message });
      }
    }
  }

  return result;
}

function getCacheStats() {
  return {
    loaded: memoryLoaded,
    entries: Object.keys(memoryCache).length,
    fresh: Object.values(memoryCache).filter(isFresh).length,
    ttlMs: MARKETCAP_TTL_MS
  };
}

module.exports = {
  getMarketCap,
  getBatchMarketCaps,
  recordMarketCap,
  recordMarketCaps,
  getCacheStats,
};
