const { getInvestmentOpportunitiesWithBuyAnalysis } = require('./services/opportunities');

async function testBuyOpportunities() {
  console.log('🧪 Testing Buy Opportunities Integration...\n');
  
  try {
    // Test with a recent date
    const testDate = new Date();
    testDate.setDate(testDate.getDate() - 1); // Yesterday
    
    console.log(`📅 Testing with date: ${testDate.toISOString().slice(0, 10)}`);
    console.log('🔍 Running enhanced analysis...\n');
    
    const result = await getInvestmentOpportunitiesWithBuyAnalysis('sp500', testDate);
    
    console.log('\n📊 TEST RESULTS:');
    console.log('================');
    console.log(`✅ Total opportunities: ${result.opportunities.length}`);
    console.log(`💎 Buy opportunities: ${result.buyOpportunities.length}`);
    
    if (result.metadata) {
      console.log(`⏱️  Analysis time: ${(result.metadata.analysisTime.total / 1000).toFixed(1)}s`);
      console.log(`📈 Gainers: ${result.metadata.breakdown.gainers}`);
      console.log(`📉 Losers: ${result.metadata.breakdown.losers}`);
      console.log(`🔻 Big drops (>7%): ${result.metadata.breakdown.bigDrops}`);
    }
    
    if (result.buyOpportunities.length > 0) {
      console.log('\n🏆 TOP BUY OPPORTUNITIES:');
      console.log('========================');
      result.buyOpportunities.slice(0, 3).forEach((opp, index) => {
        console.log(`${index + 1}. ${opp.ticker}:`);
        console.log(`   📊 Recommendation: ${opp.recommendationColor} ${opp.recommendation}`);
        console.log(`   ✅ Criteria met: ${opp.criteriaMetCount}/4`);
        console.log(`   📉 Price change: ${opp.originalStock.change.toFixed(2)}%`);
        if (opp.analystData.upsidePotential) {
          console.log(`   🎯 Upside potential: ${opp.analystData.upsidePotential}%`);
        }
        console.log('');
      });
    } else {
      console.log('\n💡 No buy opportunities found (this is normal if no stocks dropped >7%)');
    }
    
    // Test data structure for React integration
    console.log('\n🔗 REACT INTEGRATION TEST:');
    console.log('==========================');
    
    // Create buy opportunity map like in App.js
    const buyOpportunityMap = result.buyOpportunities.reduce((map, opportunity) => {
      map[opportunity.ticker] = opportunity;
      return map;
    }, {});
    
    console.log(`📋 Buy opportunity map created with ${Object.keys(buyOpportunityMap).length} entries`);
    
    // Test a few stocks to see if they have buy opportunity data
    const testStocks = result.opportunities.slice(0, 5);
    console.log(`🧪 Testing ${testStocks.length} stocks for buy opportunity data:`);
    
    testStocks.forEach(stock => {
      const hasBuyData = buyOpportunityMap[stock.ticker] ? '✅' : '❌';
      const recommendation = buyOpportunityMap[stock.ticker]?.recommendation || 'N/A';
      console.log(`   ${hasBuyData} ${stock.ticker}: ${stock.change.toFixed(2)}% | ${recommendation}`);
    });
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testBuyOpportunities().then(() => {
  console.log('\n👋 Test finished. Exiting...');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
}); 