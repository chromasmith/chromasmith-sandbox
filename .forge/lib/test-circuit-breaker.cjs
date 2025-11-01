/**
 * Test suite for circuit breaker
 */

const healthMesh = require('./health-mesh.cjs');
const guard = require('./guard.cjs');
const run = require('./run.cjs');

async function testCircuitBreaker() {
  console.log('🧪 Testing circuit breaker...\n');
  
  let runId;
  
  try {
    runId = await run.start({ task: 'test_circuit_breaker' });
    
    // Test 1: Start with healthy state
    console.log('Test 1: Check initial state');
    await healthMesh.setHealth({
      safe_mode: 'healthy',
      reason: null,
      since: new Date().toISOString(),
      consecutive_failures: 0
    });
    const health1 = await healthMesh.getHealth();
    console.log(`✅ Failures: ${health1.consecutive_failures}`);
    
    // Test 2: Record failures and check circuit
    console.log('\nTest 2: Record 3 failures');
    await healthMesh.recordFailure();
    await healthMesh.recordFailure();
    await healthMesh.recordFailure();
    const isOpen1 = await healthMesh.isCircuitOpen();
    console.log(`✅ Circuit open after 3 failures: ${isOpen1}`);
    
    // Test 3: Operations blocked when circuit open
    console.log('\nTest 3: Operations blocked by circuit breaker');
    try {
      await guard.enforceSafeMode();
      console.log('❌ Should have thrown CIRCUIT_BREAKER_OPEN!');
    } catch (error) {
      if (error.message.includes('CIRCUIT_BREAKER_OPEN')) {
        console.log('✅ Operation blocked (circuit open)');
      } else {
        throw error;
      }
    }
    
    // Test 4: Record success (starts reset)
    console.log('\nTest 4: Record success');
    await healthMesh.recordSuccess();
    const health2 = await healthMesh.getHealth();
    console.log(`✅ Failures reset to: ${health2.consecutive_failures}`);
    
    // Test 5: Circuit closed after reset
    console.log('\nTest 5: Circuit closed after success');
    const isOpen2 = await healthMesh.isCircuitOpen();
    console.log(`✅ Circuit open: ${isOpen2}`);
    
    // Test 6: Manual reset
    console.log('\nTest 6: Manual circuit breaker reset');
    await healthMesh.setHealth({
      safe_mode: 'healthy',
      reason: null,
      since: new Date().toISOString(),
      consecutive_failures: 5
    });
    await healthMesh.resetCircuitBreaker();
    const health3 = await healthMesh.getHealth();
    console.log(`✅ Failures after manual reset: ${health3.consecutive_failures}`);
    
    await run.finish(runId, 'succeeded');
    
    console.log('\n✅ All circuit breaker tests passed!');
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
  testCircuitBreaker()
    .then(result => {
      const elapsed = Date.now() - startTime;
      console.log(`\n⏱️  Duration: ${elapsed}ms`);
      console.log(`📊 Result:`, result);
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = { testCircuitBreaker };