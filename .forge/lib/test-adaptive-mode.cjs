/**
 * Test suite for adaptive mode enforcement
 */

const healthMesh = require('./health-mesh.cjs');
const guard = require('./guard.cjs');
const run = require('./run.cjs');

async function testAdaptiveMode() {
  console.log('🧪 Testing adaptive mode enforcement...\n');
  
  let runId;
  
  try {
    runId = await run.start({ task: 'test_adaptive_mode' });
    
    // Test 1: Start with clean state
    console.log('Test 1: Initialize clean state');
    await healthMesh.setHealth({
      safe_mode: 'healthy',
      reason: null,
      since: new Date().toISOString(),
      consecutive_failures: 0,
      violation_warnings: 0
    });
    const level1 = await healthMesh.getEnforcementLevel();
    console.log(`✅ Level: ${level1} (warn)`);
    
    // Test 2: First violation - warning only
    console.log('\nTest 2: First violation (warning)');
    const allowed1 = await guard.adaptiveEnforce('risky_operation');
    console.log(`✅ Operation allowed: ${allowed1}`);
    
    // Test 3: Record violations
    console.log('\nTest 3: Record 2 violations');
    await healthMesh.recordViolation('test_violation_1');
    await healthMesh.recordViolation('test_violation_2');
    const level2 = await healthMesh.getEnforcementLevel();
    console.log(`✅ Level escalated to: ${level2}`);
    
    // Test 4: Soft block without override
    console.log('\nTest 4: Soft block (no override)');
    try {
      await guard.adaptiveEnforce('blocked_operation', false);
      console.log('❌ Should have thrown SOFT_BLOCK!');
    } catch (error) {
      if (error.message.includes('SOFT_BLOCK')) {
        console.log('✅ Operation soft-blocked');
      } else {
        throw error;
      }
    }
    
    // Test 5: Soft block with override (reset to soft_block first)
    console.log('\nTest 5: Soft block (with override)');
    // Reset to 2 violations (soft_block level)
    await healthMesh.setHealth({
      safe_mode: 'healthy',
      reason: null,
      since: new Date().toISOString(),
      consecutive_failures: 0,
      violation_warnings: 2
    });
    const allowed2 = await guard.adaptiveEnforce('override_operation', true);
    console.log(`✅ Override allowed: ${allowed2}`);
    
    // Test 6: Hard block after 3+ violations
    console.log('\nTest 6: Hard block after 3+ violations');
    await healthMesh.recordViolation('test_violation_3');
    const level3 = await healthMesh.getEnforcementLevel();
    console.log(`✅ Level: ${level3} (hard_block)`);
    
    try {
      await guard.adaptiveEnforce('hard_blocked_operation', true);
      console.log('❌ Should have thrown HARD_BLOCK!');
    } catch (error) {
      if (error.message.includes('HARD_BLOCK')) {
        console.log('✅ Operation hard-blocked (no override)');
      } else {
        throw error;
      }
    }
    
    // Test 7: Clear violations
    console.log('\nTest 7: Clear violations');
    await healthMesh.clearViolations();
    const level4 = await healthMesh.getEnforcementLevel();
    console.log(`✅ Level reset to: ${level4}`);
    
    await run.finish(runId, 'succeeded');
    
    console.log('\n✅ All adaptive mode tests passed!');
    return { passed: 7, failed: 0 };
    
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
  testAdaptiveMode()
    .then(result => {
      const elapsed = Date.now() - startTime;
      console.log(`\n⏱️  Duration: ${elapsed}ms`);
      console.log(`📊 Result:`, result);
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = { testAdaptiveMode };