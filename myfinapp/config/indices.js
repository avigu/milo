// config/indices.js
const axios = require('axios');
const cheerio = require('cheerio');

// Custom axios instance with proper User-Agent for Wikipedia
const wikiAxios = axios.create({
  headers: {
    'User-Agent': 'MyFinApp/1.0 (https://github.com/myfinapp; contact@myfinapp.com) axios/1.9.0'
  }
});

const INDICES = {
  sp500: {
    name: 'S&P 500',
    cachePrefix: 'sp500',
    tickersUrl: 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies',
    getTickers: async function () {
      console.log('Fetching S&P 500 tickers from Wikipedia...');
      const url = this.tickersUrl;
      const response = await wikiAxios.get(url);
      const $ = cheerio.load(response.data);
      const tickers = [];
      const nameMap = {};
      $('table.wikitable tbody tr').each((i, elem) => {
        const symbol = $(elem).find('td').first().text().trim();
        const name = $(elem).find('td').eq(1).text().trim();
        if (
          symbol &&
          symbol !== 'Symbol' &&
          symbol !== 'SP500' &&
          /^[A-Z.-]{1,6}$/.test(symbol) &&
          !symbol.includes(' ')
        ) {
          const ticker = symbol.replace('.', '-');
          tickers.push(ticker);
          nameMap[ticker] = name;
        }
      });
      // Remove any accidental 'SP500' or non-ticker entries
      let filteredTickers = tickers.filter(t => t !== 'SP500' && /^[A-Z-]{1,6}$/.test(t));
      return {
        tickers: filteredTickers,
        nameMap
      };
    },
    minMarketCap: 5_000_000_000,
    earningsSummary: 'S&P 500 stocks had earnings in the last 10 days.',
    upcomingTitle: 'Upcoming S&P 500 Earnings (Next 5 Days, Market Cap > $5B)',
    gainersTitle: 'Top 5 Positive Changes (Day Before Earnings to Today)',
    losersTitle: 'Top 5 Drops (Day Before Earnings to Today)',
    default: true
  },
  nasdaq: {
    name: 'NASDAQ',
    cachePrefix: 'nasdaq',
    tickersUrl: 'https://www.nasdaqtrader.com/dynamic/symdir/nasdaqlisted.txt',
    getTickers: async function () {
      console.log('Fetching NASDAQ tickers...');
      const url = this.tickersUrl;
      const response = await axios.get(url);
      const lines = response.data.split('\n');
      const tickers = [];
      const nameMap = {};
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('File Creation Time') || line.startsWith('Symbol|')) continue;
        const cols = line.split('|');
        if (cols.length < 2) continue;
        let symbol = cols[0].trim();
        let name = cols[1].trim();
        if (symbol && name && /^[A-Z.-]{1,6}$/.test(symbol) && !symbol.includes(' ') && symbol !== 'Symbol') {
          tickers.push(symbol);
          nameMap[symbol] = name;
        }
      }
      return { tickers, nameMap };
    },
    minMarketCap: 1_000_000_000,
    earningsSummary: 'NASDAQ stocks had earnings in the last 7 days.',
    upcomingTitle: 'Upcoming NASDAQ Earnings (Next 5 Days)',
    gainersTitle: 'Top 5 Positive Changes (Last Trading Day to Now)',
    losersTitle: 'Top 5 Drops (Last Trading Day to Now)',
    default: false
  }
};

module.exports = { INDICES }; 