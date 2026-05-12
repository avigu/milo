const axios = require('axios');

// You'll need to get a free API key from https://financialmodelingprep.com/
const FMP_API_KEY = process.env.FMP_API_KEY || 'demo'; // Replace with actual key

async function getValuationAnalysis(ticker) {
  console.log(`[VALUATION] 🔍 Starting valuation analysis for ${ticker}...`);
  
  try {
    // Get company ratios
    console.log(`[VALUATION] ${ticker} - Fetching company ratios...`);
    const ratiosUrl = `https://financialmodelingprep.com/api/v3/ratios-ttm/${ticker}?apikey=${FMP_API_KEY}`;
    const ratiosResponse = await axios.get(ratiosUrl);
    
    if (!ratiosResponse.data || ratiosResponse.data.length === 0) {
      console.log(`[VALUATION] ${ticker} - No ratios data found`);
      return { companyPE: null, industryPE: null, isUndervalued: false, sector: null };
    }
    
    const companyData = ratiosResponse.data[0];
    const companyPE = companyData.peRatioTTM;
    console.log(`[VALUATION] ${ticker} - Company P/E: ${companyPE}`);
    
    if (!companyPE || companyPE <= 0) {
      console.log(`[VALUATION] ${ticker} - Invalid company P/E ratio`);
      return { companyPE: null, industryPE: null, isUndervalued: false, sector: null };
    }
    
    // Get company profile to find sector
    console.log(`[VALUATION] ${ticker} - Fetching company profile...`);
    const profileUrl = `https://financialmodelingprep.com/api/v3/profile/${ticker}?apikey=${FMP_API_KEY}`;
    const profileResponse = await axios.get(profileUrl);
    
    if (!profileResponse.data || profileResponse.data.length === 0) {
      console.log(`[VALUATION] ${ticker} - No profile data found`);
      return { companyPE, industryPE: null, isUndervalued: false, sector: null };
    }
    
    const sector = profileResponse.data[0].sector;
    const industry = profileResponse.data[0].industry;
    console.log(`[VALUATION] ${ticker} - Sector: ${sector}, Industry: ${industry}`);
    
    // Try to get industry peers using sector screening
    console.log(`[VALUATION] ${ticker} - Fetching sector peers for ${sector}...`);
    let industryPE = null;
    let isUndervalued = false;
    
    try {
      const screenerUrl = `https://financialmodelingprep.com/api/v3/stock-screener?sector=${encodeURIComponent(sector)}&marketCapMoreThan=1000000000&limit=50&apikey=${FMP_API_KEY}`;
      const screenerResponse = await axios.get(screenerUrl);
      
      if (screenerResponse.data && screenerResponse.data.length > 0) {
        console.log(`[VALUATION] ${ticker} - Found ${screenerResponse.data.length} sector peers`);
        
        // Calculate average P/E of sector peers
        const validPEs = screenerResponse.data
          .map(stock => stock.pe)
          .filter(pe => pe && pe > 0 && pe < 100); // Filter out negative and extremely high P/Es
        
        console.log(`[VALUATION] ${ticker} - Valid P/E ratios from peers: ${validPEs.length}`);
        
        if (validPEs.length > 0) {
          industryPE = validPEs.reduce((sum, pe) => sum + pe, 0) / validPEs.length;
          console.log(`[VALUATION] ${ticker} - Calculated industry P/E: ${industryPE.toFixed(2)}`);
          
          // Company is undervalued if its P/E is at least 20% lower than industry average
          isUndervalued = companyPE < (industryPE * 0.8);
          console.log(`[VALUATION] ${ticker} - Undervalued check: ${companyPE} < ${(industryPE * 0.8).toFixed(2)} = ${isUndervalued}`);
        } else {
          console.log(`[VALUATION] ${ticker} - No valid P/E ratios found in sector peers`);
        }
      } else {
        console.log(`[VALUATION] ${ticker} - No sector peers found via screener`);
      }
    } catch (screenerError) {
      console.error(`[VALUATION] ${ticker} - Sector screener failed: ${screenerError.message}`);
    }
    
    // If we couldn't get industry P/E from API, use fallback sector averages
    if (!industryPE) {
      console.log(`[VALUATION] ${ticker} - Using fallback sector averages...`);
      const sectorAverages = {
        'Technology': 25,
        'Healthcare': 20,
        'Financial Services': 12,
        'Consumer Cyclical': 18,
        'Communication Services': 22,
        'Industrials': 16,
        'Consumer Defensive': 15,
        'Energy': 14,
        'Utilities': 18,
        'Real Estate': 20,
        'Materials': 15,
        'Basic Materials': 15,
        'Consumer Goods': 17,
        'Services': 19
      };
      
      industryPE = sectorAverages[sector] || 18; // Default average
      console.log(`[VALUATION] ${ticker} - Using fallback industry P/E: ${industryPE} for sector: ${sector}`);
      
      // Company is undervalued if its P/E is at least 20% lower than industry average
      isUndervalued = companyPE < (industryPE * 0.8);
      console.log(`[VALUATION] ${ticker} - Undervalued check (fallback): ${companyPE} < ${(industryPE * 0.8).toFixed(2)} = ${isUndervalued}`);
    }
    
    const result = {
      companyPE: Math.round(companyPE * 100) / 100,
      industryPE: industryPE ? Math.round(industryPE * 100) / 100 : null,
      isUndervalued,
      sector,
      industry
    };
    
    console.log(`[VALUATION] ${ticker} - ✅ Analysis complete:`, result);
    return result;
    
  } catch (error) {
    console.error(`[VALUATION] ${ticker} - ❌ Error fetching valuation analysis: ${error.message}`);
    console.log(`[VALUATION] ${ticker} - Falling back to Alpha Vantage...`);
    throw error; // Let the caller handle the fallback
  }
}

// Fallback using Alpha Vantage if FMP doesn't work
async function getValuationAnalysisAlphaVantage(ticker) {
  console.log(`[VALUATION] 🔄 Using Alpha Vantage fallback for ${ticker}...`);
  
  try {
    const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'demo';
    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    console.log(`[VALUATION] ${ticker} - Fetching from Alpha Vantage...`);
    
    const response = await axios.get(url);
    
    if (!response.data || response.data.Note) {
      console.log(`[VALUATION] ${ticker} - Alpha Vantage API limit or no data`);
      return { companyPE: null, industryPE: null, isUndervalued: false, sector: null };
    }
    
    const data = response.data;
    const companyPE = parseFloat(data.PERatio);
    const sector = data.Sector;
    
    console.log(`[VALUATION] ${ticker} - Alpha Vantage data: P/E=${companyPE}, Sector=${sector}`);
    
    if (!companyPE || companyPE <= 0) {
      console.log(`[VALUATION] ${ticker} - Invalid P/E from Alpha Vantage`);
      return { companyPE: null, industryPE: null, isUndervalued: false, sector };
    }
    
    // For Alpha Vantage, we'll use a comprehensive sector average estimation
    const sectorAverages = {
      'Technology': 25,
      'Healthcare': 20,
      'Financial Services': 12,
      'Consumer Cyclical': 18,
      'Communication Services': 22,
      'Industrials': 16,
      'Consumer Defensive': 15,
      'Energy': 14,
      'Utilities': 18,
      'Real Estate': 20,
      'Materials': 15,
      'Basic Materials': 15,
      'Consumer Goods': 17,
      'Services': 19,
      'Finance': 12,
      'Information Technology': 25,
      'Health Care': 20,
      'Consumer Staples': 15,
      'Consumer Discretionary': 18
    };
    
    const industryPE = sectorAverages[sector] || 18; // Default average
    const isUndervalued = companyPE < (industryPE * 0.8);
    
    console.log(`[VALUATION] ${ticker} - Using sector average: ${industryPE} for ${sector}`);
    console.log(`[VALUATION] ${ticker} - Undervalued: ${companyPE} < ${(industryPE * 0.8).toFixed(2)} = ${isUndervalued}`);
    
    const result = {
      companyPE: Math.round(companyPE * 100) / 100,
      industryPE,
      isUndervalued,
      sector
    };
    
    console.log(`[VALUATION] ${ticker} - ✅ Alpha Vantage analysis complete:`, result);
    return result;
    
  } catch (error) {
    console.error(`[VALUATION] ${ticker} - ❌ Alpha Vantage fallback failed: ${error.message}`);
    return { companyPE: null, industryPE: null, isUndervalued: false, sector: null };
  }
}

module.exports = {
  getValuationAnalysis,
  getValuationAnalysisAlphaVantage
}; 