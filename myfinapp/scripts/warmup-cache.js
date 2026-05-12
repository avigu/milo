#!/usr/bin/env node
// One-shot cache warmup: fetches tickers + market caps for both indices.
// Run from the myfinapp/ root: node scripts/warmup-cache.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { getTickersCached } = require('../services/tickers');
const { getBatchMarketCaps, getCacheStats } = require('../services/marketCap');

async function warmup(indexKey) {
  console.log(`\n=== ${indexKey.toUpperCase()} ===`);
  console.log('Fetching tickers...');
  const [tickers] = await getTickersCached(indexKey);
  console.log(`  tickers: ${tickers.length}`);

  console.log('Fetching market caps (batched, may take a while)...');
  const caps = await getBatchMarketCaps(tickers);
  const filled = Object.values(caps).filter(v => v != null).length;
  console.log(`  market caps: ${filled}/${tickers.length}`);
}

(async () => {
  try {
    await warmup('sp500');
    await warmup('nasdaq');
    const stats = getCacheStats();
    console.log(`\nDone. Market-cap cache: ${stats.fresh} fresh / ${stats.entries} total`);
  } catch (err) {
    console.error('Warmup failed:', err.message);
    process.exit(1);
  }
})();
