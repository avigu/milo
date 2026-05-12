# Buy Opportunities Analysis Feature

This document describes the new buy opportunity analysis feature that identifies potential buying opportunities for stocks that dropped more than 7% after earnings.

## Overview

The buy opportunity analysis combines multiple data sources to evaluate whether a stock that has dropped significantly after earnings might be a good buying opportunity. The analysis considers four key criteria:

1. **Price Drop >7%**: Stock must have dropped more than 7% after earnings
2. **Insider Buying Activity**: Recent insider transactions show more buying than selling
3. **Undervalued P/E Ratio**: Company's P/E ratio is at least 20% lower than industry average
4. **Positive Analyst Sentiment**: More analyst buy ratings than hold/sell ratings

## API Keys Required

To use the buy opportunity analysis features, you'll need API keys from the following services:

### 1. Finnhub API (for insider trading data)
- **Website**: https://finnhub.io/
- **Free tier**: 60 API calls/minute
- **Used for**: Insider transaction data (last 3 months)
- **Environment variable**: `FINNHUB_API_KEY`

### 2. Financial Modeling Prep API (for valuation and analyst data)
- **Website**: https://financialmodelingprep.com/
- **Free tier**: 250 API calls/day
- **Used for**: P/E ratios, sector data, analyst recommendations, price targets
- **Environment variable**: `FMP_API_KEY`

### 3. Alpha Vantage API (fallback for valuation data)
- **Website**: https://www.alphavantage.co/
- **Free tier**: 25 API calls/day
- **Used for**: Fallback P/E ratio data
- **Environment variable**: `ALPHA_VANTAGE_API_KEY`

## Setup Instructions

1. **Get API Keys**: Sign up for free accounts at the above services and get your API keys.

2. **Set Environment Variables**: Create a `.env` file in the project root with your API keys:
   ```
   FINNHUB_API_KEY=your_finnhub_api_key_here
   FMP_API_KEY=your_fmp_api_key_here
   ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key_here
   ```

3. **Install Dependencies**: The new feature requires the `moment` package for date handling:
   ```bash
   npm install moment --legacy-peer-deps
   ```

4. **Start the Application**:
   ```bash
   npm run dev
   ```

## How It Works

### 1. Stock Filtering
The system first identifies stocks that have dropped more than 7% after their earnings announcement.

### 2. Data Collection
For each qualifying stock, the system fetches:
- **Insider transactions** from the last 3 months (Finnhub API)
- **Company P/E ratio** and sector information (FMP API)
- **Industry peer P/E ratios** for comparison (FMP API)
- **Analyst recommendations** and price targets (FMP API)

### 3. Analysis Criteria
Each stock is evaluated against four criteria:

#### Criterion 1: Price Drop >7%
- ✅ **Met**: Stock dropped more than 7% after earnings
- ❌ **Not Met**: Stock dropped less than 7%

#### Criterion 2: Insider Buying Activity
- ✅ **Met**: Insider buy value > sell value (with 20% buffer)
- ⚪ **Neutral**: No significant insider activity
- ❌ **Not Met**: Insider sell value > buy value

#### Criterion 3: Undervalued P/E Ratio
- ✅ **Met**: Company P/E < 80% of industry average P/E
- ❌ **Not Met**: Company P/E >= 80% of industry average P/E

#### Criterion 4: Positive Analyst Sentiment
- ✅ **Met**: >60% of analyst ratings are "Buy" and total buys > holds + sells
- 🟡 **Mixed**: Balanced analyst sentiment
- ❌ **Not Met**: >40% of analyst ratings are "Sell"

### 4. Recommendation Generation
Based on how many criteria are met:
- **Strong Buy** (🟢): 3-4 criteria met
- **Moderate Buy** (🟡): 2 criteria met
- **Avoid** (🔴): 0-1 criteria met

## API Endpoints

### GET `/buy-opportunities`
Returns detailed buy opportunity analysis for stocks that dropped >7%.

**Query Parameters:**
- `index`: Index to analyze (`sp500` or `nasdaq`, default: `sp500`)
- `start`: Start date for analysis (YYYY-MM-DD format, default: today)

**Response:**
```json
{
  "indexKey": "sp500",
  "startDate": "2024-01-15",
  "buyOpportunities": [
    {
      "ticker": "AAPL",
      "originalStock": {
        "ticker": "AAPL",
        "change": -8.5,
        "priceBeforeEarnings": 150.00,
        "priceNow": 137.25,
        "marketCap": 2500000000000,
        "earningsDate": "2024-01-15"
      },
      "insiderData": {
        "totalBuys": 10000,
        "totalSells": 5000,
        "buyValue": 1500000,
        "sellValue": 750000,
        "signal": "🟢"
      },
      "valuationData": {
        "companyPE": 18.5,
        "industryPE": 25.2,
        "isUndervalued": true,
        "sector": "Technology"
      },
      "analystData": {
        "ratings": { "buy": 15, "hold": 3, "sell": 1 },
        "averagePriceTarget": 165.00,
        "upsidePotential": 20.2,
        "sentiment": "🟢",
        "isPositive": true
      },
      "criteria": {
        "droppedOver7Percent": true,
        "insiderBuying": true,
        "undervalued": true,
        "positiveAnalystSentiment": true
      },
      "criteriaMetCount": 4,
      "isBuyOpportunity": true,
      "recommendation": "Strong Buy",
      "recommendationColor": "🟢"
    }
  ],
  "totalAnalyzed": 25,
  "droppedStocks": 5
}
```

### GET `/` or `/nasdaq` with `buyAnalysis=true`
Returns regular stock data plus buy opportunity analysis.

**Query Parameters:**
- `start`: Start date for analysis (YYYY-MM-DD format)
- `buyAnalysis`: Set to `true` to include buy opportunity analysis

## Frontend Features

### Buy Opportunities Tab
A new tab in the React app displays buy opportunities with:
- **Recommendation badges** (Strong Buy, Moderate Buy, Avoid)
- **Criteria indicators** showing which criteria are met
- **Quick stats** including market cap and upside potential
- **Detailed analysis** with expandable sections for:
  - Insider trading data (3 months)
  - Valuation analysis (P/E comparison)
  - Analyst sentiment (ratings and price targets)

### Loading States
The buy opportunity analysis can take time due to multiple API calls, so the UI shows:
- Loading spinner during analysis
- Progress indication
- Graceful error handling

## Rate Limiting Considerations

The buy opportunity analysis makes multiple API calls per stock:
- 3-4 calls to Finnhub (insider data)
- 3-4 calls to FMP (valuation, analyst data)
- 1 call to Alpha Vantage (fallback)

To prevent rate limiting:
- Analysis is limited to 10 stocks maximum
- 500ms delay between stock analyses
- Fallback APIs are used when primary APIs fail
- Parallel API calls are used where possible

## Error Handling

The system gracefully handles:
- **API rate limits**: Falls back to alternative APIs
- **Missing data**: Shows "N/A" for unavailable metrics
- **Network errors**: Continues analysis with available data
- **Invalid responses**: Logs errors and continues

## Future Enhancements

Potential improvements for the buy opportunity analysis:
1. **Technical indicators**: Add RSI, moving averages, support/resistance levels
2. **Options flow data**: Include unusual options activity
3. **Social sentiment**: Integrate Reddit, Twitter sentiment analysis
4. **Earnings quality**: Analyze earnings beat/miss and guidance
5. **Sector rotation**: Consider sector performance trends
6. **Risk metrics**: Add volatility and beta analysis 