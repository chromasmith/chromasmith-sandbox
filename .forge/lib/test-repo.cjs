/**
 * Test suite for repo verbs
 */

const repo = require('./repo.cjs');
const run = require('./run.cjs');

async function testRepoVerbs() {
  console.log('🧪 Testing repo verbs...\n');
  
  let runId;
  
  try {
    runId = await run.start({ task: 'test_repo_verbs' });
    
    // Test 1: Write a test map
    console.log('Test 1: Write map');
    await repo.write('test-feature-001', {
      title: 'User Authentication',
      tags: ['backend', 'auth'],
      status: 'active',
      description: 'OAuth integration'
    }, runId);
    console.log('✅ Write successful');
    
    // Test 2: Read the map back
    console.log('\nTest 2: Read map');
    const map = await repo.read('test-feature-001');
    console.log('✅ Read successful:', map.title);
    
    // Test 3: List maps with filters
    console.log('\nTest 3: List maps (filter: backend)');
    const backendMaps = await repo.list({ tags: ['backend'] });
    console.log(`✅ Found ${backendMaps.length} backend maps`);
    
    // Test 4: List all maps
    console.log('\nTest 4: List all maps');
    const allMaps = await repo.list();
    console.log(`✅ Total maps: ${allMaps.length}`);
    
    await run.finish(runId, 'succeeded');
    
    console.log('\n✅ All repo verb tests passed!');
    return { passed: 4, failed: 0 };
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (runId) {
      await run.finish(runId, 'failed').catch(() => {});
    }
    throw error;
  }
}

if (require.main === module) {
  const startTime = Date.now();
  testRepoVerbs()
    .then(result => {
      const elapsed = Date.now() - startTime;
      console.log(`\n⏱️  Duration: ${elapsed}ms`);
      console.log(`📊 Result:`, result);
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = { testRepoVerbs };