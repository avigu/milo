import React, { useState, useEffect } from 'react';
import UnifiedStockCard from './components/UnifiedStockCard';
import BuyOpportunityCard from './components/BuyOpportunityCard';
import EarningsPlayCard from './components/EarningsPlayCard';
import IndexSelector from './components/IndexSelector';
import DateSelector from './components/DateSelector';
import EarningsCalendar from './components/EarningsCalendar';
import LoadingSpinner from './components/LoadingSpinner';
import './styles/App.css';

const App = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState('sp500');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [activeTab, setActiveTab] = useState('gainers');
  const [buyOpportunitiesLoading, setBuyOpportunitiesLoading] = useState(false);
  const [earningsPlays, setEarningsPlays] = useState(null);
  const [earningsPlaysLoading, setEarningsPlaysLoading] = useState(false);

  const fetchData = async (includeBuyAnalysis = false) => {
    setLoading(true);
    setError(null);
    if (includeBuyAnalysis) {
      setBuyOpportunitiesLoading(true);
    }
    
    try {
      const url = selectedIndex === 'nasdaq' ? '/nasdaq' : '/';
      const params = new URLSearchParams({ 
        start: selectedDate,
        buyAnalysis: includeBuyAnalysis.toString()
      });
      const response = await fetch(`${url}?${params}`, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setBuyOpportunitiesLoading(false);
    }
  };

  const fetchEarningsPlaysInternal = async (indexKey) => {
    setEarningsPlaysLoading(true);
    try {
      const response = await fetch(`/earnings-plays?index=${indexKey}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to fetch earnings plays');
      const result = await response.json();
      setEarningsPlays(result.earningsPlays || []);
    } catch (err) {
      setEarningsPlays([]);
    } finally {
      setEarningsPlaysLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch buy analysis if the buy opportunities tab is active
    const includeBuyAnalysis = activeTab === 'buyOpportunities';
    fetchData(includeBuyAnalysis);

    if (activeTab === 'earningsPlays') {
      fetchEarningsPlaysInternal(selectedIndex);
    } else {
      setEarningsPlays(null);
    }
  }, [selectedIndex, selectedDate, activeTab]);

  const handleRefresh = () => {
    const includeBuyAnalysis = activeTab === 'buyOpportunities';
    fetchData(includeBuyAnalysis);
    if (activeTab === 'earningsPlays') {
      fetchEarningsPlaysInternal(selectedIndex);
    }
  };

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    // If switching to buy opportunities and we don't have the data yet, fetch it
    if (newTab === 'buyOpportunities' && (!data?.buyOpportunities || data.buyOpportunities.length === 0)) {
      fetchData(true);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return (
    <div className="error-container">
      <div className="error-message">
        <h2>⚠️ Error</h2>
        <p>{error}</p>
        <button onClick={handleRefresh} className="retry-button">
          Try Again
        </button>
      </div>
    </div>
  );

  const { topGainers = [], topLosers = [], opportunities = [], buyOpportunities = [], upcomingEarnings = [] } = data || {};

  // Create a mapping of buy opportunities by ticker for easy lookup
  const buyOpportunityMap = buyOpportunities.reduce((map, opportunity) => {
    map[opportunity.ticker] = opportunity;
    return map;
  }, {});

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1 className="app-title">
            📈 MyFinApp
          </h1>
          <p className="app-subtitle">Real-time S&P 500 & NASDAQ Investment Opportunities</p>
        </div>
      </header>

      <div className="controls">
        <IndexSelector 
          selectedIndex={selectedIndex} 
          onIndexChange={setSelectedIndex} 
        />
        <DateSelector 
          selectedDate={selectedDate} 
          onDateChange={setSelectedDate} 
        />
        <button onClick={handleRefresh} className="refresh-button">
          🔄 Refresh
        </button>
      </div>

      <div className="main-content">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'gainers' ? 'active' : ''}`}
            onClick={() => handleTabChange('gainers')}
          >
            📈 Top Gainers ({topGainers.length})
          </button>
          <button 
            className={`tab ${activeTab === 'losers' ? 'active' : ''}`}
            onClick={() => handleTabChange('losers')}
          >
            📉 Top Losers ({topLosers.length})
          </button>
          <button 
            className={`tab ${activeTab === 'buyOpportunities' ? 'active' : ''}`}
            onClick={() => handleTabChange('buyOpportunities')}
          >
            💎 Buy Opportunities ({buyOpportunities.length})
          </button>
          <button
            className={`tab ${activeTab === 'earnings' ? 'active' : ''}`}
            onClick={() => handleTabChange('earnings')}
          >
            📅 Upcoming Earnings ({upcomingEarnings.length})
          </button>
          <button
            className={`tab ${activeTab === 'earningsPlays' ? 'active' : ''}`}
            onClick={() => handleTabChange('earningsPlays')}
          >
            🎯 Earnings Plays ({earningsPlays ? earningsPlays.length : 0})
          </button>
          <button
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => handleTabChange('all')}
          >
            📊 All Opportunities ({opportunities.length})
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'gainers' && (
            <div className="stock-grid">
              {topGainers.map((stock, index) => (
                <UnifiedStockCard 
                  key={stock.ticker} 
                  stock={stock} 
                  opportunity={buyOpportunityMap[stock.ticker]}
                  rank={index + 1} 
                  type="gainer" 
                />
              ))}
            </div>
          )}

          {activeTab === 'losers' && (
            <div className="stock-grid">
              {topLosers.map((stock, index) => (
                <UnifiedStockCard 
                  key={stock.ticker} 
                  stock={stock} 
                  opportunity={buyOpportunityMap[stock.ticker]}
                  rank={index + 1} 
                  type="loser" 
                />
              ))}
            </div>
          )}

          {activeTab === 'buyOpportunities' && (
            <div className="buy-opportunities-section">
              {buyOpportunitiesLoading ? (
                <div className="loading-section">
                  <LoadingSpinner />
                  <p>Analyzing buy opportunities... This may take a moment.</p>
                </div>
              ) : buyOpportunities.length > 0 ? (
                <>
                  <div className="section-header">
                    <h2>💎 Buy Opportunities Analysis</h2>
                    <p>Stocks that dropped &gt;7% after earnings with additional buy signals</p>
                  </div>
                  <div className="buy-opportunities-grid">
                    {buyOpportunities.map((opportunity, index) => (
                      <BuyOpportunityCard 
                        key={opportunity.ticker} 
                        opportunity={opportunity} 
                        rank={index + 1} 
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="no-opportunities">
                  <h3>🔍 No Buy Opportunities Found</h3>
                  <p>No stocks dropped more than 7% after earnings in the selected timeframe, or none met the buy criteria.</p>
                  <button onClick={() => fetchData(true)} className="analyze-button">
                    🔄 Re-analyze
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'earnings' && (
            <EarningsCalendar earnings={upcomingEarnings} />
          )}

          {activeTab === 'earningsPlays' && (
            <div className="earnings-plays-section">
              {earningsPlaysLoading ? (
                <div className="loading-section">
                  <LoadingSpinner />
                  <p>Scanning for earnings plays... This may take a moment.</p>
                </div>
              ) : earningsPlays && earningsPlays.length > 0 ? (
                <>
                  <div className="section-header">
                    <h2>🎯 Earnings Plays</h2>
                    <p>Stocks with upcoming earnings that are down ≥10% since their previous earnings event</p>
                  </div>
                  <div className="buy-opportunities-grid">
                    {earningsPlays.map((play, index) => (
                      <EarningsPlayCard
                        key={play.ticker}
                        play={play}
                        rank={index + 1}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="no-opportunities">
                  <h3>🔍 No Plays Found</h3>
                  <p>No stocks with upcoming earnings are down 10% or more since their previous earnings event.</p>
                  <button onClick={() => fetchEarningsPlaysInternal(selectedIndex)} className="analyze-button">
                    🔄 Re-scan
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'all' && (
            <div className="stock-grid">
              {opportunities.map((stock, index) => (
                <UnifiedStockCard 
                  key={stock.ticker} 
                  stock={stock} 
                  opportunity={buyOpportunityMap[stock.ticker]}
                  rank={index + 1} 
                  type={stock.change >= 0 ? 'gainer' : 'loser'} 
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="footer">
        <p>
          Data powered by Yahoo Finance, Finnhub & Financial Modeling Prep • 
          Updated: {new Date().toLocaleString()} • 
          <a href="/" target="_blank" rel="noopener noreferrer">
            View Classic UI
          </a>
        </p>
      </footer>
    </div>
  );
};

export default App; 