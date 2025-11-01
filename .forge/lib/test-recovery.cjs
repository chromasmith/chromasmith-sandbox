const durability = require('./durability.cjs');
const fs = require('fs').promises;
const path = require('path');

async function testRecovery() {
  console.log('🧪 Testing Crash Recovery...\n');
  
  try {
    // Test 1: Replay any pending WAL entries
    console.log('Test 1: Replaying WAL...');
    const result = await durability.replayWAL();
    console.log(`✅ WAL replay complete. Entries replayed: ${result.replayed}\n`);
    
    // Test 2: Check lock status
    console.log('Test 2: Checking lock status...');
    const lockPath = path.join(__dirname, '..', '_wal/transaction.lock');
    const lockData = JSON.parse(await fs.readFile(lockPath, 'utf8'));
    
    if (lockData.locked) {
      console.log(`⚠️  Lock currently held by: ${lockData.owner}`);
      console.log(`   Acquired at: ${lockData.acquired_at}`);
      
      const lockAge = Date.now() - new Date(lockData.acquired_at).getTime();
      console.log(`   Lock age: ${Math.round(lockAge/1000)} seconds`);
      
      if (lockAge > 60000) {
        console.log(`   ⚠️  Lock is stale (>60s old)`);
      }
    } else {
      console.log('✅ No lock currently held\n');
    }
    
    // Test 3: Try to acquire lock (will steal if stale)
    console.log('\nTest 3: Testing stale lock detection...');
    const testRunId = `recovery-test-${Date.now()}`;
    await durability.acquireLock(testRunId);
    console.log(`✅ Lock acquired by ${testRunId}\n`);
    
    await durability.releaseLock();
    console.log('✅ Lock released\n');
    
    console.log('🎉 Recovery tests passed!');
    
  } catch (err) {
    console.error('❌ Recovery test failed:', err.message);
    process.exit(1);
  }
}

testRecovery();
