#!/usr/bin/env python3
"""
Fetch comprehensive financial data for electricity value chain analysis.
Primary: Finnhub (metrics, profile, financials)
Supplemental: Alpha Vantage (company overview with EPS, revenue growth)
"""

import json
import time
import requests
from datetime import datetime
from pathlib import Path

FINNHUB_KEY = "d0gfql9r01qhao4tdc6gd0gfql9r01qhao4tdc70"
AV_KEY = "VSDTMRAUFUJPBUP0"

OUTPUT_DIR = Path("/data/.openclaw/workspace/research/data")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

COMPANIES = {
    "GEV":   "GE Vernova",
    "SMNEY": "Siemens Energy",
    "ETN":   "Eaton",
    "ABB":   "ABB",
    "SBGSY": "Schneider Electric",
    "PWR":   "Quanta Services",
    "VRT":   "Vertiv",
    "CEG":   "Constellation Energy",
    "VST":   "Vistra",
    "NEE":   "NextEra Energy",
    "DUK":   "Duke Energy",
    "EQIX":  "Equinix",
    "DLR":   "Digital Realty",
    "LNG":   "Cheniere Energy",
    "EQT":   "EQT Corporation",
    "CCJ":   "Cameco",
    "TSLA":  "Tesla (Energy segment)",
    "FLNC":  "Fluence Energy",
}

def fh(endpoint, params=None):
    p = {"token": FINNHUB_KEY}
    if params:
        p.update(params)
    try:
        r = requests.get(f"https://finnhub.io/api/v1/{endpoint}", params=p, timeout=15)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"  Finnhub error [{endpoint}]: {e}")
        return None

def av(function, params=None):
    p = {"function": function, "apikey": AV_KEY}
    if params:
        p.update(params)
    try:
        r = requests.get("https://www.alphavantage.co/query", params=p, timeout=20)
        r.raise_for_status()
        d = r.json()
        if "Note" in d or "Information" in d:
            print(f"  AV rate limit: {d.get('Note') or d.get('Information')}")
            return None
        return d
    except Exception as e:
        print(f"  AV error [{function}]: {e}")
        return None

def fetch_company(ticker, name):
    print(f"\n{'='*60}")
    print(f"  {name} ({ticker})")
    print(f"{'='*60}")

    data = {"ticker": ticker, "name": name, "fetched_at": datetime.now().isoformat()}

    # Finnhub: quote
    print(f"  quote...")
    data["quote"] = fh("quote", {"symbol": ticker})
    time.sleep(0.4)

    # Finnhub: company profile
    print(f"  profile...")
    data["profile"] = fh("stock/profile2", {"symbol": ticker})
    time.sleep(0.4)

    # Finnhub: all key metrics
    print(f"  key metrics...")
    data["metrics"] = fh("stock/metric", {"symbol": ticker, "metric": "all"})
    time.sleep(0.4)

    # Finnhub: basic financials (income, balance)
    print(f"  financials annual...")
    data["financials_reported"] = fh("stock/financials", {"symbol": ticker, "statement": "ic", "freq": "annual"})
    time.sleep(0.4)

    # Finnhub: recommendation trends
    print(f"  analyst recommendations...")
    data["recommendations"] = fh("stock/recommendation", {"symbol": ticker})
    time.sleep(0.4)

    # Finnhub: earnings surprise
    print(f"  earnings history...")
    data["earnings"] = fh("stock/earnings", {"symbol": ticker, "limit": 8})
    time.sleep(0.4)

    # Finnhub: price target
    print(f"  price targets...")
    data["price_target"] = fh("stock/price-target", {"symbol": ticker})
    time.sleep(0.4)

    # Alpha Vantage: company overview (PE, EPS, revenue, margins, 52wk, etc.)
    print(f"  AV overview...")
    data["av_overview"] = av("OVERVIEW", {"symbol": ticker})
    time.sleep(12)  # AV free tier: 5 calls/min → 12s gap

    out = OUTPUT_DIR / f"{ticker}.json"
    with open(out, "w") as f:
        json.dump(data, f, indent=2, default=str)
    print(f"  ✅ Saved: {out.name}")
    return data


def summarize_all():
    rows = []
    for ticker in COMPANIES:
        path = OUTPUT_DIR / f"{ticker}.json"
        if not path.exists():
            continue
        with open(path) as f:
            d = json.load(f)

        m = (d.get("metrics") or {}).get("metric") or {}
        profile = d.get("profile") or {}
        av_ov = d.get("av_overview") or {}
        quote = d.get("quote") or {}
        pt = d.get("price_target") or {}

        price = quote.get("c") or profile.get("sharePrice") or 0
        mktcap_M = m.get("marketCapitalization") or 0

        rows.append({
            "ticker": ticker,
            "name": d.get("name"),
            "price": round(float(price), 2),
            "market_cap_B": round(mktcap_M / 1000, 1) if mktcap_M else None,
            "sector": profile.get("finnhubIndustry") or av_ov.get("Sector"),
            "pe_ttm": m.get("peExclExtraTTM") or m.get("peInclExtraTTM"),
            "forward_pe": m.get("forwardPE"),
            "ev_ebitda_ttm": m.get("evEbitdaTTM"),
            "ev_revenue_ttm": m.get("evRevenueTTM"),
            "gross_margin_ttm_pct": m.get("grossMarginTTM"),
            "operating_margin_ttm_pct": m.get("operatingMarginTTM"),
            "net_margin_ttm_pct": m.get("netProfitMarginTTM"),
            "roe_ttm_pct": m.get("roeTTM"),
            "52w_return_pct": m.get("52WeekPriceReturnDaily"),
            "beta": m.get("beta"),
            "eps_ttm": m.get("epsTTM"),
            "eps_growth_ttm_yoy_pct": m.get("epsGrowthTTMYoy"),
            "revenue_growth_3y": av_ov.get("RevenueGrowthYOY"),
            "dividend_yield": m.get("dividendYieldIndicatedAnnual"),
            "debt_equity": m.get("longTermDebt/equityAnnual"),
            "price_target_mean": pt.get("targetMean"),
            "price_target_high": pt.get("targetHigh"),
            "price_target_low": pt.get("targetLow"),
        })

    summary_path = OUTPUT_DIR / "_summary.json"
    with open(summary_path, "w") as f:
        json.dump(rows, f, indent=2)
    print(f"\n📊 Summary → {summary_path}")
    return rows


def print_table(rows):
    print(f"\n{'Ticker':<7} {'Name':<28} {'Price':>7} {'MCap$B':>7} {'P/E':>6} {'FwdPE':>6} "
          f"{'EV/EBITDA':>9} {'OPM%':>6} {'EPS Gr%':>8} {'52w%':>6}")
    print("-" * 100)
    for r in rows:
        print(
            f"{r['ticker']:<7} {(r['name'] or '')[:27]:<28} "
            f"{(r['price'] or 0):>7.1f} {(r['market_cap_B'] or 0):>7.1f} "
            f"{(r['pe_ttm'] or 0):>6.1f} {(r['forward_pe'] or 0):>6.1f} "
            f"{(r['ev_ebitda_ttm'] or 0):>9.1f} {(r['operating_margin_ttm_pct'] or 0):>6.1f} "
            f"{(r['eps_growth_ttm_yoy_pct'] or 0):>8.1f} {(r['52w_return_pct'] or 0):>6.1f}"
        )


def main():
    print(f"🔍 Fetching data for {len(COMPANIES)} companies")
    print(f"📁 {OUTPUT_DIR}")
    print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("Note: AV free tier = 5 req/min → ~12s pause per company\n")

    for ticker, name in COMPANIES.items():
        out = OUTPUT_DIR / f"{ticker}.json"
        if out.exists():
            print(f"  ⏭️  {ticker} already cached, skipping")
            continue
        fetch_company(ticker, name)
        print(f"  ⏳ 3s cooldown...")
        time.sleep(3)

    print("\n\n📊 Building summary...")
    rows = summarize_all()
    print_table(rows)
    print("\n✅ Done!")

if __name__ == "__main__":
    main()
