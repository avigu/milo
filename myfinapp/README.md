# MyFinApp

A modern financial platform that highlights S&P 500 & NASDAQ investment opportunities based on recent earnings reports. Features a classic server-side rendered web UI, a modern React client, and a native mobile app with AI-powered stock analysis.

## Platforms Available
- **🖥️ Web App**: Classic server-side rendered UI and modern React client
- **📱 Mobile App**: Native iOS and Android app built with React Native

## Features
- **Multiple Interface Options:**
  - 🖥️ Classic server-side rendered UI at `/` 
  - ⚛️ Modern React client at `/app`
  - 📱 Native mobile app in `/mobileapp` directory
- **🤖 AI-Powered Analysis**: Get second opinions on stocks with OpenAI-powered recommendations
- Lists top 5 S&P 500/NASDAQ gainers and losers after earnings
- Real-time earnings calendar with upcoming reports
- Mobile responsive design with modern UI components
- Date selector to view historical earnings
- Interactive tabs for different data views
- Summary statistics and market insights
- PWA support for mobile installation

## Quick Start

### Web Application
1. Clone the repository:
   ```sh
   git clone https://github.com/avigu/myfinapp.git
   cd myfinapp
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Build the React client:
   ```sh
   npm run build
   ```
4. Create a `.env` file with your API keys:
   ```env
   FINNHUB_API_KEY=your_finnhub_api_key
   OPENAI_API_KEY=your_openai_api_key_here
   GCS_BUCKET=your_gcs_bucket_name_optional
   ```
   Note: 
   - The Finnhub API key is optional (a default is provided)
   - The OpenAI API key is required for AI analysis features
   - The GCS_BUCKET is optional for caching. If not provided, caching will be disabled and the app will work without Google Cloud Storage
   - If using Google Cloud Storage, place your service account key file as `gcs-key.json` in the project root
5. Start the server:
   ```sh
   npm start
   ```
   The start command automatically sets up Google Cloud credentials if the `gcs-key.json` file exists.
6. Access the app:
   - **Classic UI**: [http://localhost:3000](http://localhost:3000)
   - **React Client**: [http://localhost:3000/app](http://localhost:3000/app)

### Mobile App
1. Navigate to the mobile app directory:
   ```sh
   cd mobileapp
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Start the mobile app:
   ```sh
   npm start
   ```
4. Use Expo Go app on your device to scan the QR code, or run in simulator:
   ```sh
   npm run ios    # iOS simulator
   npm run android # Android emulator
   ```

For detailed mobile app setup instructions, see [mobileapp/README.md](./mobileapp/README.md).

## Development
For development with hot reload:
```sh
npm run dev
```
This will start the server with nodemon and build the React client in watch mode. Google Cloud credentials are automatically configured if the `gcs-key.json` file exists.

## Project Structure
```
myfinapp/
├── server.js              # Express server
├── routes/
│   └── index.js           # API routes (serves both HTML and JSON)
├── services/
│   ├── opportunities.js   # Business logic for fetching financial data
│   ├── aiAnalysis.js      # AI-powered stock analysis service
│   ├── buyOpportunity.js  # Buy opportunity analysis
│   ├── earnings.js        # Earnings data service
│   ├── marketCap.js       # Market cap calculations
│   ├── tickers.js         # Stock ticker utilities
│   ├── historical.js      # Historical data service
│   ├── insiderTrading.js  # Insider trading analysis
│   ├── valuation.js       # Stock valuation service
│   └── analystSentiment.js # Analyst sentiment analysis
├── utils/
│   ├── cache.js          # Caching utilities
│   └── render.js         # Server-side HTML rendering
├── client/               # React web application
│   ├── src/
│   │   ├── App.js        # Main React component
│   │   ├── index.js      # React entry point
│   │   ├── components/   # React components
│   │   │   ├── StockCard.js
│   │   │   ├── IndexSelector.js
│   │   │   ├── DateSelector.js
│   │   │   ├── EarningsCalendar.js
│   │   │   └── LoadingSpinner.js
│   │   └── styles/
│   │       └── App.css   # Modern CSS styles
├── mobileapp/            # React Native mobile application
│   ├── App.js           # Main mobile app component
│   ├── src/
│   │   ├── components/   # Mobile components
│   │   ├── screens/      # App screens
│   │   ├── services/     # API services
│   │   └── constants/    # Design system
│   └── README.md        # Mobile app documentation
├── public/
│   ├── app.html          # React app entry point
│   ├── js/               # Built React bundle
│   └── manifest.json     # PWA manifest
└── webpack.config.js     # Build configuration
```

## API Endpoints
- `GET /` - S&P 500 data (HTML or JSON based on Accept header)
- `GET /nasdaq` - NASDAQ data (HTML or JSON based on Accept header)
- `GET /app` - React client application
- `POST /api/ai-analysis` - AI-powered stock analysis using OpenAI

## Technologies
- **Backend**: Node.js, Express
- **Web Frontend**: React 18, Modern ES6+
- **Mobile Frontend**: React Native with Expo
- **Build**: Webpack, Babel
- **Styling**: Modern CSS with CSS Variables, React Native StyleSheet
- **Data Sources**: Yahoo Finance, Finnhub API
- **AI Analysis**: OpenAI GPT-3.5-turbo
- **Caching**: Google Cloud Storage

## AI Analysis Service

The AI analysis feature is powered by a dedicated service (`services/aiAnalysis.js`) that provides:

### Features
- **Stock Analysis**: AI-powered investment recommendations (Buy/Hold/Sell)
- **Data Validation**: Input validation and error handling
- **Error Management**: Comprehensive error handling for API issues
- **Response Parsing**: Structured parsing of AI responses

### Service Functions
- `analyzeStock(stockData)` - Main analysis function
- `validateStockData(stockData)` - Input validation
- `buildAnalysisPrompt(data)` - Prompt generation
- `parseAIResponse(response)` - Response parsing

### Error Handling
The service handles various error scenarios:
- Missing or invalid API keys
- Rate limiting and quota exceeded
- Network and API failures
- Invalid input data

### Usage Example
```javascript
const { analyzeStock } = require('./services/aiAnalysis');

const stockData = {
  ticker: 'AAPL',
  priceMovement: '-5.20',
  insiderBuys: '2.5',
  insiderSells: '1.2',
  peRatio: '25.4',
  industryPE: '22.1',
  analystRatings: { buy: 12, hold: 3, sell: 1 },
  priceTarget: '185.50',
  currentPrice: '175.25'
};

const analysis = await analyzeStock(stockData);
// Returns: { status: 'Hold', reason: '...', timestamp: '...', model: 'gpt-3.5-turbo' }
```

## License
ISC 