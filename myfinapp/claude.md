# MyFinApp — Claude Context

## What this app does
S&P 500 / NASDAQ investment-opportunity finder. It pulls recent earnings, calculates post-earnings price moves, ranks gainers/losers, and optionally scores them as "buy" candidates using insider flows, valuation, analyst sentiment, and GPT-powered analysis.

## How to run
```sh
npm start          # production (node server.js, port 3000)
npm run dev        # nodemon + webpack watch
npm run build      # webpack production bundle
npm run start:local # sets GOOGLE_APPLICATION_CREDENTIALS before starting
```

## Environment variables (all in `.env`)
| Variable | Purpose |
|---|---|
| `FMP_API_KEY` | Financial Modeling Prep — primary quote & profile source |
| `FINNHUB_API_KEY` | Finnhub — earnings calendar + insider transactions + quote fallback |
| `ALPHA_VANTAGE_API_KEY` | Alpha Vantage — historical prices + valuation fallback |
| `OPENAI_API_KEY` | OpenAI — GPT-powered Buy/Hold/Sell analysis |
| `GCS_BUCKET` | Google Cloud Storage bucket name for persistent cache (optional) |
| `LOG_LEVEL` | Logging verbosity: DEBUG / INFO / WARN / ERROR (default: INFO) |

`gcs-key.json` in the project root provides GCS credentials; set via `GOOGLE_APPLICATION_CREDENTIALS`.

## Directory layout
```
server.js                 Express entry point (port 3000)
index.js                  Standalone batch-test script (not the server)
routes/index.js           All HTTP route handlers
services/                 Business logic (see below)
config/                   API clients & index definitions
utils/                    logger, cache, server-side HTML renderer
client/                   React SPA source (bundled by webpack → public/js/)
public/                   Static assets served by Express
```

### services/ — one file per concern
| File | Responsibility |
|---|---|
| `stockDataProvider.js` | Unified data layer. Batch quotes (FMP → Finnhub fallback), historical prices (Alpha Vantage), market caps. Owns the in-memory L1 cache. |
| `opportunities.js` | Core product logic: fetches earnings, joins with quotes/history, ranks movers. |
| `earnings.js` | Earnings-calendar fetch (Finnhub), cached 3 days. |
| `tickers.js` | S&P 500 tickers from Wikipedia; NASDAQ from trader site. Cached 30 days. |
| `buyOpportunity.js` | Scores stocks on 4 criteria (price drop >7 %, insider buying, undervalued, bullish analysts). 3/4 = Strong Buy. |
| `aiAnalysis.js` | Calls `gpt-4o-mini` for Buy/Hold/Sell. Validates input, parses structured response. |
| `valuation.js` | P/E vs industry average via FMP; Alpha Vantage fallback; hard-coded sector averages as last resort. |
| `insiderTrading.js` | 3-month insider transactions from Finnhub; calculates net buy/sell signal. |
| `analystSentiment.js` | FMP analyst recommendations + price targets; calculates upside %. |
| `historical.js` | Thin wrapper → stockDataProvider (kept for backward compat). |
| `marketCap.js` | Thin wrapper → stockDataProvider (kept for backward compat). |

### config/
| File | Role |
|---|---|
| `fmpApiClient.js` | Axios wrapper for FMP. Tracks daily call count (free-tier limit: 250/day), adds 50 ms delay between calls, warns at 80 %, stops at 95 %. |
| `indices.js` | Factory for S&P 500 and NASDAQ ticker lists + market-cap thresholds. |

## Caching — two tiers
1. **L1 — in-memory** (inside `stockDataProvider`): process-scoped, lost on restart.
2. **L2 — GCS** (`utils/cache.js`): survives restarts. Disabled gracefully when `GCS_BUCKET` is unset.

TTLs: quotes 4 h, historical 24 h, earnings 3 d, tickers 30 d.

## API fallback chain
```
Quotes:      FMP  →  Finnhub
Valuation:   FMP  →  Alpha Vantage  →  hard-coded sector averages
Historical:  Alpha Vantage (cached)
Earnings:    Finnhub
Insider:     Finnhub
Analysts:    FMP
```

## HTTP endpoints
| Method | Path | Notes |
|---|---|---|
| GET | `/` | S&P 500 opportunities — returns HTML or JSON depending on `Accept` header |
| GET | `/nasdaq` | Same as `/` but NASDAQ. Accepts `?start=YYYY-MM-DD` |
| GET | `/app` | React SPA entry point |
| GET | `/buy-opportunities` | JSON: buy-opportunity analysis |
| POST | `/api/ai-analysis` | JSON body with stock data → GPT recommendation |

Both `/` and `/nasdaq` accept `?buyAnalysis=true` to include buy-opportunity scoring.

## Logging conventions
Every service creates its own logger via `const log = createLogger('CATEGORY')`. Use the domain-specific helpers rather than plain `log.info`:
- `log.apiCall(name, params)` / `log.apiResult(name, result)`
- `log.cacheHit(key)` / `log.cacheMiss(key)` / `log.cacheWrite(key)`
- `log.flowStart(name)` / `log.flowEnd(name, ms)`
- `log.stockAnalysis(ticker, data)`

## Key constraints & gotchas
- **FMP free tier is 250 calls/day.** The batch quote endpoint (`symbol=A,B,C`) returns 402 on the free plan — quotes are fetched individually with the 50 ms delay enforced by `fmpApiClient`.
- **Wikipedia S&P 500 scraping** requires a proper `User-Agent` header (set in `config/indices.js`); without it you get 403.
- **`index.js` is NOT the server.** It is a standalone batch-test script. The server is `server.js`.
- **`historical.js` and `marketCap.js`** are thin backward-compat wrappers; new code should call `stockDataProvider` directly.
- The README references Yahoo Finance and `gpt-3.5-turbo` — both are outdated. The current stack uses FMP/Alpha Vantage/Finnhub and `gpt-4o-mini`.
