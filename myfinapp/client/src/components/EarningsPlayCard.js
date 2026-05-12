import React from 'react';

const EarningsPlayCard = ({ play, rank }) => {
  const {
    ticker,
    name,
    upcomingEarningsDate,
    prevEarningsDate,
    prevEarningsPrice,
    currentPrice,
    priceChange,
    marketCap
  } = play;

  const formatMarketCap = (cap) => {
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
    if (cap >= 1e6) return `$${(cap / 1e6).toFixed(1)}M`;
    return `$${cap}`;
  };

  const formatPrice = (price) => `$${price?.toFixed(2) || 'N/A'}`;

  return (
    <div className="earnings-play-card">
      <div className="card-header">
        <div className="rank-badge">#{rank}</div>
        <div className="ticker-info">
          <h3 className="ticker">{ticker}</h3>
          <span className="company-name-label">{name}</span>
        </div>
        <div className="play-badge">
          📉 Down {Math.abs(priceChange).toFixed(1)}%
        </div>
      </div>

      <div className="play-change-label">
        since last earnings ({prevEarningsDate})
      </div>

      <div className="price-info">
        <div className="price-change" style={{ color: '#dc3545', fontSize: '1.8rem', fontWeight: 700 }}>
          {priceChange.toFixed(1)}%
        </div>
        <div className="price-details">
          <div className="price-row">
            <span className="label">Prev earnings ({prevEarningsDate}):</span>
            <span className="value">{formatPrice(prevEarningsPrice)}</span>
          </div>
          <div className="price-row">
            <span className="label">Current:</span>
            <span className="value current">{formatPrice(currentPrice)}</span>
          </div>
        </div>
      </div>

      <div className="play-stats">
        <div className="stat">
          <span className="label">📅 Upcoming earnings:</span>
          <span className="value">{upcomingEarningsDate}</span>
        </div>
        <div className="stat">
          <span className="label">Market cap:</span>
          <span className="value">{formatMarketCap(marketCap)}</span>
        </div>
      </div>

      <div className="card-actions">
        <button
          className="action-button"
          onClick={() => window.open(`https://finance.yahoo.com/quote/${ticker}`, '_blank')}
        >
          📈 View Chart
        </button>
      </div>
    </div>
  );
};

export default EarningsPlayCard;
