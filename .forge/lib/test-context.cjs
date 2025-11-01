const context = require('./context.cjs');
const run = require('./run.cjs');

async function testContext() {
  console.log('🧪 Testing Context Protocol...\n');
  
  let runId;
  
  try {
    // Start run
    runId = await run.start({ task: 'test_context' });
    
    // Test 1: Create some test maps
    console.log('Test 1: Creating test maps...');
    
    await context.upsertMap('map-feature-auth', {
      name: 'Authentication Feature',
      tags: ['auth', 'security', 'backend'],
      playbook_required: false,
      created_at: new Date().toISOString()
    }, runId);
    
    await context.upsertMap('map-component-login', {
      name: 'Login Component',
      tags: ['auth', 'frontend', 'ui'],
      playbook_required: true,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days old
    }, runId);
    
    await context.upsertMap('map-database-schema', {
      name: 'Database Schema',
      tags: ['backend', 'database'],
      playbook_required: false,
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days old
    }, runId);
    
    console.log('✅ Created 3 test maps\n');
    
    // Test 2: Get top maps with auth context
    console.log('Test 2: Getting top maps with auth context...');
    const topMaps = await context.getTopMaps({ tags: ['auth'] }, 8);
    
    console.log(`✅ Found ${topMaps.length} maps:`);
    topMaps.forEach(map => {
      console.log(`   - ${map.name} (score: ${map.score.total.toFixed(3)})`);
      console.log(`     Breakdown: fresh=${map.score.breakdown.freshness.toFixed(2)}, tags=${map.score.breakdown.tags_match.toFixed(2)}`);
    });
    console.log();
    
    // Test 3: Check hot index
    console.log('Test 3: Checking hot index...');
    const hotIndex = await context.loadHotIndex();
    console.log(`✅ Hot index has ${hotIndex.entries.length} entries:`);
    hotIndex.entries.forEach(entry => {
      console.log(`   - ${entry.map_id} (accessed ${entry.access_count}x)`);
    });
    console.log();
    
    // Test 4: Access a map multiple times to boost hot score
    console.log('Test 4: Boosting hot index for one map...');
    await context.updateHotIndex('map-component-login', runId);
    await context.updateHotIndex('map-component-login', runId);
    await context.updateHotIndex('map-component-login', runId);
    
    const isHot = await context.isHot('map-component-login');
    console.log(`✅ map-component-login is hot: ${isHot}\n`);
    
    // Test 5: Load full index
    console.log('Test 5: Loading full map index...');
    const fullIndex = await context.loadMapIndex();
    console.log(`✅ Index contains ${fullIndex.maps.length} maps\n`);
    
    // Finish run
    await run.finish(runId, 'succeeded');
    
    console.log('🎉 All context protocol tests passed!');
    console.log(`\n📊 Summary:`);
    console.log(`   Maps created: 3`);
    console.log(`   Hot index size: ${hotIndex.entries.length}`);
    console.log(`   Top scored map: ${topMaps[0].name} (${topMaps[0].score.total.toFixed(3)})`);
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    if (runId) await run.finish(runId, 'failed').catch(() => {});
    process.exit(1);
  }
}

testContext();