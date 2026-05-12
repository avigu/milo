// services/bounceBack.js
// Bounce-Back strategy: quality companies with one bad quarter where the stock
// price may have overreacted. Scans a stock universe and returns ranked candidates
// that pass all hard gate conditions.
//
// Data flow:
//   Phase 1 (cheap)  — tickers → market-cap filter → batch quotes → 60-day historical
//                      → price-drop pre-filter (>15% from 60-day high)
//   Phase 2 (costly) — for pre-filtered candidates only:
//                      FMP quarterly revenue, Finnhub EPS, Finnhub news, FMP analyst target
//   Phase 3          — score, rank, cache result 6h
const axios = require('axios');
const { readCache, writeCache } = require('../utils/cache');
const { getTickersCached } = require('./tickers');
const { getBatchMarketCaps } = require('./marketCap');
const { getBatchQuotes, getHistoricalPrices } = require('./stockDataProvider');
const { createLogger } = require('../utils/logger');

const log = createLogger('BOUNCE_BACK');

const FINNHUB_API_KEY      = process.env.FINNHUB_API_KEY;
const FMP_API_KEY          = process.env.FMP_API_KEY || 'demo';
const FMP_BASE             = 'https://financialmodelingprep.com';
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Cache TTLs
const SCAN_CACHE_MS     = 6  * 60 * 60 * 1000;
const REVENUE_CACHE_MS  = 24 * 60 * 60 * 1000;
const EPS_CACHE_MS      = 24 * 60 * 60 * 1000;
const NEWS_CACHE_MS     =  6 * 60 * 60 * 1000;
const ANALYST_CACHE_MS  = 24 * 60 * 60 * 1000;

// Hard-gate thresholds (mirrors spec exactly)
const HEALTHY_Q_MIN        = 3;
const REVENUE_YOY_MIN      = 0.08;
const EPS_MISS_MIN         = 0.10;
const PRICE_DROP_MIN       = 0.15;
const SENTIMENT_PASS_MIN   = -0.30;

// Historical window: 90 calendar days guarantees ≥60 trading days
const HIST_CALENDAR_DAYS = 90;

// Parallel concurrency when fetching historical prices
const HIST_CONCURRENCY = 5;

// Red-flag keywords — any match forces sentimentScore → -1 and fails the gate
const RED_FLAGS = [
  'fraud', 'fraudulent',
  'accounting investigation', 'accounting fraud',
  'bankrupt', 'bankruptcy', 'chapter 11',
  'sec investigation', 'sec probe', 'sec charges',
  'class action',
  'ceo resign', 'ceo fired', 'ceo ousted', 'ceo steps down under',
  'product recall', 'safety recall',
  'liquidity crisis', 'going concern', 'liquidity concern',
  'earnings restatement', 'restate earnings',
  'delisting notice', 'nasdaq notice',
  'major lawsuit',
];

// Lightweight keyword sentiment lists for scoring news headlines
const POSITIVE_WORDS = [
  'beat', 'beats', 'exceeded', 'exceed', 'raise', 'raised', 'upgrade', 'upgraded',
  'strong', 'record', 'above', 'outperform', 'growth', 'bullish',
];
const NEGATIVE_WORDS = [
  'miss', 'misses', 'missed', 'disappoint', 'disappoints', 'loss', 'losses',
  'decline', 'fell', 'slump', 'cut', 'cuts', 'warn', 'downgrade', 'downgraded',
  'weak', 'below', 'concern', 'risk', 'uncertain',
];

// ─────────────────────────────────────────────
//  Quarterly revenue (Alpha Vantage → FMP fallback)
// ─────────────────────────────────────────────

function parseRevenueQuarters(reports, dateField, revenueField) {
  const toNum = v => (v != null && v !== 'None' ? parseFloat(v) : null);
  const quarters = [];
  for (let i = 0; i < 4; i++) {
    const cur  = reports[i];
    const prev = reports[i + 4];
    if (!cur || !prev) continue;
    const revCur  = toNum(cur[revenueField]);
    const revPrev = toNum(prev[revenueField]);
    if (!revCur || !revPrev || revPrev === 0) continue;
    quarters.push({
      date: cur[dateField] || '',
      revenue: revCur,
      revenueYoYGrowth: (revCur - revPrev) / Math.abs(revPrev),
    });
  }
  return quarters;
}

async function fetchQuarterlyRevenue(ticker) {
  const cacheKey = `bb-revenue-${ticker}`;
  const cached = await readCache(cacheKey, REVENUE_CACHE_MS);
  if (cached) { log.cacheHit(`revenue-${ticker}`); return cached; }
  log.cacheMiss(`revenue-${ticker}`);

  // ── Try Alpha Vantage first ──────────────────────────────────────────────
  if (ALPHA_VANTAGE_API_KEY) {
    const apiStart = log.apiCall('AlphaVantage', `income-statement(${ticker})`);
    try {
      const url = `https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${encodeURIComponent(ticker)}&apikey=${ALPHA_VANTAGE_API_KEY}`;
      const res = await axios.get(url, { timeout: 20000 });
      log.apiResult('AlphaVantage', `income-statement(${ticker})`, apiStart, true);

      const reports = res.data?.quarterlyReports;
      if (Array.isArray(reports) && reports.length >= 5) {
        const quarters = parseRevenueQuarters(reports, 'fiscalDateEnding', 'totalRevenue');
        if (quarters.length >= 3) {
          const result = { quarters, source: 'alphavantage' };
          await writeCache(cacheKey, result);
          log.cacheWrite(`revenue-${ticker}`);
          return result;
        }
      }
      if (res.data?.Information || res.data?.Note) {
        log.warn('AlphaVantage rate limited — falling back to FMP', { ticker });
      }
    } catch (err) {
      log.apiResult('AlphaVantage', `income-statement(${ticker})`, apiStart, false);
      log.warn('AlphaVantage revenue failed — falling back to FMP', { ticker, error: err.message });
    }
  }

  // ── Finnhub salesPerShare fallback (free, 148+ quarters) ────────────────
  if (!FINNHUB_API_KEY) {
    log.warn('FINNHUB_API_KEY not set; cannot fetch revenue', { ticker });
    return null;
  }

  const apiStart = log.apiCall('Finnhub', `salesPerShare(${ticker})`);
  try {
    const url = `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(ticker)}&metric=all&token=${FINNHUB_API_KEY}`;
    const res = await axios.get(url, { timeout: 20000 });
    log.apiResult('Finnhub', `salesPerShare(${ticker})`, apiStart, true);

    const sps = res.data?.series?.quarterly?.salesPerShare;
    if (!Array.isArray(sps) || sps.length < 5) {
      log.warn('Finnhub salesPerShare: insufficient data', { ticker, count: sps?.length });
      return null;
    }

    // sps is sorted most-recent first; compute 4 YoY pairs
    const quarters = [];
    for (let i = 0; i < 4; i++) {
      const cur  = sps[i];
      const prev = sps[i + 4];
      if (!cur || !prev || !prev.v || prev.v === 0) continue;
      quarters.push({
        date:              cur.period || '',
        revenueYoYGrowth:  (cur.v - prev.v) / Math.abs(prev.v),
      });
    }

    if (quarters.length < 3) {
      log.warn('Finnhub salesPerShare: not enough YoY pairs', { ticker });
      return null;
    }

    const result = { quarters, source: 'finnhub_sps' };
    await writeCache(cacheKey, result);
    log.cacheWrite(`revenue-${ticker}`);
    return result;
  } catch (err) {
    log.apiResult('Finnhub', `salesPerShare(${ticker})`, apiStart, false);
    log.warn('Finnhub salesPerShare fetch failed', { ticker, error: err.message });
    return null;
  }
}

// ─────────────────────────────────────────────
//  EPS surprise (Finnhub /stock/earnings)
// ─────────────────────────────────────────────

async function fetchEarningsSurprise(ticker) {
  const cacheKey = `bb-eps-${ticker}`;
  const cached = await readCache(cacheKey, EPS_CACHE_MS);
  if (cached) { log.cacheHit(`eps-${ticker}`); return cached; }
  log.cacheMiss(`eps-${ticker}`);

  if (!FINNHUB_API_KEY) return null;

  const apiStart = log.apiCall('Finnhub', `earnings(${ticker})`);
  try {
    const url = `https://finnhub.io/api/v1/stock/earnings?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_API_KEY}`;
    const res = await axios.get(url, { timeout: 10000 });
    log.apiResult('Finnhub', `earnings(${ticker})`, apiStart, true);

    const data = res.data;
    if (!Array.isArray(data) || data.length === 0) return null;

    const latest = data[0];
    const { actual, estimate } = latest;
    if (actual == null || estimate == null || estimate === 0) return null;

    const epsMissPercent = (estimate - actual) / Math.abs(estimate);

    // Up to 4 quarters of history
    const epsHistory = data.slice(0, 4)
      .filter(q => q.actual != null && q.estimate != null)
      .map(q => ({
        period:   q.period,
        actual:   q.actual,
        estimate: q.estimate,
        surprise: q.estimate !== 0 ? Math.round(((q.actual - q.estimate) / Math.abs(q.estimate)) * 1000) / 10 : null,
      }));

    // Trend: latest actual vs average of prior quarters
    let epsTrend = 'unknown';
    if (epsHistory.length >= 2) {
      const prevAvg = epsHistory.slice(1).reduce((s, q) => s + q.actual, 0) / epsHistory.slice(1).length;
      if (actual > prevAvg * 1.05)      epsTrend = 'improving';
      else if (actual < prevAvg * 0.95) epsTrend = 'declining';
      else                              epsTrend = 'mixed';
    }

    const result = { epsActual: actual, epsEstimate: estimate, epsMissPercent, epsHistory, epsTrend };
    await writeCache(cacheKey, result);
    log.cacheWrite(`eps-${ticker}`);
    return result;
  } catch (err) {
    log.apiResult('Finnhub', `earnings(${ticker})`, apiStart, false);
    log.warn('EPS fetch failed', { ticker, error: err.message });
    return null;
  }
}

// ─────────────────────────────────────────────
//  News sentiment (Finnhub /company-news + keyword analysis)
// ─────────────────────────────────────────────

function scoreHeadlines(headlines) {
  if (!headlines.length) return 0;
  let total = 0;
  for (const h of headlines) {
    const lower = h.toLowerCase();
    let score = 0;
    for (const w of POSITIVE_WORDS) if (lower.includes(w)) score += 0.1;
    for (const w of NEGATIVE_WORDS) if (lower.includes(w)) score -= 0.1;
    total += Math.max(-0.5, Math.min(0.5, score));
  }
  // Average, then expand to [-1, 1]
  return Math.max(-1, Math.min(1, (total / headlines.length) * 2));
}

async function fetchNewsSentiment(ticker) {
  const cacheKey = `bb-news-${ticker}`;
  const cached = await readCache(cacheKey, NEWS_CACHE_MS);
  if (cached) { log.cacheHit(`news-${ticker}`); return cached; }
  log.cacheMiss(`news-${ticker}`);

  if (!FINNHUB_API_KEY) return null;

  const to   = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr   = to.toISOString().slice(0, 10);

  const apiStart = log.apiCall('Finnhub', `company-news(${ticker})`);
  try {
    const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(ticker)}&from=${fromStr}&to=${toStr}&token=${FINNHUB_API_KEY}`;
    const res = await axios.get(url, { timeout: 10000 });
    log.apiResult('Finnhub', `company-news(${ticker})`, apiStart, true);

    const articles   = Array.isArray(res.data) ? res.data : [];
    const headlines  = articles.slice(0, 30).map(a => a.headline || '');
    const allText    = headlines.join(' ').toLowerCase();
    const redFlagsDetected = RED_FLAGS.filter(kw => allText.includes(kw));

    const sentimentScore = redFlagsDetected.length > 0 ? -1.0 : scoreHeadlines(headlines);

    const result = { sentimentScore, redFlagsDetected, headlineCount: headlines.length };
    await writeCache(cacheKey, result);
    log.cacheWrite(`news-${ticker}`);
    return result;
  } catch (err) {
    log.apiResult('Finnhub', `company-news(${ticker})`, apiStart, false);
    log.warn('News fetch failed', { ticker, error: err.message });
    return null;
  }
}

// ─────────────────────────────────────────────
//  Analyst target (FMP /api/v3/price-target)
// ─────────────────────────────────────────────

async function fetchAnalystTarget(ticker, currentPrice) {
  const cacheKey = `bb-analyst-${ticker}`;
  const cached = await readCache(cacheKey, ANALYST_CACHE_MS);
  if (cached) { log.cacheHit(`analyst-${ticker}`); return cached; }
  log.cacheMiss(`analyst-${ticker}`);

  const apiStart = log.apiCall('FMP', `price-target(${ticker})`);
  try {
    const url = `${FMP_BASE}/api/v3/price-target/${ticker}?apikey=${FMP_API_KEY}`;
    const res = await axios.get(url, { timeout: 10000 });
    log.apiResult('FMP', `price-target(${ticker})`, apiStart, true);

    const data = res.data;
    let avgAnalystTargetPrice = null;
    let upsidePercent = null;

    if (Array.isArray(data) && data.length > 0) {
      const targets = data.slice(0, 20).map(d => d.priceTarget).filter(t => t && t > 0);
      if (targets.length > 0) {
        avgAnalystTargetPrice = Math.round((targets.reduce((s, t) => s + t, 0) / targets.length) * 100) / 100;
        if (currentPrice > 0) {
          upsidePercent = Math.round(((avgAnalystTargetPrice - currentPrice) / currentPrice) * 1000) / 10;
        }
      }
    }

    const result = { avgAnalystTargetPrice, upsidePercent };
    await writeCache(cacheKey, result);
    log.cacheWrite(`analyst-${ticker}`);
    return result;
  } catch (err) {
    log.apiResult('FMP', `price-target(${ticker})`, apiStart, false);
    log.warn('Analyst target fetch failed', { ticker, error: err.message });
    return { avgAnalystTargetPrice: null, upsidePercent: null };
  }
}

// ─────────────────────────────────────────────
//  Scoring helpers
// ─────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function computeScores(avgRevenueYoYGrowth, dropFrom60DayHigh, sentimentScore) {
  const revenueStrengthScore = clamp(
    60 + ((avgRevenueYoYGrowth - REVENUE_YOY_MIN) / 0.17) * 40,
    60, 100
  );
  const priceDropScore = clamp(
    ((dropFrom60DayHigh - PRICE_DROP_MIN) / 0.25) * 100,
    0, 100
  );
  const newsCleanlinessScore = clamp(
    ((sentimentScore + 0.30) / 0.80) * 100,
    0, 100
  );
  const bounceBackScore = Math.round(
    revenueStrengthScore * 0.40 +
    priceDropScore       * 0.40 +
    newsCleanlinessScore * 0.20
  );
  return {
    revenueStrengthScore: Math.round(revenueStrengthScore),
    priceDropScore:       Math.round(priceDropScore),
    newsCleanlinessScore: Math.round(newsCleanlinessScore),
    bounceBackScore,
  };
}

function getRiskLevel(dropFrom60DayHigh, sentimentScore) {
  if (dropFrom60DayHigh > 0.40 || sentimentScore < -0.15) return 'high';
  if (dropFrom60DayHigh > 0.25) return 'medium';
  return 'low';
}

function buildReason(revenueCheck, epsCheck, priceCheck, newsCheck) {
  const parts = [];

  const growthPct = Math.round(revenueCheck.avgRevenueYoYGrowth * 100);
  parts.push(`Revenue grew ${growthPct > 0 ? '+' : ''}${growthPct}% YoY on average, with ${revenueCheck.healthyQuarters} of the last 4 quarters above 8% growth`);

  const missPct = Math.round(epsCheck.epsMissPercent * 100);
  const trendNote = epsCheck.epsTrend && epsCheck.epsTrend !== 'unknown' ? `, EPS trend is ${epsCheck.epsTrend}` : '';
  parts.push(`EPS missed analyst estimates by ${missPct}% ($${epsCheck.epsActual} actual vs $${epsCheck.epsEstimate} estimate)${trendNote}`);

  const dropPct = Math.round(priceCheck.dropFrom60DayHigh * 100);
  parts.push(`stock is down ${dropPct}% from its 60-day high of $${priceCheck.high60d}`);

  const sentStr = newsCheck.sentimentScore > 0.10 ? 'positive' :
                  newsCheck.sentimentScore < -0.10 ? 'slightly negative' : 'neutral';
  parts.push(`recent news sentiment is ${sentStr}`);

  return parts.join('; ') + '.';
}

// ─────────────────────────────────────────────
//  Main entry point
// ─────────────────────────────────────────────

/**
 * Scan a stock universe for Bounce-Back candidates.
 *
 * @param {string} indexKey       - 'sp500' | 'nasdaq'
 * @param {object} options
 * @param {number} options.minMarketCap        - minimum market cap in dollars (default 5B)
 * @param {boolean} options.includeFailedChecks - include stocks that failed gates (default false)
 * @param {number} options.maxCandidates       - cap on returned candidates (default 20)
 */
async function getBouncBackCandidates(indexKey = 'sp500', options = {}) {
  const {
    minMarketCap       = 5_000_000_000,
    includeFailedChecks = false,
    maxCandidates      = 20,
  } = options;

  const scanCacheKey = `bb-scan-${indexKey}-${Math.round(minMarketCap / 1e9)}B`;
  if (!includeFailedChecks) {
    const cached = await readCache(scanCacheKey, SCAN_CACHE_MS);
    if (cached) {
      log.cacheHit(`bounce-back scan (${indexKey})`);
      return cached;
    }
  }

  const flowStart = log.flowStart('getBouncBackCandidates', { indexKey, minMarketCap });
  const asOfDate  = new Date().toISOString().slice(0, 10);

  // ── Phase 1: Universe ────────────────────────────────────────────────────

  log.info('Phase 1: loading ticker universe', { indexKey });
  const [allTickers, nameMap] = await getTickersCached(indexKey);
  log.info('Tickers loaded', { count: allTickers.length });

  const marketCaps = await getBatchMarketCaps(allTickers);
  const universe   = allTickers.filter(t => {
    const mc = marketCaps[t];
    return typeof mc === 'number' && mc >= minMarketCap;
  });
  log.info('Market-cap filter applied', { before: allTickers.length, after: universe.length, minMarketCapB: minMarketCap / 1e9 });

  // ── Phase 2: Price-drop pre-filter (cheap) ──────────────────────────────

  log.info('Phase 2: price-drop pre-filter');

  const quotes   = await getBatchQuotes(universe);
  const nowUnix  = Math.floor(Date.now() / 1000);
  const histFrom = nowUnix - (HIST_CALENDAR_DAYS * 24 * 60 * 60);

  const historicalCache   = {};
  const priceDropTickers  = []; // { ticker, currentPrice, high60d, dropFrom60DayHigh }

  for (let i = 0; i < universe.length; i += HIST_CONCURRENCY) {
    const chunk = universe.slice(i, i + HIST_CONCURRENCY);
    await Promise.all(chunk.map(async (ticker) => {
      const quote = quotes[ticker];
      if (!quote || !quote.price) return;

      try {
        const hist = await getHistoricalPrices(ticker, histFrom, nowUnix, historicalCache);
        if (hist.s !== 'ok' || hist.c.length < 20) return;

        const prices         = hist.c.slice(-60); // last 60 trading days
        const high60d        = Math.max(...prices);
        const currentPrice   = quote.price;
        const dropFrom60DayHigh = (high60d - currentPrice) / high60d;

        if (dropFrom60DayHigh > PRICE_DROP_MIN) {
          priceDropTickers.push({ ticker, currentPrice, high60d, dropFrom60DayHigh });
        }
      } catch (err) {
        log.debug('Historical fetch skipped', { ticker, error: err.message });
      }
    }));
    if (i + HIST_CONCURRENCY < universe.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  log.info('Price-drop candidates identified', {
    total: universe.length,
    dropped: priceDropTickers.length,
    threshold: `>${Math.round(PRICE_DROP_MIN * 100)}%`,
  });

  // ── Phase 3: Fundamentals for pre-filtered candidates ───────────────────

  log.info('Phase 3: fundamentals analysis', { candidates: priceDropTickers.length });

  const passed = [];
  const failed = [];

  for (let i = 0; i < priceDropTickers.length; i++) {
    const { ticker, currentPrice, high60d, dropFrom60DayHigh } = priceDropTickers[i];
    log.debug(`Analyzing ${i + 1}/${priceDropTickers.length}`, { ticker });

    const [revenueData, epsData, newsData, analystData] = await Promise.all([
      fetchQuarterlyRevenue(ticker).catch(() => null),
      fetchEarningsSurprise(ticker).catch(() => null),
      fetchNewsSentiment(ticker).catch(() => null),
      fetchAnalystTarget(ticker, currentPrice).catch(() => ({ avgAnalystTargetPrice: null, upsidePercent: null })),
    ]);

    // ── Revenue health check ────────────────────────────────────────────────
    let revenueCheck;
    if (!revenueData || !revenueData.quarters || revenueData.quarters.length < 3) {
      revenueCheck = { passed: false, reason: 'missing_revenue_data' };
    } else {
      const healthyQuarters = revenueData.quarters.filter(q => q.revenueYoYGrowth > REVENUE_YOY_MIN).length;
      const avgRevenueYoYGrowth = revenueData.quarters.reduce((s, q) => s + q.revenueYoYGrowth, 0) / revenueData.quarters.length;
      revenueCheck = {
        passed:              healthyQuarters >= HEALTHY_Q_MIN,
        healthyQuarters,
        required:            HEALTHY_Q_MIN,
        avgRevenueYoYGrowth: Math.round(avgRevenueYoYGrowth * 1000) / 1000,
      };
    }

    // ── EPS miss check ─────────────────────────────────────────────────────
    let epsCheck;
    if (!epsData) {
      epsCheck = { passed: false, reason: 'missing_eps_data' };
    } else {
      epsCheck = {
        passed:         epsData.epsMissPercent > EPS_MISS_MIN,
        epsActual:      Math.round(epsData.epsActual    * 100) / 100,
        epsEstimate:    Math.round(epsData.epsEstimate  * 100) / 100,
        epsMissPercent: Math.round(epsData.epsMissPercent * 1000) / 1000,
        epsTrend:       epsData.epsTrend,
        epsHistory:     epsData.epsHistory,
      };
    }

    // ── Price overreaction check (already computed in phase 2) ──────────────
    const priceCheck = {
      passed:            true, // guaranteed by pre-filter
      high60d:           Math.round(high60d     * 100) / 100,
      currentPrice:      Math.round(currentPrice * 100) / 100,
      dropFrom60DayHigh: Math.round(dropFrom60DayHigh * 1000) / 1000,
    };

    // ── News sentiment check ────────────────────────────────────────────────
    let newsCheck;
    if (!newsData) {
      newsCheck = { passed: false, reason: 'missing_news_data' };
    } else {
      newsCheck = {
        passed:            newsData.sentimentScore > SENTIMENT_PASS_MIN && newsData.redFlagsDetected.length === 0,
        sentimentScore:    Math.round(newsData.sentimentScore * 100) / 100,
        redFlagsDetected:  newsData.redFlagsDetected,
      };
    }

    const allPassed = revenueCheck.passed && epsCheck.passed && priceCheck.passed && newsCheck.passed;
    const checks    = { revenueHealth: revenueCheck, epsMiss: epsCheck, priceDrop: priceCheck, newsSentiment: newsCheck };

    if (!allPassed) {
      if (includeFailedChecks) {
        failed.push({
          ticker,
          companyName:    nameMap[ticker] || ticker,
          currentPrice:   priceCheck.currentPrice,
          checks,
          passedGates:    [revenueCheck.passed, epsCheck.passed, priceCheck.passed, newsCheck.passed].filter(Boolean).length,
        });
      }
      continue;
    }

    // ── All gates passed → score ────────────────────────────────────────────
    const scores    = computeScores(revenueCheck.avgRevenueYoYGrowth, priceCheck.dropFrom60DayHigh, newsCheck.sentimentScore);
    const riskLevel = getRiskLevel(priceCheck.dropFrom60DayHigh, newsCheck.sentimentScore);
    const reason    = buildReason(revenueCheck, epsCheck, priceCheck, newsCheck);

    const dataSources = ['quarterly_financials', 'earnings_estimates', 'daily_price_bars', 'news_sentiment'];
    if (analystData.upsidePercent !== null) dataSources.push('analyst_targets');

    passed.push({
      ticker,
      companyName:   nameMap[ticker] || ticker,
      sector:        'Unknown',
      currentPrice:  priceCheck.currentPrice,
      score:         scores.bounceBackScore,
      riskLevel,
      upsidePercent: analystData.upsidePercent,
      matchedStrategy: 'Bounce-Back',
      reason,
      checks,
      scoreBreakdown: {
        revenueStrengthScore: scores.revenueStrengthScore,
        priceDropScore:       scores.priceDropScore,
        newsCleanlinessScore: scores.newsCleanlinessScore,
        formula: 'revenueStrengthScore * 0.40 + priceDropScore * 0.40 + newsCleanlinessScore * 0.20',
      },
      dataSources,
    });

    // Pace at ~1 Finnhub metric call/sec (free tier limit: 60/min)
    if (i < priceDropTickers.length - 1) {
      await new Promise(r => setTimeout(r, 1100));
    }
  }

  // ── Sort: score desc → upsidePercent desc → marketCap desc ─────────────

  passed.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const upA = a.upsidePercent ?? -Infinity;
    const upB = b.upsidePercent ?? -Infinity;
    if (upB !== upA) return upB - upA;
    return (marketCaps[b.ticker] || 0) - (marketCaps[a.ticker] || 0);
  });

  const candidates = passed.slice(0, maxCandidates);

  const result = {
    strategy:        'bounce_back',
    asOfDate,
    universeSize:    universe.length,
    candidatesCount: candidates.length,
    candidates,
    ...(includeFailedChecks && { failedCandidates: failed }),
    disclaimer: 'This is algorithmic analysis based on public market data. It is not financial advice and does not guarantee future returns.',
  };

  if (!includeFailedChecks) {
    await writeCache(scanCacheKey, result);
    log.cacheWrite(`bounce-back scan (${indexKey})`);
  }

  log.flowEnd('getBouncBackCandidates', flowStart, {
    universe:      universe.length,
    preDrop:       priceDropTickers.length,
    candidates:    candidates.length,
  });

  return result;
}

module.exports = { getBouncBackCandidates };
