/**
 * DynamoDB Provider Tests
 * Verify DynamoDB implementation works correctly
 */

const { DynamoDBProvider } = require('./provider-dynamodb.cjs');
const { Features } = require('./provider-interface.cjs');

console.log('🧪 Testing DynamoDB Provider...\n');

let passed = 0;
let failed = 0;

(async () => {
  // Test 1: Constructor and capabilities
  try {
    const provider = new DynamoDBProvider({
      region: 'us-east-1',
      accessKeyId: 'test',
      secretAccessKey: 'test'
    });
    
    if (provider.name === 'dynamodb' &&
        provider.supports(Features.TRANSACTIONS) &&
        provider.supports(Features.INDEXES) &&
        provider.supports(Features.REAL_TIME_SUBSCRIPTIONS) &&
        provider.getCapabilityLevel(Features.ROW_LEVEL_SECURITY) === 'partial' &&
        !provider.supports(Features.JOINS)) {
      console.log('✅ Test 1: Constructor and capabilities correct');
      console.log(`   Provider: ${provider.name}`);
      console.log(`   Supports Transactions: ${provider.supports(Features.TRANSACTIONS)}`);
      console.log(`   Supports Streams: ${provider.supports(Features.REAL_TIME_SUBSCRIPTIONS)}`);
      console.log(`   RLS Level: ${provider.getCapabilityLevel(Features.ROW_LEVEL_SECURITY)} (via IAM)`);
      passed++;
    } else {
      throw new Error('Capabilities incorrect');
    }
  } catch (err) {
    console.error('❌ Test 1 Failed:', err.message);
    failed++;
  }
  
  // Test 2: Initialization
  try {
    const provider = new DynamoDBProvider({
      region: 'us-east-1',
      accessKeyId: 'test',
      secretAccessKey: 'test'
    });
    
    await provider.init();
    
    if (provider.client && provider.client.connected) {
      console.log('\n✅ Test 2: Provider initializes successfully');
      passed++;
    } else {
      throw new Error('Client not initialized');
    }
  } catch (err) {
    console.error('❌ Test 2 Failed:', err.message);
    failed++;
  }
  
  // Test 3: Attribute type mapping
  try {
    const provider = new DynamoDBProvider({
      region: 'us-east-1',
      accessKeyId: 'test',
      secretAccessKey: 'test'
    });
    
    const mappings = {
      'string': 'S',
      'number': 'N',
      'boolean': 'BOOL',
      'binary': 'B',
      'array': 'L',
      'object': 'M'
    };
    
    let allCorrect = true;
    for (const [type, expected] of Object.entries(mappings)) {
      const actual = provider.mapAttributeType(type);
      if (actual !== expected) {
        allCorrect = false;
        break;
      }
    }
    
    if (allCorrect) {
      console.log('\n✅ Test 3: Attribute type mapping works');
      console.log(`   Mapped ${Object.keys(mappings).length} types correctly`);
      passed++;
    } else {
      throw new Error('Type mapping incorrect');
    }
  } catch (err) {
    console.error('❌ Test 3 Failed:', err.message);
    failed++;
  }
  
  // Test 4: Item marshalling
  try {
    const provider = new DynamoDBProvider({
      region: 'us-east-1',
      accessKeyId: 'test',
      secretAccessKey: 'test'
    });
    
    const data = {
      id: 'test-123',
      name: 'Test Item',
      count: 42,
      active: true,
      tags: ['tag1', 'tag2'],
      metadata: { key: 'value' }
    };
    
    const marshalled = provider.marshallItem(data);
    
    if (marshalled.id.S === 'test-123' &&
        marshalled.name.S === 'Test Item' &&
        marshalled.count.N === '42' &&
        marshalled.active.BOOL === true &&
        marshalled.tags.L.length === 2 &&
        marshalled.metadata.M.key.S === 'value') {
      console.log('\n✅ Test 4: Item marshalling works');
      console.log('   Correctly marshalled all data types');
      passed++;
    } else {
      throw new Error('Marshalling incorrect');
    }
  } catch (err) {
    console.error('❌ Test 4 Failed:', err.message);
    failed++;
  }
  
  // Test 5: Required config validation
  try {
    let errorCaught = false;
    
    try {
      new DynamoDBProvider({});
    } catch (err) {
      if (err.message.includes('region is required')) {
        errorCaught = true;
      }
    }
    
    if (errorCaught) {
      console.log('\n✅ Test 5: Required config validation works');
      passed++;
    } else {
      throw new Error('Should have thrown error for missing config');
    }
  } catch (err) {
    console.error('❌ Test 5 Failed:', err.message);
    failed++;
  }
  
  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tests: ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (failed === 0) {
    console.log('✅ All DynamoDB provider tests passed!');
  } else {
    console.error('❌ Some tests failed');
    process.exit(1);
  }
})();
