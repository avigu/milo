import React from 'react';

const IndexSelector = ({ selectedIndex, onIndexChange }) => {
  return (
    <div className="index-selector">
      <label className="selector-label">Market Index:</label>
      <div className="radio-group">
        <label className="radio-option">
          <input
            type="radio"
            value="sp500"
            checked={selectedIndex === 'sp500'}
            onChange={(e) => onIndexChange(e.target.value)}
          />
          <span className="radio-custom"></span>
          📈 S&P 500
        </label>
        <label className="radio-option">
          <input
            type="radio"
            value="nasdaq"
            checked={selectedIndex === 'nasdaq'}
            onChange={(e) => onIndexChange(e.target.value)}
          />
          <span className="radio-custom"></span>
          💻 NASDAQ
        </label>
      </div>
    </div>
  );
};

export default IndexSelector; 