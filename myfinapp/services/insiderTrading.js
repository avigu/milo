const axios = require('axios');
const moment = require('moment');

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || 'd0gfql9r01qhao4tdc6gd0gfql9r01qhao4tdc70';

async function getInsiderTransactions(ticker) {
  console.log(`[INSIDER] 🔍 Fetching insider transactions for ${ticker}...`);
  
  try {
    // Get transactions from last 3 months
    const fromDate = moment().subtract(3, 'months').format('YYYY-MM-DD');
    const toDate = moment().format('YYYY-MM-DD');
    
    console.log(`[INSIDER] ${ticker} - Date range: ${fromDate} to ${toDate}`);
    
    const url = `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${ticker}&from=${fromDate}&to=${toDate}&token=${FINNHUB_API_KEY}`;
    console.log(`[INSIDER] ${ticker} - Fetching from Finnhub...`);
    
    const response = await axios.get(url);
    
    if (!response.data || !response.data.data) {
      console.log(`[INSIDER] ${ticker} - No data returned from API`);
      return { totalBuys: 0, totalSells: 0, buyValue: 0, sellValue: 0, signal: '⚪', transactions: [], hasValidPrices: false };
    }
    
    const transactions = response.data.data;
    console.log(`[INSIDER] ${ticker} - Found ${transactions.length} transactions`);
    
    // Get current stock price as fallback for missing prices
    let currentPrice = null;
    try {
      const priceUrl = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`;
      const priceResponse = await axios.get(priceUrl);
      currentPrice = priceResponse.data?.c || null;
      console.log(`[INSIDER] ${ticker} - Current stock price: $${currentPrice}`);
    } catch (error) {
      console.log(`[INSIDER] ${ticker} - Could not fetch current price: ${error.message}`);
    }
    
    let totalBuys = 0;
    let totalSells = 0;
    let buyValue = 0;
    let sellValue = 0;
    let transactionsWithPrices = 0;
    let transactionsWithoutPrices = 0;
    
    // Transaction type mapping for better categorization
    const buyTransactionTypes = ['P', 'A', 'G', 'J', 'K', 'L', 'W', 'Z']; // Purchase, Award, Gift, etc.
    const sellTransactionTypes = ['S', 'D', 'F', 'H', 'I', 'T', 'U', 'V', 'X', 'Y']; // Sale, Disposition, etc.
    
    transactions.forEach((transaction, index) => {
      const shares = transaction.share || 0;
      const price = transaction.price || 0;
      const code = transaction.transactionCode;
      
      // Determine if this is a buy or sell transaction
      const isBuyTransaction = buyTransactionTypes.includes(code);
      const isSellTransaction = sellTransactionTypes.includes(code);
      
      if (!isBuyTransaction && !isSellTransaction) {
        console.log(`[INSIDER] ${ticker} - Transaction ${index + 1}: ${code} | ${shares} shares @ $${price} = Unknown type - skipping`);
        return;
      }
      
      // Calculate value using actual price or fallback to current price
      let value = 0;
      let priceUsed = price;
      let priceSource = 'actual';
      
      if (price > 0) {
        value = shares * price;
        transactionsWithPrices++;
      } else if (currentPrice && currentPrice > 0) {
        // Use current price as fallback for transactions without price
        value = shares * currentPrice;
        priceUsed = currentPrice;
        priceSource = 'current';
        transactionsWithoutPrices++;
      } else {
        // No price available - count shares but no value
        priceUsed = 0;
        priceSource = 'none';
        transactionsWithoutPrices++;
      }
      
      console.log(`[INSIDER] ${ticker} - Transaction ${index + 1}: ${code} | ${shares} shares @ $${priceUsed} (${priceSource}) = $${value.toFixed(0)}`);
      
      if (isBuyTransaction) {
        totalBuys += shares;
        buyValue += value;
        console.log(`[INSIDER] ${ticker} - Added to BUYS: ${shares} shares, $${value.toFixed(0)}`);
      } else if (isSellTransaction) {
        totalSells += shares;
        sellValue += value;
        console.log(`[INSIDER] ${ticker} - Added to SELLS: ${shares} shares, $${value.toFixed(0)}`);
      }
    });
    
    console.log(`[INSIDER] ${ticker} - TOTALS: Buys=${totalBuys} shares ($${buyValue.toFixed(0)}), Sells=${totalSells} shares ($${sellValue.toFixed(0)})`);
    console.log(`[INSIDER] ${ticker} - Price data: ${transactionsWithPrices} with actual prices, ${transactionsWithoutPrices} using fallback/no price`);
    
    // Determine signal based on value when available, otherwise use share count
    let signal = '⚪'; // No activity
    const hasValidPrices = transactionsWithPrices > 0 || (currentPrice && transactionsWithoutPrices > 0);
    
    if (hasValidPrices && (buyValue > 0 || sellValue > 0)) {
      // Use value-based comparison when we have price data
      if (buyValue > sellValue * 1.2) {
        signal = '🟢'; // More buying than selling (with 20% buffer)
        console.log(`[INSIDER] ${ticker} - Signal: 🟢 (More buying by value: $${buyValue.toFixed(0)} vs $${sellValue.toFixed(0)})`);
      } else if (sellValue > buyValue * 1.2) {
        signal = '🔴'; // More selling than buying (with 20% buffer)
        console.log(`[INSIDER] ${ticker} - Signal: 🔴 (More selling by value: $${sellValue.toFixed(0)} vs $${buyValue.toFixed(0)})`);
      } else {
        console.log(`[INSIDER] ${ticker} - Signal: ⚪ (Neutral activity by value)`);
      }
    } else if (totalBuys > 0 || totalSells > 0) {
      // Fallback to share count comparison when no price data available
      if (totalBuys > totalSells * 1.2) {
        signal = '🟢';
        console.log(`[INSIDER] ${ticker} - Signal: 🟢 (More buying by shares: ${totalBuys} vs ${totalSells})`);
      } else if (totalSells > totalBuys * 1.2) {
        signal = '🔴';
        console.log(`[INSIDER] ${ticker} - Signal: 🔴 (More selling by shares: ${totalSells} vs ${totalBuys})`);
      } else {
        console.log(`[INSIDER] ${ticker} - Signal: ⚪ (Neutral activity by shares)`);
      }
    } else {
      console.log(`[INSIDER] ${ticker} - Signal: ⚪ (No significant activity)`);
    }
    
    const result = {
      totalBuys,
      totalSells,
      buyValue: Math.round(buyValue),
      sellValue: Math.round(sellValue),
      signal,
      hasValidPrices,
      transactionsWithPrices,
      transactionsWithoutPrices,
      currentPriceFallback: currentPrice,
      transactions: transactions.slice(0, 10) // Return recent 10 for display
    };
    
    console.log(`[INSIDER] ${ticker} - ✅ Final result:`, {
      totalBuys: result.totalBuys,
      totalSells: result.totalSells,
      buyValue: result.buyValue,
      sellValue: result.sellValue,
      signal: result.signal,
      hasValidPrices: result.hasValidPrices
    });
    
    return result;
    
  } catch (error) {
    console.error(`[INSIDER] ${ticker} - ❌ Error fetching insider transactions: ${error.message}`);
    return { totalBuys: 0, totalSells: 0, buyValue: 0, sellValue: 0, signal: '⚪', transactions: [], hasValidPrices: false };
  }
}

module.exports = {
  getInsiderTransactions
}; 