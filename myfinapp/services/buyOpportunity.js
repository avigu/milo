const { getInsiderTransactions } = require('./insiderTrading');
const { getValuationAnalysis, getValuationAnalysisAlphaVantage } = require('./valuation');
const { getAnalystSentiment, getAnalystSentimentSimplified } = require('./analystSentiment');
const { createLogger } = require('../utils/logger');

const log = createLogger('BUY_OPPORTUNITY');

async function analyzeBuyOpportunity(stock) {
  // Only analyze stocks that dropped more than 7%
  if (stock.change >= -7) {
    log.debug(`Skipping stock: insufficient drop`, { ticker: stock.ticker, change: `${stock.change.toFixed(2)}%` });
    return null;
  }

  log.stockAnalysis(stock.ticker, 'Starting buy opportunity analysis', {
    change: `${stock.change.toFixed(2)}%`,
    price: `$${stock.priceBeforeEarnings} -> $${stock.priceNow}`,
    marketCap: `$${(stock.marketCap / 1e9).toFixed(1)}B`
  });

  try {
    log.debug(`Fetching analysis data`, { ticker: stock.ticker });

    // Fetch all data in parallel for better performance
    const [insiderData, valuationData, analystData] = await Promise.all([
      getInsiderTransactions(stock.ticker).then(data => {
        log.stockAnalysis(stock.ticker, 'Insider data received', {
          signal: data.signal,
          buys: `$${(data.buyValue / 1e6).toFixed(1)}M`,
          sells: `$${(data.sellValue / 1e6).toFixed(1)}M`
        });
        return data;
      }).catch(err => {
        log.warn(`Insider data fetch failed`, { ticker: stock.ticker, error: err.message });
        return { signal: '⚪', buyValue: 0, sellValue: 0, totalBuys: 0, totalSells: 0 };
      }),

      getValuationAnalysis(stock.ticker).catch(() => {
        log.debug(`Primary valuation failed, trying fallback`, { ticker: stock.ticker });
        return getValuationAnalysisAlphaVantage(stock.ticker);
      }).then(data => {
        log.stockAnalysis(stock.ticker, 'Valuation data received', {
          companyPE: data.companyPE,
          industryPE: data.industryPE,
          isUndervalued: data.isUndervalued
        });
        return data;
      }).catch(err => {
        log.warn(`Valuation analysis failed`, { ticker: stock.ticker, error: err.message });
        return { companyPE: null, industryPE: null, isUndervalued: false, sector: 'Unknown' };
      }),

      getAnalystSentiment(stock.ticker).catch(() => {
        log.debug(`Primary analyst sentiment failed, trying fallback`, { ticker: stock.ticker });
        return getAnalystSentimentSimplified(stock.ticker);
      }).then(data => {
        log.stockAnalysis(stock.ticker, 'Analyst sentiment received', {
          sentiment: data.sentiment,
          upside: data.upsidePotential || 'N/A',
          isPositive: data.isPositive
        });
        return data;
      }).catch(err => {
        log.warn(`Analyst sentiment failed`, { ticker: stock.ticker, error: err.message });
        return { sentiment: '⚪', isPositive: false, ratings: { buy: 0, hold: 0, sell: 0 }, upsidePotential: null };
      })
    ]);

    // Determine if this is a buy opportunity based on criteria
    const criteria = {
      droppedOver7Percent: stock.change < -7,
      insiderBuying: insiderData.signal === '🟢',
      undervalued: valuationData.isUndervalued,
      positiveAnalystSentiment: analystData.isPositive
    };

    // Count how many criteria are met
    const criteriaMetCount = Object.values(criteria).filter(Boolean).length;
    const isBuyOpportunity = criteriaMetCount >= 3; // At least 3 out of 4 criteria

    log.stockAnalysis(stock.ticker, 'Criteria evaluation', {
      dropped: criteria.droppedOver7Percent,
      insiderBuying: criteria.insiderBuying,
      undervalued: criteria.undervalued,
      positiveAnalyst: criteria.positiveAnalystSentiment,
      metCount: `${criteriaMetCount}/4`
    });

    // Generate recommendation
    let recommendation = 'Hold';
    let recommendationColor = '🟡';

    if (isBuyOpportunity) {
      recommendation = 'Strong Buy';
      recommendationColor = '🟢';
    } else if (criteriaMetCount >= 2) {
      recommendation = 'Moderate Buy';
      recommendationColor = '🟡';
    } else {
      recommendation = 'Avoid';
      recommendationColor = '🔴';
    }

    log.stockAnalysis(stock.ticker, `RECOMMENDATION: ${recommendation}`, { criteriaMetCount });

    const result = {
      ticker: stock.ticker,
      originalStock: stock,
      insiderData,
      valuationData,
      analystData,
      criteria,
      criteriaMetCount,
      isBuyOpportunity,
      recommendation,
      recommendationColor,
      analysisDate: new Date().toISOString()
    };

    log.info(`Analysis completed`, { ticker: stock.ticker, recommendation });
    return result;

  } catch (error) {
    log.error(`Critical error during analysis`, { ticker: stock.ticker, error: error.message, stack: error.stack });
    return null;
  }
}

async function analyzeBuyOpportunities(stocks) {
  // Filter stocks that dropped more than 7%
  const droppedStocks = stocks.filter(stock => stock.change < -7);

  if (droppedStocks.length === 0) {
    log.info(`No stocks dropped >7%, skipping buy analysis`);
    return [];
  }

  // Analyze each stock (limit to prevent API rate limiting)
  const stocksToAnalyze = droppedStocks.slice(0, 10); // Limit to 10 stocks
  const flowStart = log.flowStart('analyzeBuyOpportunities', {
    totalDropped: droppedStocks.length,
    analyzing: stocksToAnalyze.length
  });

  const opportunities = [];

  for (let i = 0; i < stocksToAnalyze.length; i++) {
    const stock = stocksToAnalyze[i];
    log.debug(`Analyzing stock ${i + 1}/${stocksToAnalyze.length}`, { ticker: stock.ticker });

    const analysis = await analyzeBuyOpportunity(stock);
    if (analysis) {
      opportunities.push(analysis);
    }

    // Add small delay to prevent API rate limiting
    if (i < stocksToAnalyze.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Sort by criteria met count (best opportunities first)
  const sortedOpportunities = opportunities.sort((a, b) => b.criteriaMetCount - a.criteriaMetCount);

  log.flowEnd('analyzeBuyOpportunities', flowStart, {
    analyzed: stocksToAnalyze.length,
    opportunitiesFound: sortedOpportunities.length,
    recommendations: {
      strongBuy: sortedOpportunities.filter(o => o.recommendation === 'Strong Buy').length,
      moderateBuy: sortedOpportunities.filter(o => o.recommendation === 'Moderate Buy').length,
      hold: sortedOpportunities.filter(o => o.recommendation === 'Hold').length,
      avoid: sortedOpportunities.filter(o => o.recommendation === 'Avoid').length
    }
  });

  return sortedOpportunities;
}

function generateBuyOpportunityReport(opportunity) {
  const { ticker, originalStock, insiderData, valuationData, analystData, criteria, recommendation } = opportunity;
  
  let report = `\n📊 BUY OPPORTUNITY ANALYSIS: ${ticker}\n`;
  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `💰 Price Drop: ${originalStock.change.toFixed(2)}% (${originalStock.priceBeforeEarnings} → ${originalStock.priceNow})\n`;
  report += `📅 Earnings Date: ${originalStock.earningsDate}\n\n`;
  
  report += `🔍 ANALYSIS CRITERIA:\n`;
  report += `${criteria.droppedOver7Percent ? '✅' : '❌'} Dropped >7% after earnings\n`;
  report += `${criteria.insiderBuying ? '✅' : '❌'} Insider buying activity ${insiderData.signal}\n`;
  report += `${criteria.undervalued ? '✅' : '❌'} Undervalued vs industry (P/E: ${valuationData.companyPE} vs ${valuationData.industryPE})\n`;
  report += `${criteria.positiveAnalystSentiment ? '✅' : '❌'} Positive analyst sentiment ${analystData.sentiment}\n\n`;
  
  report += `📈 RECOMMENDATION: ${recommendation}\n`;
  
  if (analystData.upsidePotential) {
    report += `🎯 Price Target Upside: ${analystData.upsidePotential > 0 ? '+' : ''}${analystData.upsidePotential}%\n`;
  }
  
  return report;
}

module.exports = {
  analyzeBuyOpportunity,
  analyzeBuyOpportunities,
  generateBuyOpportunityReport
}; 