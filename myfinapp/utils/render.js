// utils/render.js
const { INDICES } = require('../config/indices');

function renderTabbedHtml({ indexKey, startDate, topGainers, topLosers, opportunities, upcomingEarnings }) {
  const index = INDICES[indexKey];
  const otherKey = indexKey === 'sp500' ? 'nasdaq' : 'sp500';
  const otherIndex = INDICES[otherKey];
  
  return `
    <html>
      <head>
        <title>${index.name} Investment Opportunities</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="manifest" href="/manifest.json">
        <link rel="icon" href="/icon-192.png">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1, h2 { color: #333; }
          ul { list-style-type: none; padding: 0; }
          li { background: #f4f4f4; margin: 5px 0; padding: 10px; border-radius: 5px; }
          .gainer { color: green; }
          .loser { color: red; }
          .loading { display: none; color: #007bff; font-weight: bold; }
          form { margin-bottom: 20px; }
          label { margin-right: 10px; }
          button { padding: 6px 16px; border-radius: 4px; border: none; background: #007bff; color: #fff; font-size: 1em; }
          button:active { background: #0056b3; }
          .tabs { display: flex; margin-bottom: 20px; }
          .tab { flex: 1; text-align: center; padding: 10px; cursor: pointer; background: #eee; border-radius: 5px 5px 0 0; margin-right: 2px; }
          .tab.active { background: #fff; border-bottom: 2px solid #007bff; font-weight: bold; }
          @media (max-width: 600px) {
            body { margin: 5px; font-size: 16px; }
            h1 { font-size: 1.5em; }
            h2 { font-size: 1.1em; }
            li { padding: 8px; font-size: 1em; }
            button { width: 100%; margin-top: 10px; }
            .tabs { flex-direction: column; }
            .tab { margin-bottom: 2px; }
          }
        </style>
        <script>
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/service-worker.js');
            });
          }
        </script>
      </head>
      <body>
        <div class="tabs">
          <a href="/" class="tab${indexKey === 'sp500' ? ' active' : ''}">S&amp;P 500</a>
          <a href="/nasdaq" class="tab${indexKey === 'nasdaq' ? ' active' : ''}">NASDAQ</a>
        </div>
        <h1>${index.name} Investment Opportunities</h1>
        <form id="dateForm">
          <label for="start">Start date:</label>
          <input type="date" id="start" name="start" value="${startDate}">
          <button type="submit">Refresh</button>
          <span class="loading" id="loading">Loading...</span>
        </form>
        <script>
          const form = document.getElementById('dateForm');
          const loading = document.getElementById('loading');
          form.addEventListener('submit', function(e) {
            e.preventDefault();
            loading.style.display = 'inline';
            const start = document.getElementById('start').value;
            let base = window.location.pathname === '/nasdaq' ? '/nasdaq' : '/';
            window.location = base + '?start=' + start;
          });
          if (window.location.search.includes('start=')) {
            loading.style.display = 'none';
          }
        </script>
        <h2>${index.gainersTitle}</h2><ul>` +
    topGainers.map(stock => `<li>${stock.ticker} (${stock.name}): <span class="gainer">${stock.change.toFixed(2)}%</span> (from $${stock.priceBeforeEarnings.toFixed(2)} to $${stock.priceNow.toFixed(2)})</li>`).join('') +
    `</ul><h2>${index.losersTitle}</h2><ul>` +
    topLosers.map(stock => `<li>${stock.ticker} (${stock.name}): <span class="loser">${stock.change.toFixed(2)}%</span> (from $${stock.priceBeforeEarnings.toFixed(2)} to $${stock.priceNow.toFixed(2)})</li>`).join('') +
    `</ul><h2>Summary</h2><p><strong>${opportunities.length}</strong> ${index.earningsSummary}</p>` +
    `<h2>${index.upcomingTitle}</h2><ul>` +
    (upcomingEarnings.length === 0 ? '<li>No relevant upcoming earnings found.</li>' :
      upcomingEarnings.map(e => `<li>${e.ticker} (${e.name}): ${e.date}${e.marketCap ? ` (Market Cap: $${(e.marketCap/1e9).toFixed(1)}B)` : ''}</li>`).join('')) +
    '</ul></body></html>';
}

module.exports = {
  renderTabbedHtml,
}; 