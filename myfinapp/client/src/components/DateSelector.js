import React from 'react';

const DateSelector = ({ selectedDate, onDateChange }) => {
  const today = new Date().toISOString().slice(0, 10);
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <div className="date-selector">
      <label className="selector-label" htmlFor="date-input">
        📅 Analysis Date:
      </label>
      <input
        id="date-input"
        type="date"
        value={selectedDate}
        onChange={(e) => onDateChange(e.target.value)}
        min={oneWeekAgo}
        max={today}
        className="date-input"
      />
      <div className="date-shortcuts">
        <button 
          className={`shortcut-btn ${selectedDate === today ? 'active' : ''}`}
          onClick={() => onDateChange(today)}
        >
          Today
        </button>
        <button 
          className={`shortcut-btn ${selectedDate === new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10) ? 'active' : ''}`}
          onClick={() => onDateChange(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10))}
        >
          Yesterday
        </button>
      </div>
    </div>
  );
};

export default DateSelector; 