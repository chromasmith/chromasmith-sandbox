/**
 * Test suite for deploy_feature playbook
 */

const { deployFeatureWorkflow } = require('./playbook-deploy-feature.cjs');

async function testDeployFeature() {
  console.log('🧪 Testing deploy_feature playbook...\n');
  
  try {
    // Test: Deploy a feature to dev environment
    const result = await deployFeatureWorkflow('feature-user-profiles', 'dev');
    
    console.log('\n✅ Deploy feature test passed!');
    console.log(`   Feature deployed: ${result.feature.id}`);
    console.log(`   Status: ${result.feature.status}`);
    console.log(`   Environment: ${result.feature.deployed_to}`);
    console.log(`   Related maps: ${result.relatedMapsCount}`);
    
    return { passed: true, result };
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  const startTime = Date.now();
  testDeployFeature()
    .then(result => {
      const elapsed = Date.now() - startTime;
      console.log(`\n⏱️  Duration: ${elapsed}ms`);
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = { testDeployFeature };
