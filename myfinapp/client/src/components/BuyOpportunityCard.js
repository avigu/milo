import React, { useState } from 'react';

const BuyOpportunityCard = ({ opportunity, rank }) => {
  const [showDetails, setShowDetails] = useState(false);
  
  const {
    ticker,
    originalStock,
    insiderData,
    valuationData,
    analystData,
    criteria,
    criteriaMetCount,
    recommendation,
    recommendationColor
  } = opportunity;

  const formatMarketCap = (cap) => {
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
    if (cap >= 1e6) return `$${(cap / 1e6).toFixed(1)}M`;
    return `$${cap}`;
  };

  const formatPrice = (price) => {
    return `$${price?.toFixed(2) || 'N/A'}`;
  };

  const formatChange = (change) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change?.toFixed(2) || '0.00'}%`;
  };

  const formatValue = (value) => {
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value?.toFixed(0) || '0'}`;
  };

  const getRecommendationClass = () => {
    if (recommendation === 'Strong Buy') return 'strong-buy';
    if (recommendation === 'Moderate Buy') return 'moderate-buy';
    return 'avoid';
  };

  return (
    <div className={`buy-opportunity-card ${getRecommendationClass()}`}>
      <div className="card-header">
        <div className="rank-badge">#{rank}</div>
        <div className="ticker-info">
          <h3 className="ticker">{ticker}</h3>
          <span className="earnings-date">📅 {originalStock.earningsDate}</span>
        </div>
        <div className="recommendation-badge">
          <span className={`recommendation ${getRecommendationClass()}`}>
            {recommendationColor} {recommendation}
          </span>
        </div>
      </div>

      <div className="price-info">
        <div className="price-change">
          <span className="change loser">
            {formatChange(originalStock.change)}
          </span>
        </div>
        
        <div className="price-details">
          <div className="price-row">
            <span className="label">Before:</span>
            <span className="value">{formatPrice(originalStock.priceBeforeEarnings)}</span>
          </div>
          <div className="price-row">
            <span className="label">Current:</span>
            <span className="value current">{formatPrice(originalStock.priceNow)}</span>
          </div>
        </div>
      </div>

      <div className="criteria-summary">
        <div className="criteria-count">
          <span className="label">Criteria Met:</span>
          <span className="value">{criteriaMetCount}/4</span>
        </div>
        
        <div className="criteria-indicators">
          <span className={`indicator ${criteria.droppedOver7Percent ? 'met' : 'not-met'}`} title="Dropped >7%">
            📉
          </span>
          <span className={`indicator ${criteria.insiderBuying ? 'met' : 'not-met'}`} title="Insider Buying">
            {insiderData.signal}
          </span>
          <span className={`indicator ${criteria.undervalued ? 'met' : 'not-met'}`} title="Undervalued P/E">
            💰
          </span>
          <span className={`indicator ${criteria.positiveAnalystSentiment ? 'met' : 'not-met'}`} title="Positive Analyst Sentiment">
            {analystData.sentiment}
          </span>
        </div>
      </div>

      <div className="quick-stats">
        <div className="stat">
          <span className="label">Market Cap:</span>
          <span className="value">{formatMarketCap(originalStock.marketCap)}</span>
        </div>
        
        {analystData.upsidePotential && (
          <div className="stat">
            <span className="label">Upside:</span>
            <span className={`value ${analystData.upsidePotential > 0 ? 'positive' : 'negative'}`}>
              {analystData.upsidePotential > 0 ? '+' : ''}{analystData.upsidePotential}%
            </span>
          </div>
        )}
      </div>

      <div className="card-actions">
        <button 
          className="details-button"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? '📊 Hide Details' : '📊 Show Details'}
        </button>
        <button 
          className="action-button"
          onClick={() => window.open(`https://finance.yahoo.com/quote/${ticker}`, '_blank')}
        >
          📈 View Chart
        </button>
      </div>

      {showDetails && (
        <div className="detailed-analysis">
          <div className="analysis-section">
            <h4>🏢 Insider Trading (3 months)</h4>
            <div className="insider-data">
              <div className="insider-stat">
                <span>Buys: {formatValue(insiderData.buyValue)} ({insiderData.totalBuys} shares)</span>
              </div>
              <div className="insider-stat">
                <span>Sells: {formatValue(insiderData.sellValue)} ({insiderData.totalSells} shares)</span>
              </div>
              <div className="insider-signal">
                Signal: {insiderData.signal}
              </div>
              {insiderData.hasValidPrices === false && (insiderData.totalBuys > 0 || insiderData.totalSells > 0) && (
                <div className="insider-note">
                  <small>⚠️ Values estimated using current price (transaction prices not available)</small>
                </div>
              )}
              {insiderData.transactionsWithPrices > 0 && insiderData.transactionsWithoutPrices > 0 && (
                <div className="insider-note">
                  <small>ℹ️ Mixed data: {insiderData.transactionsWithPrices} with actual prices, {insiderData.transactionsWithoutPrices} estimated</small>
                </div>
              )}
              {insiderData.totalBuys === 0 && insiderData.totalSells === 0 && (
                <div className="insider-note">
                  <small>No insider trading activity in the last 3 months</small>
                </div>
              )}
            </div>
          </div>

          <div className="analysis-section">
            <h4>📊 Valuation Analysis</h4>
            <div className="valuation-data">
              <div className="valuation-stat">
                <span>Company P/E: {valuationData.companyPE || 'N/A'}</span>
              </div>
              <div className="valuation-stat">
                <span>Industry P/E: {valuationData.industryPE || 'N/A'}</span>
              </div>
              <div className="valuation-status">
                {valuationData.isUndervalued ? '✅ Undervalued' : '❌ Not Undervalued'}
              </div>
              {valuationData.sector && (
                <div className="sector">
                  Sector: {valuationData.sector}
                </div>
              )}
            </div>
          </div>

          <div className="analysis-section">
            <h4>🎯 Analyst Sentiment</h4>
            <div className="analyst-data">
              <div className="ratings">
                <span>Buy: {analystData.ratings.buy}</span>
                <span>Hold: {analystData.ratings.hold}</span>
                <span>Sell: {analystData.ratings.sell}</span>
              </div>
              {analystData.averagePriceTarget && (
                <div className="price-target">
                  Avg Target: {formatPrice(analystData.averagePriceTarget)}
                </div>
              )}
              <div className="sentiment">
                Sentiment: {analystData.sentiment}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyOpportunityCard; 