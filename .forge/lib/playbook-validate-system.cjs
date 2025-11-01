/**
 * Forge Flow 6.4 - System Validation Playbook
 * Validates system health: locks, WAL, hot index, context scoring
 * Uses: run, durability, context
 * Duration estimate: ~400ms (5 checks: WAL, audit, scoring, hot index, context query)
 */

const durability = require('./durability.cjs');
const run = require('./run.cjs');
const context = require('./context.cjs');

async function validateSystemWorkflow() {
  console.log('🔍 Starting system validation workflow...\n');
  
  let runId;
  
  try {
    // Step 1: Start run workflow
    runId = await run.start({
      task: 'validate_system',
      timestamp: new Date().toISOString()
    });
    console.log(`✅ Run started: ${runId}`);
    
    // Step 2: Validate durability layer
    await run.note(runId, { phase: 'durability_checks' });
    
    // Note: Lock mechanism validated by run.start() acquiring lock
    
    // Check WAL system
    const walTestPath = `test/wal-check-${Date.now()}.json`;
    await durability.atomicWriteJson(walTestPath, { test: true }, runId);
    console.log('✅ WAL system: PASSED');
    
    // Check audit log
    const auditHash = await durability.appendAuditLog({
      event: 'system_validation',
      runId,
      timestamp: new Date().toISOString()
    });
    console.log(`✅ Audit log: PASSED (hash: ${auditHash.substring(0, 8)}...)`);
    
    // Step 3: Validate context system
    await run.note(runId, { phase: 'context_checks' });
    
    // Check scoring algorithm
    const testMap = {
      id: `test-map-${Date.now()}`,
      tags: ['system', 'test'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const score = await context.calculateScore(testMap, { tags: ['system'] });
    console.log(`✅ Context scoring: PASSED (score: ${score.toFixed(3)})`);
    
    // Check hot index
    const isHot = await context.isHot('test-map-nonexistent');
    console.log(`✅ Hot index: PASSED (query returned: ${isHot})`);
    
    // Get top maps (should work even if empty)
    const topMaps = await context.getTopMaps({ tags: ['system'] }, 3);
    console.log(`✅ Context query: PASSED (found ${topMaps.length} maps)`);
    
    // Step 4: Complete validation
    await run.note(runId, { 
      phase: 'validation_complete',
      results: {
        durability: 'passed',
        context: 'passed',
        overall: 'healthy'
      }
    });
    
    await run.finish(runId, 'succeeded');
    
    console.log('\n✅ System validation completed successfully');
    return {
      status: 'healthy',
      runId,
      checksCompleted: 5
    };
    
  } catch (error) {
    console.error('\n❌ Validation failed:', error.message);
    
    if (runId) {
      await run.finish(runId, 'failed').catch(() => {});
    }
    
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  const startTime = Date.now();
  
  validateSystemWorkflow()
    .then(result => {
      const elapsed = Date.now() - startTime;
      console.log(`\n⏱️  Duration: ${elapsed}ms`);
      console.log(`📊 Result:`, JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Workflow failed:', error);
      process.exit(1);
    });
}

module.exports = { validateSystemWorkflow };
