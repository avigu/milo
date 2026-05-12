# Cache Invalidation Policy

## Overview
This document outlines the caching strategy and invalidation policies for the MyFinApp application.

## Cache Duration Policies

### Updated Cache Durations (as of latest update)

| Data Type | Cache Duration | Rationale |
|-----------|----------------|-----------|
| **Ticker Lists** | 30 days | Stock listings change very infrequently |
| **Market Cap Data** | 1 week (7 days) | Market cap changes daily but weekly updates sufficient for filtering |
| **Earnings Calendar** | 3 days | Earnings dates are scheduled but may have updates |
| **Historical Prices** | 1 hour | Price data needs to be relatively fresh for calculations |

## Caching Architecture

### Two-Tier Caching Strategy

1. **In-Memory Cache (L1)**
   - Fast access for repeated requests within the same session
   - Reduces storage I/O operations
   - Automatically populated from persistent cache

2. **Persistent Cache (L2 - Google Cloud Storage)**
   - Survives server restarts
   - Shared across multiple server instances
   - JSON-based storage with timestamps

### Cache Flow

```
Request → In-Memory Cache → Persistent Cache → Network API → Cache Storage
```

## Implementation Details

### Ticker Data (`services/tickers.js`)
- **Duration**: 30 days
- **In-Memory**: `tickersMemoryCache` object
- **Persistent**: GCS files named `{index}-tickers.json`
- **Cache Key**: `{index.cachePrefix}-tickers`

### Market Cap Data (`services/marketCap.js`)
- **Duration**: 1 week
- **In-Memory**: `marketCapCache` object (loaded on startup)
- **Persistent**: GCS file `marketcap-all.json`
- **Cache Key**: Individual ticker symbols

### Earnings Calendar (`services/earnings.js`)
- **Duration**: 3 days
- **In-Memory**: `earningsMemoryCache` object
- **Persistent**: GCS files named `earnings-{from}-{to}.json`
- **Cache Key**: `earnings-{from}-{to}`

### Historical Prices (`services/historical.js`)
- **Duration**: 1 hour
- **In-Memory**: Per-request `historicalCacheFiles` object
- **Persistent**: GCS files named `historical-all-{indexKey}.json`
- **Cache Key**: `{ticker}[{from}-{to}]`

## Cache Invalidation Triggers

### Automatic Invalidation
- **Time-based expiration**: Each cache entry has a timestamp and TTL
- **Parameter-based**: Different cache entries for different parameters

### Manual Invalidation
- **Server restart**: Clears in-memory caches (except market cap which reloads)
- **Application refresh**: Mobile app forces new API calls

## Performance Optimizations

### Reduced Storage I/O
- In-memory caching prevents repeated reads from GCS within the same request
- Market cap cache is pre-loaded on server startup
- Historical data uses per-request caching to avoid file re-reads

### Cache Hit Logging
- All cache services now log when using in-memory vs persistent cache
- Network calls are clearly logged for monitoring

## Monitoring

### Log Patterns
- `[CACHE] Using in-memory cache for...` - L1 cache hit
- `[CACHE] Using persistent cache for...` - L2 cache hit
- `[NETWORK] Fetching ... from network` - Cache miss, network call

### Performance Metrics
- Cache hit/miss ratios can be derived from logs
- Network call frequency indicates cache effectiveness
- Response times show impact of caching strategy

## Future Improvements

1. **Cache Size Limits**: Implement LRU eviction for in-memory caches
2. **Cache Warming**: Pre-populate caches for common requests
3. **Selective Invalidation**: API endpoints for manual cache clearing
4. **Client-Side Caching**: Add AsyncStorage caching in mobile app
5. **Cache Metrics**: Dedicated monitoring dashboard for cache performance 