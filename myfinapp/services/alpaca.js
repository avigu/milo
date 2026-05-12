const axios = require('axios');
const { createLogger } = require('../utils/logger');

const log = createLogger('ALPACA');

const BASE_URL = process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets';
const DATA_URL = 'https://data.alpaca.markets';
const API_KEY = process.env.ALPACA_API_KEY;
const API_SECRET = process.env.ALPACA_API_SECRET;

function headers() {
  return {
    'APCA-API-KEY-ID': API_KEY,
    'APCA-API-SECRET-KEY': API_SECRET
  };
}

function ready() {
  return !!(API_KEY && API_SECRET);
}

async function getAccount() {
  if (!ready()) return { error: 'Alpaca credentials not configured (need key + secret)' };
  try {
    const { data } = await axios.get(`${BASE_URL}/v2/account`, { headers: headers(), timeout: 10000 });
    return {
      status: data.status,
      buyingPower: parseFloat(data.buying_power),
      cash: parseFloat(data.cash),
      portfolioValue: parseFloat(data.portfolio_value),
      equity: parseFloat(data.equity),
      daytradeCount: data.daytrade_count,
      patternDayTrader: data.pattern_day_trader
    };
  } catch (err) {
    log.error('getAccount failed', { error: err.message });
    return { error: err.response?.data?.message || err.message };
  }
}

async function getPositions() {
  if (!ready()) return { error: 'Alpaca credentials not configured (need key + secret)' };
  try {
    const { data } = await axios.get(`${BASE_URL}/v2/positions`, { headers: headers(), timeout: 10000 });
    return data.map(p => ({
      symbol: p.symbol,
      qty: parseFloat(p.qty),
      side: p.side,
      marketValue: parseFloat(p.market_value),
      costBasis: parseFloat(p.cost_basis),
      unrealizedPL: parseFloat(p.unrealized_pl),
      unrealizedPLPct: parseFloat(p.unrealized_plpc) * 100,
      currentPrice: parseFloat(p.current_price),
      avgEntryPrice: parseFloat(p.avg_entry_price)
    }));
  } catch (err) {
    log.error('getPositions failed', { error: err.message });
    return { error: err.response?.data?.message || err.message };
  }
}

async function getOrders(status = 'all', limit = 50) {
  if (!ready()) return { error: 'Alpaca credentials not configured (need key + secret)' };
  try {
    const { data } = await axios.get(`${BASE_URL}/v2/orders`, {
      headers: headers(),
      params: { status, limit, direction: 'desc' },
      timeout: 10000
    });
    return data.map(o => ({
      id: o.id,
      symbol: o.symbol,
      side: o.side,
      type: o.type,
      qty: parseFloat(o.qty),
      filledQty: parseFloat(o.filled_qty || 0),
      status: o.status,
      limitPrice: o.limit_price ? parseFloat(o.limit_price) : null,
      filledAvgPrice: o.filled_avg_price ? parseFloat(o.filled_avg_price) : null,
      submittedAt: o.submitted_at,
      filledAt: o.filled_at
    }));
  } catch (err) {
    log.error('getOrders failed', { error: err.message });
    return { error: err.response?.data?.message || err.message };
  }
}

async function getPortfolio() {
  const [account, positions, orders] = await Promise.all([
    getAccount(),
    getPositions(),
    getOrders('all', 20)
  ]);

  if (account.error) return { error: account.error };

  const positionList = Array.isArray(positions) ? positions : [];
  const orderList = Array.isArray(orders) ? orders : [];

  const totalUnrealizedPL = positionList.reduce((sum, p) => sum + p.unrealizedPL, 0);
  const totalMarketValue = positionList.reduce((sum, p) => sum + p.marketValue, 0);

  return {
    account,
    positions: positionList,
    recentOrders: orderList,
    summary: {
      positionCount: positionList.length,
      totalMarketValue,
      totalUnrealizedPL,
      totalUnrealizedPLPct: totalMarketValue > 0
        ? (totalUnrealizedPL / (totalMarketValue - totalUnrealizedPL)) * 100
        : 0
    }
  };
}

async function getHistoricalBars(ticker, fromUnix, toUnix) {
  if (!ready()) return { s: 'no_key', c: [], t: [] };

  const start = new Date(fromUnix * 1000).toISOString();
  const end   = new Date(toUnix   * 1000).toISOString();

  const apiStart = log.apiCall('Alpaca', `bars(${ticker})`);
  try {
    let bars = [];
    let pageToken = null;

    do {
      const params = {
        start,
        end,
        timeframe: '1Day',
        adjustment: 'split',
        feed: 'iex',
        limit: 1000,
        ...(pageToken && { page_token: pageToken })
      };
      const { data } = await axios.get(
        `${DATA_URL}/v2/stocks/${encodeURIComponent(ticker)}/bars`,
        { headers: headers(), params, timeout: 15000 }
      );
      if (Array.isArray(data.bars)) bars = bars.concat(data.bars);
      pageToken = data.next_page_token || null;
    } while (pageToken);

    log.apiResult('Alpaca', `bars(${ticker})`, apiStart, true);

    if (bars.length === 0) return { s: 'no_data', c: [], t: [] };

    const sorted = bars
      .map(b => ({ t: Math.floor(new Date(b.t).getTime() / 1000), c: b.c }))
      .filter(d => Number.isFinite(d.t) && Number.isFinite(d.c))
      .sort((a, b) => a.t - b.t);

    if (sorted.length === 0) return { s: 'no_data', c: [], t: [] };

    return { s: 'ok', c: sorted.map(d => d.c), t: sorted.map(d => d.t) };
  } catch (err) {
    log.apiResult('Alpaca', `bars(${ticker})`, apiStart, false);
    log.warn('Alpaca bars fetch failed', { ticker, error: err.message });
    return { s: 'error', c: [], t: [] };
  }
}

module.exports = { getAccount, getPositions, getOrders, getPortfolio, getHistoricalBars };
