const run = require('./run');

async function testRunWorkflow() {
  console.log('🧪 Testing Run Workflow...\n');
  
  let runId;
  
  try {
    // Test 1: Start run
    console.log('Test 1: Starting run...');
    runId = await run.start({
      task: 'test_workflow',
      user: 'test_user',
      params: { test: true }
    });
    console.log(`✅ Run started with ID: ${runId}\n`);
    
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test 2: Add progress notes
    console.log('Test 2: Adding progress notes...');
    await run.note(runId, { step: 'validation', status: 'complete' });
    await run.note(runId, { step: 'processing', status: 'in_progress' });
    await run.note(runId, { step: 'processing', status: 'complete' });
    console.log('✅ Progress notes added\n');
    
    // Simulate more work
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test 3: Finish run
    console.log('Test 3: Finishing run...');
    const finalRecord = await run.finish(runId, 'succeeded');
    console.log(`✅ Run finished. Duration: ${finalRecord.duration_ms}ms\n`);
    
    // Verify artifacts
    console.log('Test 4: Verifying artifacts...');
    const fs = require('fs').promises;
    const path = require('path');
    
    // Check run file exists
    const runPath = path.join(__dirname, '..', 'runs', `${runId}.json`);
    const runData = JSON.parse(await fs.readFile(runPath, 'utf8'));
    
    console.log(`✅ Run file exists with ${runData.notes.length} notes`);
    console.log(`✅ Final state: ${runData.state}`);
    console.log(`✅ Duration: ${runData.duration_ms}ms\n`);
    
    // Check lock released
    const lockPath = path.join(__dirname, '..', '_wal/transaction.lock');
    const lockData = JSON.parse(await fs.readFile(lockPath, 'utf8'));
    
    if (!lockData.locked) {
      console.log('✅ Lock properly released\n');
    } else {
      throw new Error('Lock not released!');
    }
    
    console.log('🎉 All run workflow tests passed!');
    console.log(`\n📊 Run Summary:`);
    console.log(`   Run ID: ${runId}`);
    console.log(`   State: ${runData.state}`);
    console.log(`   Notes: ${runData.notes.length}`);
    console.log(`   Duration: ${runData.duration_ms}ms`);
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

testRunWorkflow();
