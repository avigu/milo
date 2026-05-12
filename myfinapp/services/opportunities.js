const { getTickersCached } = require('./tickers');
const { getRecentEarningsCalendar } = require('./earnings');
const { analyzeBuyOpportunities } = require('./buyOpportunity');
const { INDICES } = require('../config/indices');
const stockDataProvider = require('./stockDataProvider');
const marketCap = require('./marketCap');
const { createLogger } = require('../utils/logger');

const log = createLogger('OPPORTUNITIES');

// Main investment opportunities logic - REFACTORED to use batch operations
async function getInvestmentOpportunities(indexKey, now = new Date()) {
  const flowStart = log.flowStart('getInvestmentOpportunities', { indexKey, date: now.toISOString().slice(0, 10) });

  const index = INDICES[indexKey];
  let tHistTotal = 0, tPriceTotal = 0;
  let historyCalls = 0;
  let skippedStocks = { invalidDate: 0, lowMarketCap: 0, noPrice: 0, noHistory: 0, other: 0 };

  // Per-request in-memory cache for historical files
  const historicalCacheFiles = {};

  // Fetch earnings
  const tEarnings0 = Date.now();
  const fromDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const toDate = now.toISOString().slice(0, 10);
  log.info(`Fetching earnings calendar`, { from: fromDate, to: toDate });
  const earningsCalendarData = await getRecentEarningsCalendar(fromDate, toDate);
  const tEarnings1 = Date.now();
  log.debug(`Earnings calendar fetched`, { count: earningsCalendarData.earningsCalendar?.length || 0, duration: `${tEarnings1 - tEarnings0}ms` });

  // Fetch tickers
  const tTickersStart = Date.now();
  log.info(`Fetching tickers for index`, { indexKey });
  let [tickers, nameMap] = await getTickersCached(indexKey);
  const tTickersEnd = Date.now();
  log.debug(`Tickers fetched`, { count: tickers.length, duration: `${tTickersEnd - tTickersStart}ms` });

  const tickerSet = new Set(tickers);
  const earningsArray = earningsCalendarData.earningsCalendar || [];
  const relevantEarnings = earningsArray.filter(e => e && e.symbol && tickerSet.has(e.symbol));
  log.info(`Found relevant earnings`, { total: earningsArray.length, relevant: relevantEarnings.length });

  // Pre-validate earnings and collect valid tickers
  const validEarnings = [];
  for (const earning of relevantEarnings) {
    const ticker = earning.symbol;
    if (!ticker || ticker === 'SP500' || !/^[A-Z.-]{1,6}$/.test(ticker)) continue;
    const earningsDate = new Date(earning.date);
    if (isNaN(earningsDate.getTime())) {
      log.warn(`Skipping stock: invalid earnings date`, { ticker, date: earning.date });
      skippedStocks.invalidDate++;
      continue;
    }
    const earningsUnix = Math.floor(earningsDate.getTime() / 1000);
    if (!Number.isFinite(earningsUnix)) {
      log.warn(`Skipping stock: invalid earnings unix timestamp`, { ticker, earningsUnix });
      skippedStocks.invalidDate++;
      continue;
    }
    validEarnings.push({ ...earning, earningsUnix });
  }

  // PRE-FILTER by market cap (cached weekly) before paying for quotes.
  // This dramatically shrinks the working set and avoids 429s on the quote provider.
  const allTickers = validEarnings.map(e => e.symbol);
  const tMcap0 = Date.now();
  const marketCapMap = await marketCap.getBatchMarketCaps(allTickers);
  const tMcap1 = Date.now();
  log.info(`Market caps resolved`, {
    requested: allTickers.length,
    known: Object.values(marketCapMap).filter(v => typeof v === 'number' && v > 0).length,
    duration: `${tMcap1 - tMcap0}ms`
  });

  const earningsAboveCap = [];
  for (const earning of validEarnings) {
    const mc = marketCapMap[earning.symbol];
    if (!mc || mc < index.minMarketCap) {
      skippedStocks.lowMarketCap++;
      continue;
    }
    earningsAboveCap.push({ ...earning, marketCap: mc });
  }
  log.info(`Earnings after market-cap filter`, {
    before: validEarnings.length,
    after: earningsAboveCap.length,
    minMarketCap: index.minMarketCap
  });

  // BATCH OPERATION: Fetch quotes only for tickers that passed the market-cap filter.
  const tickersToFetch = earningsAboveCap.map(e => e.symbol);
  log.info(`Fetching batch quotes`, { tickers: tickersToFetch.length });

  const tPrice0 = Date.now();
  const batchQuotes = await stockDataProvider.getBatchQuotes(tickersToFetch);
  const tPrice1 = Date.now();
  tPriceTotal = tPrice1 - tPrice0;
  log.info(`Batch quotes received`, { requested: tickersToFetch.length, received: Object.keys(batchQuotes).length, duration: `${tPriceTotal}ms` });

  // Process each earning with the batch quote data
  const results = [];
  for (const earning of earningsAboveCap) {
    const ticker = earning.symbol;
    const earningsUnix = earning.earningsUnix;

    try {
      const quote = batchQuotes[ticker];
      if (!quote) {
        log.debug(`No quote data for ticker`, { ticker });
        skippedStocks.noPrice++;
        continue;
      }

      const stockMarketCap = earning.marketCap;
      const priceNow = quote.price;

      if (!priceNow) {
        skippedStocks.noPrice++;
        continue;
      }

      const daysBack = 7;
      const fromUnixForHistory = earningsUnix - daysBack * 86400;
      const toUnixForHistory = earningsUnix;
      if (!Number.isFinite(fromUnixForHistory) || !Number.isFinite(toUnixForHistory)) {
        log.warn(`Skipping stock: invalid history date range`, { ticker, fromUnix: fromUnixForHistory, toUnix: toUnixForHistory });
        skippedStocks.invalidDate++;
        continue;
      }

      // Fetch historical data (uses caching, individual calls but much fewer)
      const tHist0 = Date.now();
      const history = await stockDataProvider.getHistoricalPrices(ticker, fromUnixForHistory, toUnixForHistory, historicalCacheFiles);
      historyCalls++;
      const tHist1 = Date.now();
      tHistTotal += (tHist1 - tHist0);

      if (!history || !history.c || history.c.length < 1) {
        skippedStocks.noHistory++;
        continue;
      }

      let priceBeforeEarnings = null;
      for (let i = history.t.length - 1; i >= 0; i--) {
        if (history.t[i] < earningsUnix) {
          priceBeforeEarnings = history.c[i];
          break;
        }
      }
      if (priceBeforeEarnings === null) {
        log.warn(`No trading day before earnings`, { ticker, earningsDate: earning.date });
        skippedStocks.noHistory++;
        continue;
      }

      const change = ((priceNow - priceBeforeEarnings) / priceBeforeEarnings) * 100;
      results.push({
        ticker,
        name: nameMap[ticker] || '',
        earningsDate: earning.date,
        marketCap: stockMarketCap,
        priceBeforeEarnings,
        priceNow,
        change
      });
    } catch (err) {
      log.error(`Error processing stock`, { ticker, error: err.message });
      skippedStocks.other++;
    }
  }

  // Summary metrics
  log.metrics('API Calls', {
    earnings: { duration: `${tEarnings1 - tEarnings0}ms` },
    tickers: { duration: `${tTickersEnd - tTickersStart}ms` },
    marketCaps: { tickers: allTickers.length, kept: earningsAboveCap.length, duration: `${tMcap1 - tMcap0}ms` },
    batchQuotes: { tickers: tickersToFetch.length, duration: `${tPriceTotal}ms` },
    historical: { calls: historyCalls, duration: `${tHistTotal}ms` },
    apiStatus: stockDataProvider.getApiStatus()
  });

  log.flowEnd('getInvestmentOpportunities', flowStart, {
    opportunitiesFound: results.length,
    skipped: skippedStocks
  });

  return results.sort((a, b) => b.change - a.change);
}

// Enhanced function that includes buy opportunity analysis
async function getInvestmentOpportunitiesWithBuyAnalysis(indexKey, now = new Date()) {
  const flowStart = log.flowStart('getInvestmentOpportunitiesWithBuyAnalysis', { indexKey });

  // Get basic opportunities first
  const opportunities = await getInvestmentOpportunities(indexKey, now);
  const basicTime = Date.now() - flowStart;

  const breakdown = {
    gainers: opportunities.filter(stock => stock.change > 0).length,
    losers: opportunities.filter(stock => stock.change < 0).length,
    bigDrops: opportunities.filter(stock => stock.change < -7).length
  };

  if (opportunities.length > 0) {
    log.info(`Opportunities breakdown`, breakdown);
  }

  // Analyze buy opportunities for stocks that dropped more than 7%
  log.info(`Starting buy opportunity analysis`, { stocksToAnalyze: breakdown.bigDrops });
  const buyAnalysisStartTime = Date.now();
  const buyOpportunities = await analyzeBuyOpportunities(opportunities);
  const buyAnalysisTime = Date.now() - buyAnalysisStartTime;

  const totalTime = Date.now() - flowStart;

  log.flowEnd('getInvestmentOpportunitiesWithBuyAnalysis', flowStart, {
    totalOpportunities: opportunities.length,
    buyOpportunities: buyOpportunities.length,
    timings: { basic: `${basicTime}ms`, buyAnalysis: `${buyAnalysisTime}ms`, total: `${totalTime}ms` }
  });

  return {
    opportunities,
    buyOpportunities,
    metadata: {
      totalOpportunities: opportunities.length,
      totalBuyOpportunities: buyOpportunities.length,
      analysisTime: {
        basic: basicTime,
        buyAnalysis: buyAnalysisTime,
        total: totalTime
      },
      breakdown
    }
  };
}

// Upcoming relevant earnings logic - REFACTORED to use batch operations
async function getUpcomingRelevantEarnings(indexKey) {
  const flowStart = log.flowStart('getUpcomingRelevantEarnings', { indexKey });

  const index = INDICES[indexKey];
  const now = new Date();
  const fromDate = now.toISOString().slice(0, 10);
  const toDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  log.debug(`Fetching upcoming earnings`, { from: fromDate, to: toDate });

  const earningsCalendarData = await getRecentEarningsCalendar(fromDate, toDate);
  const [tickers, nameMap] = await getTickersCached(indexKey);
  const tickerSet = new Set(tickers);
  const earningsArray = earningsCalendarData.earningsCalendar || [];
  const relevant = [];
  let skipped = { notInIndex: 0, lowMarketCap: 0, noQuote: 0 };

  // Filter to relevant earnings first
  const relevantEarnings = earningsArray.filter(e => e && e.symbol && tickerSet.has(e.symbol));
  const tickersToFetch = relevantEarnings.map(e => e.symbol);

  // Count non-index stocks
  skipped.notInIndex = earningsArray.length - relevantEarnings.length;

  // Upcoming earnings only need market caps for filtering — skip the (expensive) quote round-trip.
  log.info(`Fetching market caps for upcoming earnings`, { tickers: tickersToFetch.length });
  const marketCapMap = await marketCap.getBatchMarketCaps(tickersToFetch);

  for (const earning of relevantEarnings) {
    const stockMarketCap = marketCapMap[earning.symbol];
    if (!stockMarketCap) {
      skipped.noQuote++;
      continue;
    }
    if (stockMarketCap < index.minMarketCap) {
      skipped.lowMarketCap++;
      continue;
    }

    relevant.push({
      ticker: earning.symbol,
      name: nameMap[earning.symbol] || '',
      date: earning.date,
      marketCap: stockMarketCap
    });
  }

  log.flowEnd('getUpcomingRelevantEarnings', flowStart, {
    found: relevant.length,
    skipped
  });

  return relevant.sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function getEarningsPlayOpportunities(indexKey) {
  const flowStart = log.flowStart('getEarningsPlayOpportunities', { indexKey });

  // Step 1: Upcoming earnings this week
  const upcomingEarnings = await getUpcomingRelevantEarnings(indexKey);
  log.info('Upcoming earnings fetched', { count: upcomingEarnings.length });

  if (upcomingEarnings.length === 0) {
    log.flowEnd('getEarningsPlayOpportunities', flowStart, { found: 0 });
    return [];
  }

  // Step 2: Batch-fetch current prices
  const tickers = upcomingEarnings.map(e => e.ticker);
  const batchQuotes = await stockDataProvider.getBatchQuotes(tickers);
  log.info('Batch quotes fetched', { count: Object.keys(batchQuotes).length });

  // Step 3: For each stock, compare current price to price ~90 days ago (prior earnings period).
  // Finnhub free tier has no historical earnings calendar, so we approximate the previous
  // earnings price using the close from 90 days ago (within a ±5 day window).
  const now = new Date();
  const baselineUnix = Math.floor(now.getTime() / 1000) - 90 * 86400;
  const historicalCacheFiles = {};
  const results = [];

  for (const stock of upcomingEarnings) {
    const { ticker, name, date: upcomingEarningsDate, marketCap } = stock;

    try {
      const quote = batchQuotes[ticker];
      if (!quote || !quote.price) continue;

      const currentPrice = quote.price;
      const fromUnix = baselineUnix - 5 * 86400;
      const toUnix = baselineUnix + 5 * 86400;

      const history = await stockDataProvider.getHistoricalPrices(ticker, fromUnix, toUnix, historicalCacheFiles);
      if (!history || !history.c || history.c.length < 1) continue;

      // Closest trading day to the 90-day mark
      let bestIdx = 0;
      let bestDiff = Infinity;
      for (let i = 0; i < history.t.length; i++) {
        const diff = Math.abs(history.t[i] - baselineUnix);
        if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
      }
      const prevPrice = history.c[bestIdx];
      const prevDate = new Date(history.t[bestIdx] * 1000).toISOString().slice(0, 10);

      const priceChange = ((currentPrice - prevPrice) / prevPrice) * 100;

      if (priceChange <= -10) {
        results.push({
          ticker,
          name,
          upcomingEarningsDate,
          prevEarningsDate: prevDate,
          prevEarningsPrice: prevPrice,
          currentPrice,
          priceChange,
          marketCap
        });
      }
    } catch (err) {
      log.error('Error processing earnings play', { ticker, error: err.message });
    }
  }

  log.flowEnd('getEarningsPlayOpportunities', flowStart, {
    candidates: upcomingEarnings.length,
    found: results.length
  });

  return results.sort((a, b) => a.priceChange - b.priceChange);
}

module.exports = {
  getInvestmentOpportunities,
  getInvestmentOpportunitiesWithBuyAnalysis,
  getUpcomingRelevantEarnings,
  getEarningsPlayOpportunities,
}; 