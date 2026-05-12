import React from 'react';

const EarningsCalendar = ({ earnings }) => {
  if (!earnings || earnings.length === 0) {
    return (
      <div className="earnings-empty">
        <div className="empty-state">
          <h3>📅 No upcoming earnings</h3>
          <p>No earnings reports scheduled for the selected timeframe.</p>
        </div>
      </div>
    );
  }

  const groupedEarnings = earnings.reduce((groups, earning) => {
    const date = earning.date || earning.earningsDate;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(earning);
    return groups;
  }, {});

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTimeOfDay = (time) => {
    switch (time) {
      case 'bmo': return '🌅 Before Market';
      case 'amc': return '🌆 After Market';
      default: return '📊 During Market';
    }
  };

  return (
    <div className="earnings-calendar">
      {Object.entries(groupedEarnings)
        .sort(([a], [b]) => new Date(a) - new Date(b))
        .map(([date, companies]) => (
          <div key={date} className="earnings-day">
            <h3 className="date-header">
              {formatDate(date)}
              <span className="company-count">({companies.length} companies)</span>
            </h3>
            
            <div className="earnings-list">
              {companies.map((company, index) => (
                <div key={`${company.symbol || company.ticker}-${index}`} className="earnings-item">
                  <div className="company-info">
                    <h4 className="company-ticker">
                      {company.symbol || company.ticker}
                    </h4>
                    {(company.name || company.companyName) && (
                      <p className="company-name">{company.name || company.companyName}</p>
                    )}
                  </div>
                  
                  <div className="earnings-meta">
                    {company.time && (
                      <span className="earnings-time">
                        {getTimeOfDay(company.time)}
                      </span>
                    )}
                    
                    {company.epsEstimate && (
                      <span className="eps-estimate">
                        EPS Est: ${company.epsEstimate}
                      </span>
                    )}
                    
                    {company.revenueEstimate && (
                      <span className="revenue-estimate">
                        Rev Est: ${company.revenueEstimate}
                      </span>
                    )}
                  </div>
                  
                  <button 
                    className="view-stock-button"
                    onClick={() => window.open(`https://finance.yahoo.com/quote/${company.symbol || company.ticker}`, '_blank')}
                  >
                    📈 View
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
};

export default EarningsCalendar; 