# Handoff: Invest Coach — beginner-friendly investing app

## Overview

Invest Coach helps **retail beginners** find investment opportunities using 5 transparent, plain-English strategies. The app recommends stocks (does not execute trades — it links out to a broker), explains *why* in human language, and lets users trace every recommendation back to the underlying data sources.

This handoff contains **4 wireframe directions** exploring different UX approaches. The team should pick one (or combine A+C) before full build.

---

## About the design files

The files under `prototypes/` are **design references created in HTML** — sketchy, hand-drawn-style wireframes that show layout, hierarchy, copy, and interaction intent. **They are not production code to copy.** Recreate them in the target codebase's existing environment (React Native / Swift / Kotlin for mobile, React/Vue for web) using that project's established component library, design tokens, and patterns.

If no codebase exists yet, we recommend:
- **Mobile:** React Native + Expo (shares logic with web), or native SwiftUI/Jetpack if iOS/Android-first.
- **Web:** Next.js + a component library (shadcn/ui or the company's existing system).

## Fidelity

**Low-fidelity (wireframes).** Use these for:
- Screen structure, content hierarchy, and copy
- What data appears where
- Which strategy/filter controls exist and where they go
- The 5 strategies and their logic (defined below)

**Do NOT** copy the sketchy hand-drawn styling (Kalam/Caveat fonts, wobbly borders, highlighter marks). Apply your real visual design system.

---

## The 5 investment strategies (core product logic)

Each strategy is a rule-based filter over market data. AI (Aria) summarizes the *why* for each match in plain English.

| # | Strategy | Plain-English hook | Rule logic (v1) | Risk | Data sources |
|---|----------|-------------------|-----------------|------|--------------|
| 1 | **Bounce-Back** | Good company, bad quarter | 5-yr revenue CAGR > 8%, latest Q missed EPS, price down >15% in 60d, debt/equity < 1 | Medium | Q reports, Price history, News |
| 2 | **Market Dip** | Whole market pushed down by external shock | Index down >10% in 30d OR major geopolitical event flag, stock's beta-adjusted drawdown > sector avg, analyst fair value > current price × 1.15 | Med-High | News, Price history, Analyst |
| 3 | **Undervalued** | Cheap by the numbers | P/E < sector median × 0.7, P/B < 2, positive FCF growth 3yr, revenue growth > 5% | Low-Med | Q reports, Analyst |
| 4 | **Steady Dividend** | Reliable income | 20+ yrs of dividend growth, payout ratio < 75%, debt/equity < 0.8, yield > 2% | Low | Q reports, Price history |
| 5 | **Analyst Upgrade** | Multiple pros are buying | 3+ analysts raised price targets in last 30d, avg target > current price × 1.10, no downgrades | Medium | Analyst, News |

Each match produces a **fit score (0–100)** combining: rule-match strength × user risk profile alignment × data freshness.
Each match also produces an **upside %** estimate from analyst avg price target or historical recovery pattern.

---

## Directions explored

### Direction A — Opportunity-first mobile (RECOMMENDED)
**Main view = ranked list of stocks by upside %.** Strategy is a secondary filter chip.
Screens: Home (ranked opportunities) → Strategy filter (picks + logic blurb) → Stock detail (chart, Aria's "why", fit score, target, time horizon, CTA to broker).

### Direction B — Daily opportunity feed
News-app format. Aria's "pick of the day" hero card + curated queue. Strategy shown as a small tag on each card. Habit-forming but risks encouraging over-trading.

### Direction C — AI coach chat
Aria chat interface. Stocks embedded as rich cards inside messages. Best for true beginners — Aria starts the conversation. **Consider as onboarding layer that graduates to A.**

### Direction D — Web dashboard
All 5 strategies scanned side-by-side. 3 strategy cards on top + full table below. Aria summary panel on the right. Inline Aria reasoning on every strategy card AND every stock row. For returning/power users.

---

## Screens — detail

### A1 · Home (Opportunity-first)
- **Header:** "Best opportunities today" (h1). Subtitle: `Sorted by expected upside · Matched to your [risk] profile`.
- **Filter row:** Horizontally scrollable chips — `All · N` (active/dark), then one per strategy, then `More` filter icon.
- **Ranked cards:** For each stock, sorted by upside DESC:
  - Rank badge (#1 circle filled brand-blue, others outlined)
  - Ticker monogram (initials)
  - Stock title: `TICKER · Full Name`, subtitle: `$price · ±% today`
  - **Upside % — hero metric, right-aligned, large bold green**
  - Aria reasoning box: dashed blue border, `✦ Aria: <one-sentence why>`
  - Footer row: strategy tag, 30d sparkline, fit score (`fit 87`), chevron right
- **Bottom tab bar:** Home (active), Ideas, Watch, Learn, Me

### A2 · Strategy filter view
Same ranked list but filtered to one strategy. Top shows a light-blue hero card explaining the strategy's logic in plain English + which data sources feed it.

### A3 · Stock detail
- Price + % change + strategy tag
- 30d chart with fair-value reference line (dashed)
- **"Why Aria picked this"** card: 4 checkmarked bullets, one per enabled data source (Q reports / Price / Analyst / News)
- 3-stat row: Fit score, Target price + upside, Time horizon
- Primary CTA: `Buy on my broker →` (links out — we don't execute)

### D · Web dashboard
- Sidebar: logo, strategy list (highlighted = active filter), risk tag, nav links
- Header: "Opportunity scan" + Filter button
- 3 strategy cards — each shows strategy name, plain-English logic, Aria's top pick summary (dashed blue box), then its stock rows with inline Aria reasoning
- Main table: Stock · Strategy · Price · 30d · Fit · Why — sorted by fit, 6+ rows
- Aria side panel: summary of best overall / safest / most upside + "heads up" macro callout
- Footer: "Scanning:" + tags for each active data source

---

## Data model (v1)

```ts
type Strategy = {
  id: 'bounce' | 'dip' | 'value' | 'dividend' | 'upgrade';
  name: string;
  hook: string;          // plain-English one-liner
  logic: string;         // beginner explanation
  risk: 'low' | 'low-med' | 'medium' | 'medium-high';
  sources: Array<'Q reports' | 'Price history' | 'Analyst' | 'News'>;
};

type Stock = {
  ticker: string;
  name: string;
  price: number;
  change24h: number;
  sparkline30d: number[];
};

type Recommendation = {
  stock: Stock;
  strategyId: Strategy['id'];
  fitScore: number;         // 0–100
  upsidePct: number;        // estimated
  targetPrice: number;
  horizon: '1-3m' | '3-6m' | '6-12m' | '12m+';
  whySummary: string;       // 1–2 sentences, Aria-generated
  whyBreakdown: {           // one entry per enabled data source
    source: 'Q reports' | 'Price history' | 'Analyst' | 'News';
    fact: string;           // e.g. "Revenue +18% YoY"
    sentiment: 'positive' | 'neutral' | 'negative';
  }[];
};

type UserProfile = {
  riskLevel: 'conservative' | 'balanced' | 'aggressive';
  enabledSources: Array<'Q reports' | 'Price history' | 'Analyst' | 'News'>;
  watchlist: string[]; // tickers
};
```

---

## Interactions & behavior

- **Ranking:** Recompute on risk change or source toggle — should feel instant, debounce 150ms.
- **Strategy filter chips:** Single-select, tap "All" to clear.
- **Stock card tap:** Push to stock detail.
- **Buy CTA on stock detail:** Opens external URL to user's configured broker (eToro, IBKR, etc.) with ticker prefilled where possible.
- **Aria reasoning boxes:** Tap expands to show the 4-source breakdown.
- **Watchlist:** Star icon on stock detail toggles watchlist membership.
- **Risk level + data sources:** Live in Settings / Me tab. Changes persist.

## State management
- User profile (risk, sources, watchlist) → persistent store (local + synced)
- Recommendation feed → server-computed, cached 15 min, pulled on app open + pull-to-refresh
- No in-app portfolio for v1 (recommend-only product)

---

## Accessibility & compliance

- Every recommendation must show **time horizon** and **risk level** near the CTA.
- Disclosure: "Not financial advice. Links out to your broker. Past performance doesn't guarantee future results." — persistent in Me/Settings.
- All stocks in the recommendation feed must be sorted deterministically for the same inputs (reproducibility).
- Log every recommendation surfaced to the user (for audit).

---

## Files in this bundle

- `prototypes/Invest Coach Wireframes.html` — main entry, 4 directions on a design canvas
- `prototypes/sketchy.css` — hand-drawn wireframe styles (do not ship)
- `prototypes/wireframe-components.jsx` — strategies + stock seed data (reuse the data)
- `prototypes/direction-a.jsx` — opportunity-first mobile (recommended)
- `prototypes/direction-b.jsx` — daily feed
- `prototypes/direction-c.jsx` — AI coach chat
- `prototypes/direction-d.jsx` — web dashboard
- `prototypes/phone-frame.jsx`, `design-canvas.jsx` — wireframe scaffolding

## Open questions for the dev team

1. Which direction ships as v1? (Recommendation: **A** for mobile, **D** for web, **C** as onboarding.)
2. Which data providers? (e.g. Polygon.io, Finnhub, Alpha Vantage, Benzinga for analyst data)
3. LLM provider for Aria summaries? Streaming vs pre-computed?
4. Regional markets — US only for v1, or also EU/IL?
5. Broker deep-link partners for the "Buy" CTA.
