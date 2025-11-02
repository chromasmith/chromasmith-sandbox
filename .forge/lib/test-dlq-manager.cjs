/**
 * Tests for DLQ Manager
 * Forge Flow 6.4 - T3.3
 */

const fs = require('fs').promises;
const path = require('path');
const { DLQManager, DLQEntry } = require('./dlq-manager.cjs');
const { ForgeFlowError } = require('./error-taxonomy.cjs');

// Test DLQ path
const TEST_DLQ_PATH = '.forge/_dlq_test';

// Cleanup helper
async function cleanup() {
  try {
    await fs.rm(TEST_DLQ_PATH, { recursive: true, force: true });
  } catch (error) {
    // Ignore
  }
}

// Test suite
(async () => {
  console.log('🧪 Testing DLQ Manager...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Cleanup before tests
  await cleanup();
  
  // Test 1: DLQEntry creation
  try {
    const operation = {
      verb: 'test.operation',
      params: { foo: 'bar' },
      resource: 'test-resource'
    };
    const error = new ForgeFlowError('NETWORK_TIMEOUT', 'Connection failed');
    const entry = new DLQEntry(operation, error, { user: 'test' });
    
    if (!entry.id) throw new Error('Missing ID');
    if (!entry.timestamp) throw new Error('Missing timestamp');
    if (!entry.idempotencyKey) throw new Error('Missing idempotency key');
    if (entry.attempts !== 1) throw new Error('Wrong initial attempts');
    if (entry.status !== 'failed') throw new Error('Wrong initial status');
    if (entry.operation.verb !== 'test.operation') throw new Error('Wrong verb');
    
    console.log('✅ Test 1: DLQEntry creation');
    passed++;
  } catch (err) {
    console.log('❌ Test 1: DLQEntry creation -', err.message);
    failed++;
  }
  
  // Test 2: Add entry to DLQ
  try {
    const dlq = new DLQManager({ basePath: TEST_DLQ_PATH });
    
    const operation = {
      verb: 'github.create_file',
      params: { path: 'test.txt' },
      resource: 'repo'
    };
    const error = new Error('API error');
    
    const entry = await dlq.add(operation, error);
    
    if (!entry.id) throw new Error('Missing ID');
    
    // Verify file exists
    const filePath = path.join(TEST_DLQ_PATH, `${entry.id}.json`);
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    if (!exists) throw new Error('Entry file not created');
    
    console.log('✅ Test 2: Add entry to DLQ');
    passed++;
  } catch (err) {
    console.log('❌ Test 2: Add entry to DLQ -', err.message);
    failed++;
  }
  
  // Test 3: Get entry by ID
  try {
    const dlq = new DLQManager({ basePath: TEST_DLQ_PATH });
    
    const operation = { verb: 'test.get', params: {}, resource: 'test' };
    const error = new Error('Test error');
    
    const added = await dlq.add(operation, error);
    const retrieved = await dlq.get(added.id);
    
    if (!retrieved) throw new Error('Entry not found');
    if (retrieved.id !== added.id) throw new Error('Wrong ID');
    if (retrieved.operation.verb !== 'test.get') throw new Error('Wrong verb');
    
    console.log('✅ Test 3: Get entry by ID');
    passed++;
  } catch (err) {
    console.log('❌ Test 3: Get entry by ID -', err.message);
    failed++;
  }
  
  // Test 4: Idempotency - duplicate detection
  try {
    const dlq = new DLQManager({ basePath: TEST_DLQ_PATH });
    
    const operation = {
      verb: 'test.duplicate',
      params: { same: 'params' },
      resource: 'test'
    };
    
    const entry1 = await dlq.add(operation, new Error('First'));
    const entry2 = await dlq.add(operation, new Error('Second'));
    
    if (entry1.id !== entry2.id) throw new Error('Should return same entry');
    if (entry2.attempts !== 2) throw new Error('Should increment attempts');
    
    console.log('✅ Test 4: Idempotency - duplicate detection');
    passed++;
  } catch (err) {
    console.log('❌ Test 4: Idempotency - duplicate detection -', err.message);
    failed++;
  }
  
  // Test 5: List entries with filters
  try {
    await cleanup();
    const dlq = new DLQManager({ basePath: TEST_DLQ_PATH });
    
    // Add multiple entries
    await dlq.add({ verb: 'test.one', params: {}, resource: 'r1' }, new Error('E1'));
    await dlq.add({ verb: 'test.two', params: {}, resource: 'r2' }, new Error('E2'));
    await dlq.add({ verb: 'test.one', params: { x: 1 }, resource: 'r3' }, new Error('E3'));
    
    const all = await dlq.list();
    if (all.length !== 3) throw new Error(`Expected 3 entries, got ${all.length}`);
    
    const filtered = await dlq.list({ verb: 'test.one' });
    if (filtered.length !== 2) throw new Error(`Expected 2 filtered, got ${filtered.length}`);
    
    console.log('✅ Test 5: List entries with filters');
    passed++;
  } catch (err) {
    console.log('❌ Test 5: List entries with filters -', err.message);
    failed++;
  }
  
  // Test 6: Replay successful
  try {
    await cleanup();
    const dlq = new DLQManager({ basePath: TEST_DLQ_PATH });
    
    const operation = { verb: 'test.replay', params: {}, resource: 'test' };
    const entry = await dlq.add(operation, new Error('Initial failure'));
    
    let executed = false;
    const result = await dlq.replay(entry.id, async (op, ctx) => {
      executed = true;
      return 'success';
    });
    
    if (!executed) throw new Error('Execute function not called');
    if (!result.success) throw new Error('Should succeed');
    
    const updated = await dlq.get(entry.id);
    if (updated.status !== 'resolved') throw new Error('Should be resolved');
    
    console.log('✅ Test 6: Replay successful');
    passed++;
  } catch (err) {
    console.log('❌ Test 6: Replay successful -', err.message);
    failed++;
  }
  
  // Test 7: Replay failed
  try {
    await cleanup();
    const dlq = new DLQManager({ basePath: TEST_DLQ_PATH });
    
    const operation = { verb: 'test.replay.fail', params: {}, resource: 'test' };
    const entry = await dlq.add(operation, new Error('Initial failure'));
    
    const result = await dlq.replay(entry.id, async (op, ctx) => {
      throw new Error('Still failing');
    });
    
    if (result.success) throw new Error('Should fail');
    
    const updated = await dlq.get(entry.id);
    if (updated.status !== 'failed') throw new Error('Should remain failed');
    if (updated.attempts !== 2) throw new Error('Should increment attempts');
    
    console.log('✅ Test 7: Replay failed');
    passed++;
  } catch (err) {
    console.log('❌ Test 7: Replay failed -', err.message);
    failed++;
  }
  
  // Test 8: Replay batch
  try {
    await cleanup();
    const dlq = new DLQManager({ 
      basePath: TEST_DLQ_PATH,
      replayBatchSize: 2
    });
    
    // Add 3 failed entries
    await dlq.add({ verb: 'test.batch.1', params: {}, resource: 'r1' }, new Error('E1'));
    await dlq.add({ verb: 'test.batch.2', params: {}, resource: 'r2' }, new Error('E2'));
    await dlq.add({ verb: 'test.batch.3', params: {}, resource: 'r3' }, new Error('E3'));
    
    let execCount = 0;
    const batchResult = await dlq.replayBatch({}, async (op, ctx) => {
      execCount++;
      return 'success';
    });
    
    if (batchResult.total !== 3) throw new Error('Wrong total');
    if (batchResult.processed !== 2) throw new Error('Should process batch size only');
    if (execCount !== 2) throw new Error('Should execute 2 times');
    
    console.log('✅ Test 8: Replay batch');
    passed++;
  } catch (err) {
    console.log('❌ Test 8: Replay batch -', err.message);
    failed++;
  }
  
  // Test 9: Get statistics
  try {
    await cleanup();
    const dlq = new DLQManager({ basePath: TEST_DLQ_PATH });
    
    await dlq.add({ verb: 'test.stats.1', params: {}, resource: 'r1' }, new Error('E1'));
    await dlq.add({ verb: 'test.stats.2', params: {}, resource: 'r2' }, new Error('E2'));
    
    const stats = await dlq.getStats();
    
    if (stats.total !== 2) throw new Error(`Expected 2 total, got ${stats.total}`);
    if (!stats.byStatus.failed) throw new Error('Missing byStatus');
    if (stats.byStatus.failed !== 2) throw new Error('Wrong failed count');
    
    console.log('✅ Test 9: Get statistics');
    passed++;
  } catch (err) {
    console.log('❌ Test 9: Get statistics -', err.message);
    failed++;
  }
  
  // Test 10: Delete entry
  try {
    await cleanup();
    const dlq = new DLQManager({ basePath: TEST_DLQ_PATH });
    
    const entry = await dlq.add(
      { verb: 'test.delete', params: {}, resource: 'test' },
      new Error('To delete')
    );
    
    const deleted = await dlq.delete(entry.id);
    if (!deleted) throw new Error('Delete should return true');
    
    const retrieved = await dlq.get(entry.id);
    if (retrieved) throw new Error('Entry should be deleted');
    
    console.log('✅ Test 10: Delete entry');
    passed++;
  } catch (err) {
    console.log('❌ Test 10: Delete entry -', err.message);
    failed++;
  }
  
  // Cleanup after tests
  await cleanup();
  
  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Passed: ${passed}/10`);
  console.log(`❌ Failed: ${failed}/10`);
  console.log(`${'='.repeat(50)}`);
  
  if (failed > 0) {
    process.exit(1);
  }
  
})();
