const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Analyzes stock data using OpenAI and provides investment recommendations
 * @param {Object} stockData - The stock analysis data
 * @param {string} stockData.ticker - Stock ticker symbol
 * @param {string} stockData.priceMovement - Post-earnings price movement percentage
 * @param {string} stockData.insiderBuys - Insider buying activity in millions
 * @param {string} stockData.insiderSells - Insider selling activity in millions
 * @param {string} stockData.peRatio - Company P/E ratio
 * @param {string} stockData.industryPE - Industry average P/E ratio
 * @param {Object} stockData.analystRatings - Analyst ratings breakdown
 * @param {string} stockData.priceTarget - Average analyst price target
 * @param {string} stockData.currentPrice - Current stock price
 * @returns {Promise<Object>} AI analysis result with status and reasoning
 */
async function analyzeStock(stockData) {
  console.log('[AI-SERVICE] === AI Service analyzeStock Started ===');
  console.log('[AI-SERVICE] Input stock data:', JSON.stringify(stockData, null, 2));

  const {
    ticker,
    priceMovement,
    insiderBuys,
    insiderSells,
    peRatio,
    industryPE,
    analystRatings,
    priceTarget,
    currentPrice
  } = stockData;

  if (!ticker) {
    console.error('[AI-SERVICE] Missing ticker in stock data');
    throw new Error('Ticker is required for AI analysis');
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('[AI-SERVICE] OpenAI API key not configured');
    throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY in your environment variables.');
  }

  console.log('[AI-SERVICE] Building analysis prompt...');
  const prompt = buildAnalysisPrompt({
    ticker,
    priceMovement,
    insiderBuys,
    insiderSells,
    peRatio,
    industryPE,
    analystRatings,
    priceTarget,
    currentPrice
  });

  console.log('[AI-SERVICE] Generated prompt:');
  console.log('--- PROMPT START ---');
  console.log(prompt);
  console.log('--- PROMPT END ---');

  try {
    console.log('[AI-SERVICE] Making OpenAI API call...');
    const apiCallStart = Date.now();
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 200,
      temperature: 0.3
    });

    const apiCallEnd = Date.now();
    console.log('[AI-SERVICE] OpenAI API call completed in', (apiCallEnd - apiCallStart), 'ms');
    console.log('[AI-SERVICE] OpenAI response usage:', completion.usage);

    const aiResponse = completion.choices[0].message.content;
    console.log('[AI-SERVICE] Raw AI response:');
    console.log('--- AI RESPONSE START ---');
    console.log(aiResponse);
    console.log('--- AI RESPONSE END ---');
    
    // Parse the response to extract status and reason
    console.log('[AI-SERVICE] Parsing AI response...');
    const parsedResponse = parseAIResponse(aiResponse);
    console.log('[AI-SERVICE] Parsed response:', JSON.stringify(parsedResponse, null, 2));
    
    const finalResult = {
      ...parsedResponse,
      fullResponse: aiResponse,
      timestamp: new Date().toISOString(),
      model: "gpt-4o-mini"
    };

    console.log('[AI-SERVICE] Final result:', JSON.stringify(finalResult, null, 2));
    console.log('[AI-SERVICE] === AI Service analyzeStock Completed Successfully ===');
    
    return finalResult;

  } catch (error) {
    console.error('[AI-SERVICE] === AI Service analyzeStock Failed ===');
    console.error('[AI-SERVICE] OpenAI API call failed:', {
      message: error.message,
      code: error.code,
      type: error.type,
      status: error.status
    });
    
    // Handle specific OpenAI errors
    if (error.code === 'insufficient_quota') {
      console.error('[AI-SERVICE] OpenAI quota exceeded');
      throw new Error('OpenAI API quota exceeded. Please check your billing.');
    } else if (error.code === 'invalid_api_key') {
      console.error('[AI-SERVICE] Invalid OpenAI API key');
      throw new Error('Invalid OpenAI API key. Please check your configuration.');
    } else if (error.code === 'rate_limit_exceeded') {
      console.error('[AI-SERVICE] OpenAI rate limit exceeded');
      throw new Error('OpenAI API rate limit exceeded. Please try again later.');
    }
    
    console.error('[AI-SERVICE] Unknown OpenAI error:', error);
    throw new Error(`AI analysis failed: ${error.message}`);
  }
}

/**
 * Builds the analysis prompt for OpenAI
 * @param {Object} data - Stock data for analysis
 * @returns {string} Formatted prompt
 */
function buildAnalysisPrompt(data) {
  const {
    ticker,
    priceMovement,
    insiderBuys,
    insiderSells,
    peRatio,
    industryPE,
    analystRatings,
    priceTarget,
    currentPrice,
    hasLimitedData
  } = data;

  // Format insider activity
  const insiderActivity = (insiderBuys === 'NaN' || insiderSells === 'NaN' || !insiderBuys || !insiderSells) 
    ? 'N/A' 
    : `$${insiderBuys}M buys, $${insiderSells}M sells`;

  // Format P/E ratio comparison
  const peComparison = (!peRatio || !industryPE || peRatio === 'N/A' || industryPE === 'N/A')
    ? 'N/A'
    : `${peRatio} vs ${industryPE}`;

  // Format analyst ratings
  const analystRatingsText = (!analystRatings || !analystRatings.buy)
    ? 'N/A'
    : `${analystRatings.buy} Buy, ${analystRatings.hold} Hold, ${analystRatings.sell} Sell`;

  // Format price target comparison
  const priceTargetComparison = (!priceTarget || !currentPrice || priceTarget === 'N/A')
    ? 'N/A'
    : `$${priceTarget} vs $${currentPrice}`;

  return `You are a financial analysis assistant in a stock insights app that implements a "buy low" strategy based on post-earnings stock moves. When a stock drops or jumps around earnings, the app flags it for deeper analysis—our goal is to decide if a sharp drop is likely to recover in the next three months (buy opportunity) or if it reflects structural weakness (avoid or hold).

## Input:
- **Ticker**: ${ticker}
- **Post-earnings price movement**: ${priceMovement}%
- **Insider activity (last 3 months)**: ${insiderActivity}
- **P/E ratio vs industry**: ${peComparison}
- **Analyst ratings**: ${analystRatingsText}
- **Price target vs current price**: ${priceTargetComparison}

## Task:
1. **Status**: one word—**Buy**, **Hold**, or **Sell**  
2. **Reason**: 2–3 sentences explaining:
   - Whether the drop looks like a transient overreaction (bad quarter) or a deeper concern  
   - Reference the available data (insider buys, relative valuation, sentiment)  
   - If key data is missing, note it briefly

## Output format:

Status: **Buy** | **Hold** | **Sell**

Reason: {2–3 sentence analysis based on the data above}`;
}

/**
 * Parses the AI response to extract structured data
 * @param {string} aiResponse - Raw AI response
 * @returns {Object} Parsed response with status and reason
 */
function parseAIResponse(aiResponse) {
  // Extract status (Buy, Hold, or Sell)
  const statusMatch = aiResponse.match(/Status:\s*\*\*(Buy|Hold|Sell)\*\*/i);
  const status = statusMatch ? statusMatch[1] : 'Hold';
  
  // Extract reason
  const reasonMatch = aiResponse.match(/Reason:\s*(.+)/s);
  const reason = reasonMatch ? reasonMatch[1].trim() : aiResponse;
  
  return {
    status,
    reason
  };
}

/**
 * Validates stock data before sending to AI
 * @param {Object} stockData - Stock data to validate
 * @returns {Object} Validation result
 */
function validateStockData(stockData) {
  const errors = [];
  
  if (!stockData.ticker) {
    errors.push('Ticker is required');
  }
  
  if (stockData.ticker && !/^[A-Z]{1,5}$/.test(stockData.ticker)) {
    errors.push('Ticker must be 1-5 uppercase letters');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  analyzeStock,
  validateStockData,
  buildAnalysisPrompt,
  parseAIResponse
}; 