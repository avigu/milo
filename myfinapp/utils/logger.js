// utils/logger.js
// Centralized structured logging utility

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Get log level from environment, default to INFO
const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

function formatTimestamp() {
  return new Date().toISOString();
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function log(level, category, message, data = null) {
  if (LOG_LEVELS[level] < currentLogLevel) return;

  const timestamp = formatTimestamp();
  const prefix = `[${timestamp}] [${level}] [${category}]`;

  if (data !== null) {
    if (typeof data === 'object') {
      console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`${prefix} ${message}`, data);
    }
  } else {
    console.log(`${prefix} ${message}`);
  }
}

// Create a logger instance for a specific category
function createLogger(category) {
  return {
    debug: (message, data = null) => log('DEBUG', category, message, data),
    info: (message, data = null) => log('INFO', category, message, data),
    warn: (message, data = null) => log('WARN', category, message, data),
    error: (message, data = null) => log('ERROR', category, message, data),

    // Request lifecycle logging
    requestStart: (method, path, query = {}) => {
      const queryStr = Object.keys(query).length > 0 ? `?${new URLSearchParams(query)}` : '';
      log('INFO', category, `=> ${method} ${path}${queryStr}`);
      return Date.now();
    },

    requestEnd: (method, path, startTime, statusCode) => {
      const duration = Date.now() - startTime;
      log('INFO', category, `<= ${method} ${path} ${statusCode} (${formatDuration(duration)})`);
    },

    // API call logging
    apiCall: (service, operation, ticker = null) => {
      const tickerStr = ticker ? ` [${ticker}]` : '';
      log('DEBUG', category, `API Call: ${service}.${operation}${tickerStr}`);
      return Date.now();
    },

    apiResult: (service, operation, startTime, success = true, details = null) => {
      const duration = Date.now() - startTime;
      const status = success ? 'OK' : 'FAILED';
      const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
      log('DEBUG', category, `API Result: ${service}.${operation} ${status} (${formatDuration(duration)})${detailsStr}`);
    },

    // Flow logging
    flowStart: (flowName, context = {}) => {
      log('INFO', category, `=== ${flowName} Started ===`, Object.keys(context).length > 0 ? context : null);
      return Date.now();
    },

    flowEnd: (flowName, startTime, summary = {}) => {
      const duration = Date.now() - startTime;
      log('INFO', category, `=== ${flowName} Completed (${formatDuration(duration)}) ===`, Object.keys(summary).length > 0 ? summary : null);
    },

    // Cache logging
    cacheHit: (key) => log('DEBUG', category, `Cache HIT: ${key}`),
    cacheMiss: (key) => log('DEBUG', category, `Cache MISS: ${key}`),
    cacheWrite: (key) => log('DEBUG', category, `Cache WRITE: ${key}`),

    // Metrics logging
    metrics: (name, values) => {
      log('INFO', category, `Metrics [${name}]:`, values);
    },

    // Stock analysis logging
    stockAnalysis: (ticker, action, details = null) => {
      log('INFO', category, `[${ticker}] ${action}`, details);
    },

    // Utility functions exposed
    formatDuration,
    formatBytes
  };
}

module.exports = {
  createLogger,
  LOG_LEVELS,
  formatDuration,
  formatBytes
};
