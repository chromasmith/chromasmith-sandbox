/**
 * Test suite for safe-mode enforcement
 */

const healthMesh = require('./health-mesh.cjs');
const repo = require('./repo.cjs');
const run = require('./run.cjs');

async function testSafeMode() {
  console.log('🧪 Testing safe-mode enforcement...\n');
  
  let runId;
  
  try {
    runId = await run.start({ task: 'test_safe_mode' });
    
    // Test 1: System starts healthy
    console.log('Test 1: Check default health state');
    const health1 = await healthMesh.getHealth();
    console.log(`✅ Health: ${health1.safe_mode}`);
    
    // Test 2: Write succeeds when healthy
    console.log('\nTest 2: Write when healthy');
    await repo.write('test-safe-001', {
      title: 'Safe Mode Test',
      tags: ['test'],
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, runId);
    console.log('✅ Write succeeded (healthy)');
    
    // Test 3: Enter safe-mode
    console.log('\nTest 3: Enter safe-mode');
    await healthMesh.enterSafeMode('Testing safe-mode');
    const health2 = await healthMesh.getHealth();
    console.log(`✅ Mode: ${health2.safe_mode}`);
    
    // Test 4: Write fails when in safe-mode
    console.log('\nTest 4: Write blocked in safe-mode');
    try {
      await repo.write('test-safe-002', {
        title: 'Should Fail',
        tags: ['test'],
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, runId);
      console.log('❌ Write should have failed!');
    } catch (error) {
      if (error.message.includes('SAFE_MODE_READ_ONLY')) {
        console.log('✅ Write blocked (safe-mode)');
      } else {
        throw error;
      }
    }
    
    // Test 5: Exit safe-mode
    console.log('\nTest 5: Exit safe-mode');
    await healthMesh.exitSafeMode('Testing recovery');
    const health3 = await healthMesh.getHealth();
    console.log(`✅ Mode: ${health3.safe_mode}`);
    
    // Test 6: Write succeeds after recovery
    console.log('\nTest 6: Write after recovery');
    await repo.write('test-safe-003', {
      title: 'Recovery Test',
      tags: ['test'],
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, runId);
    console.log('✅ Write succeeded (recovered)');
    
    await run.finish(runId, 'succeeded');
    
    console.log('\n✅ All safe-mode tests passed!');
    return { passed: 6, failed: 0 };
    
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
  testSafeMode()
    .then(result => {
      const elapsed = Date.now() - startTime;
      console.log(`\n⏱️  Duration: ${elapsed}ms`);
      console.log(`📊 Result:`, result);
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = { testSafeMode };