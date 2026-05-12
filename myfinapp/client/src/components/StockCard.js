import React from 'react';

const StockCard = ({ stock, rank, type, buyOpportunity }) => {
  const { ticker, change, priceBeforeEarnings, priceNow, marketCap, earningsDate } = stock;
  
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

  const getBuyOpportunityClass = () => {
    if (!buyOpportunity) return '';
    if (buyOpportunity.recommendation === 'Strong Buy') return 'strong-buy-opportunity';
    if (buyOpportunity.recommendation === 'Moderate Buy') return 'moderate-buy-opportunity';
    return '';
  };

  const cardClass = `stock-card ${type} ${change >= 5 ? 'hot' : ''} ${change <= -5 ? 'cold' : ''} ${getBuyOpportunityClass()}`;

  return (
    <div className={cardClass}>
      <div className="card-header">
        <div className="rank-badge">#{rank}</div>
        <div className="ticker-info">
          <h3 className="ticker">{ticker}</h3>
          {earningsDate && (
            <span className="earnings-date">📅 {earningsDate}</span>
          )}
        </div>
        {buyOpportunity && (
          <div className="buy-opportunity-indicator">
            <span className={`buy-signal ${buyOpportunity.recommendation.toLowerCase().replace(' ', '-')}`}>
              {buyOpportunity.recommendationColor}
            </span>
          </div>
        )}
      </div>

      <div className="price-info">
        <div className="price-change">
          <span className={`change ${type}`}>
            {formatChange(change)}
          </span>
        </div>
        
        <div className="price-details">
          <div className="price-row">
            <span className="label">Before:</span>
            <span className="value">{formatPrice(priceBeforeEarnings)}</span>
          </div>
          <div className="price-row">
            <span className="label">Current:</span>
            <span className="value current">{formatPrice(priceNow)}</span>
          </div>
        </div>
      </div>

      {buyOpportunity && (
        <div className="buy-opportunity-summary">
          <div className="criteria-met">
            <span className="label">Buy Criteria:</span>
            <span className="value">{buyOpportunity.criteriaMetCount}/4</span>
          </div>
          <div className="recommendation">
            <span className="label">Signal:</span>
            <span className={`value ${buyOpportunity.recommendation.toLowerCase().replace(' ', '-')}`}>
              {buyOpportunity.recommendation}
            </span>
          </div>
          {buyOpportunity.analystData?.upsidePotential && (
            <div className="upside-potential">
              <span className="label">Upside:</span>
              <span className={`value ${buyOpportunity.analystData.upsidePotential > 0 ? 'positive' : 'negative'}`}>
                {buyOpportunity.analystData.upsidePotential > 0 ? '+' : ''}{buyOpportunity.analystData.upsidePotential}%
              </span>
            </div>
          )}
        </div>
      )}

      <div className="market-cap">
        <span className="label">Market Cap:</span>
        <span className="value">{formatMarketCap(marketCap)}</span>
      </div>

      <div className="card-footer">
        <button 
          className="action-button"
          onClick={() => window.open(`https://finance.yahoo.com/quote/${ticker}`, '_blank')}
        >
          📊 View Details
        </button>
        {buyOpportunity && (
          <button 
            className="buy-analysis-button"
            onClick={() => {
              console.log('Buy Opportunity Analysis for', ticker, buyOpportunity);
              // Could open a modal or navigate to detailed analysis
            }}
          >
            💎 Buy Analysis
          </button>
        )}
      </div>
    </div>
  );
};

export default StockCard; 