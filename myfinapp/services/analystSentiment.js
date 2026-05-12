const axios = require('axios');

const FMP_API_KEY = process.env.FMP_API_KEY || 'demo';

async function getAnalystSentiment(ticker) {
  try {
    // Get analyst recommendations
    const recommendationsUrl = `https://financialmodelingprep.com/api/v3/analyst-stock-recommendations/${ticker}?apikey=${FMP_API_KEY}`;
    const recommendationsResponse = await axios.get(recommendationsUrl);
    
    // Get price targets
    const priceTargetUrl = `https://financialmodelingprep.com/api/v3/price-target/${ticker}?apikey=${FMP_API_KEY}`;
    const priceTargetResponse = await axios.get(priceTargetUrl);
    
    // Get current stock price
    const quoteUrl = `https://financialmodelingprep.com/api/v3/quote/${ticker}?apikey=${FMP_API_KEY}`;
    const quoteResponse = await axios.get(quoteUrl);
    
    let ratings = { buy: 0, hold: 0, sell: 0 };
    let averagePriceTarget = null;
    let currentPrice = null;
    let sentiment = '🟡'; // Default to mixed
    
    // Process recommendations
    if (recommendationsResponse.data && recommendationsResponse.data.length > 0) {
      // Get the most recent recommendation summary
      const recentRecommendations = recommendationsResponse.data.slice(0, 10); // Last 10 recommendations
      
      recentRecommendations.forEach(rec => {
        const grade = rec.analystRatingsbuy || rec.analystRatingsHold || rec.analystRatingsSell;
        if (rec.analystRatingsbuy) ratings.buy += rec.analystRatingsbuy;
        if (rec.analystRatingsHold) ratings.hold += rec.analystRatingsHold;
        if (rec.analystRatingsSell) ratings.sell += rec.analystRatingsSell;
      });
    }
    
    // Process price targets
    if (priceTargetResponse.data && priceTargetResponse.data.length > 0) {
      const validTargets = priceTargetResponse.data
        .slice(0, 20) // Recent 20 price targets
        .map(pt => pt.priceTarget)
        .filter(target => target && target > 0);
      
      if (validTargets.length > 0) {
        averagePriceTarget = validTargets.reduce((sum, target) => sum + target, 0) / validTargets.length;
        averagePriceTarget = Math.round(averagePriceTarget * 100) / 100;
      }
    }
    
    // Get current price
    if (quoteResponse.data && quoteResponse.data.length > 0) {
      currentPrice = quoteResponse.data[0].price;
    }
    
    // Determine sentiment
    const totalRatings = ratings.buy + ratings.hold + ratings.sell;
    if (totalRatings > 0) {
      const buyPercentage = ratings.buy / totalRatings;
      const sellPercentage = ratings.sell / totalRatings;
      
      if (buyPercentage > 0.6) {
        sentiment = '🟢'; // Bullish
      } else if (sellPercentage > 0.4) {
        sentiment = '🔴'; // Bearish
      } else {
        sentiment = '🟡'; // Mixed
      }
    }
    
    // Calculate upside potential
    let upsidePotential = null;
    if (averagePriceTarget && currentPrice) {
      upsidePotential = ((averagePriceTarget - currentPrice) / currentPrice) * 100;
      upsidePotential = Math.round(upsidePotential * 100) / 100;
    }
    
    return {
      ratings,
      averagePriceTarget,
      currentPrice,
      upsidePotential,
      sentiment,
      isPositive: sentiment === '🟢' && (ratings.buy > (ratings.hold + ratings.sell))
    };
    
  } catch (error) {
    console.error(`Error fetching analyst sentiment for ${ticker}:`, error.message);
    return {
      ratings: { buy: 0, hold: 0, sell: 0 },
      averagePriceTarget: null,
      currentPrice: null,
      upsidePotential: null,
      sentiment: '🟡',
      isPositive: false
    };
  }
}

// Fallback function using a simplified approach with Yahoo Finance data
async function getAnalystSentimentSimplified(ticker) {
  try {
    // This is a simplified version that could scrape Yahoo Finance or use other sources
    // For now, we'll return a mock structure that can be enhanced later
    
    // You could implement web scraping here for Yahoo Finance analyst data
    // or use other free APIs that provide analyst recommendations
    
    return {
      ratings: { buy: 0, hold: 0, sell: 0 },
      averagePriceTarget: null,
      currentPrice: null,
      upsidePotential: null,
      sentiment: '🟡',
      isPositive: false
    };
    
  } catch (error) {
    console.error(`Error fetching simplified analyst sentiment for ${ticker}:`, error.message);
    return {
      ratings: { buy: 0, hold: 0, sell: 0 },
      averagePriceTarget: null,
      currentPrice: null,
      upsidePotential: null,
      sentiment: '🟡',
      isPositive: false
    };
  }
}

module.exports = {
  getAnalystSentiment,
  getAnalystSentimentSimplified
}; 