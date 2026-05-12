# MyFinApp — Project State

> Living doc. Update at end of each session. Last update: 2026-05-05 morning.

## Where we are

- **Active branch:** `feature/bulk-prices-local-cache` in `/data/.openclaw/workspace/myfinapp/`
- **Status:** all work uncommitted. 9 files modified, ~426 added / 37,322 deleted (the deletions are from the auto-built `public/js/app.bundle.js`, not real source).
- **Last actual git commit:** `739a75f Add claude.md with project context for Claude Code` (older).
- **Next-gen design (FinApp/Invest Coach):** PRD + wireframes only. Not coded yet.

## What changed yesterday (2026-05-04) — reconstructed from diff

Goal of the branch: **make data fetching cheap & reliable** by pre-filtering on cached market caps and switching the quote source.

### 1. Quote provider: FMP → Finnhub
File: `services/stockDataProvider.js`
- Dropped `fmpClient.getQuotes()`.
- New path: Finnhub `/quote` in parallel chunks.
- Constants: `FINNHUB_CONCURRENCY = 10`, `FINNHUB_INTER_CHUNK_MS = 200` (stays under 60/min free tier).
- Quote cache TTL still 4h.

### 2. New marketCap service (own cache, weekly TTL)
File: `services/marketCap.js` — was a thin wrapper, now ~195 lines of real logic.
- Source: Finnhub `/stock/profile2`.
- Per-ticker TTL: 7 days. Persistent cache key: `marketcap-all`.
- Cold-start pacing: `FETCH_CONCURRENCY = 5`, `INTER_CHUNK_MS = 1100` (~5 calls/sec).
- Has `recordMarketCap[s]()` so other flows can piggy-back observed values for free.
- Debounced flush to persistent cache.

### 3. Pre-filter by market cap before fetching quotes
File: `services/opportunities.js`
- Order changed: earnings → `getBatchMarketCaps(allTickers)` → drop sub-threshold → only then fetch quotes for survivors.
- Big win: avoids paying for quotes on names we'd discard anyway.

### 4. Local FS cache fallback
File: `utils/cache.js`
- Two-tier persistent cache: GCS (when configured) + local FS fallback.
- Local dir: `LOCAL_CACHE_DIR` env, default `<repo>/.data/cache` (gitignored).
- Functions: `readLocalTimestamped`, `writeLocalTimestamped`, `readLocalRaw`, `writeLocalRaw`.

### 5. Misc
- `routes/index.js` — small change (haven't read).
- `MAIN_FLOW_AND_ISSUES.md` — planning/audit doc, untracked.
- `.env.example` — added (untracked).

## Open questions / unverified

- [ ] Did Avi actually run this yesterday? Branch hasn't been committed — could mean WIP or could mean tested-and-not-yet-pushed.
- [ ] Local FS cache path uses `__dirname/../.data/cache`. Confirm `.data/` is in `.gitignore` (it is — verified).
- [ ] `services/marketCap.js` was previously a thin wrapper to `stockDataProvider`. Anything still importing the old API surface?
- [ ] Finnhub free tier quota — are we comfortable hammering it for ~500 quote fetches per refresh?

## What's planned (need Avi to confirm)

- [ ] **Tiingo integration** — Avi has an API key. Per `FinApp/API & Cost Plan.html` Tiingo is the planned source for **long historical prices (10–30y)** to feed the Bounce-Back & Dividend scorers in Invest Coach. Not wired yet.
- [ ] Commit the branch once tested.
- [ ] (from `MAIN_FLOW_AND_ISSUES.md`) docs/code drift cleanup, ticker validation regex (BRK.B), logger normalization in `aiAnalysis.js`.

## Things I do NOT remember (Avi to fill in)

- What was the original trigger for the bulk-prices branch? Cost? 429s? Both?
- Did anything break when testing?
- What's the plan for tomorrow specifically?
- Is Tiingo for myfinapp/ now or for FinApp/Invest Coach later?
