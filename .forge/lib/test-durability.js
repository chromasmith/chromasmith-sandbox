const durability = require('./durability');

async function testDurability() {
  console.log('🧪 Testing Durability Primitives...\n');
  
  const runId = `test-${Date.now()}`;
  
  try {
    // Test 1: Lock acquisition
    console.log('Test 1: Acquiring lock...');
    await durability.acquireLock(runId);
    console.log('✅ Lock acquired\n');
    
    // Test 2: Atomic write
    console.log('Test 2: Atomic write with WAL...');
    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Hello from durability test'
    };
    const checksum = await durability.atomicWriteJson('.forge/test_output.json', testData, runId);
    console.log(`✅ Atomic write complete. Checksum: ${checksum.substring(0, 8)}...\n`);
    
    // Test 3: Audit log
    console.log('Test 3: Append to audit log...');
    const auditHash = await durability.appendAuditLog({
      action: 'test_durability',
      run_id: runId,
      status: 'success'
    });
    console.log(`✅ Audit entry added. Hash: ${auditHash.substring(0, 8)}...\n`);
    
    // Test 4: Event ledger
    console.log('Test 4: Append to event ledger...');
    const idempotencyKey = await durability.appendEventLedger(
      `test-event-${Date.now()}`,
      { test: 'payload' },
      'test_scope'
    );
    console.log(`✅ Event ledger entry added. Key: ${idempotencyKey.substring(0, 8)}...\n`);
    
    // Test 5: Release lock
    console.log('Test 5: Releasing lock...');
    await durability.releaseLock();
    console.log('✅ Lock released\n');
    
    console.log('🎉 All durability tests passed!');
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    await durability.releaseLock().catch(() => {});
    process.exit(1);
  }
}

testDurability();
