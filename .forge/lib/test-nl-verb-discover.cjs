const { discover } = require('./nl-verb-discover.cjs');

async function runTests() {
  console.log('🧪 Testing NL Verb Discovery\n');
  
  const testCases = [
    "We have an incident with the database",
    "Validate the system health",
    "Deploy the new feature to production",
    "Schedule content for tomorrow",
    "Create a new feature map"
  ];
  
  let passed = 0;
  for (const testCase of testCases) {
    try {
      const result = await discover(testCase);
      console.log(`✅ "${testCase}"`);
      console.log(`   Intent: ${result.analysis.intent}`);
      console.log(`   Verbs: ${result.analysis.verbs.join(' → ')}`);
      console.log(`   Confidence: ${result.analysis.confidence}\n`);
      passed++;
    } catch (err) {
      console.log(`❌ "${testCase}"`);
      console.log(`   Error: ${err.message}\n`);
    }
  }
  
  console.log(`\n📊 Results: ${passed}/${testCases.length} passed`);
  return passed === testCases.length;
}

if (require.main === module) {
  runTests().then(success => process.exit(success ? 0 : 1));
}

module.exports = { runTests };