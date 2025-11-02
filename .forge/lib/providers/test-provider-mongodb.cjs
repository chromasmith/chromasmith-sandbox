/**
 * MongoDB Provider Tests
 * Verify MongoDB implementation works correctly
 */

const { MongoDBProvider } = require('./provider-mongodb.cjs');
const { Features } = require('./provider-interface.cjs');

console.log('🧪 Testing MongoDB Provider...\n');

let passed = 0;
let failed = 0;

(async () => {
  // Test 1: Constructor and capabilities
  try {
    const provider = new MongoDBProvider({
      host: 'localhost',
      database: 'test_db'
    });
    
    const capabilities = provider.getCapabilities();
    
    if (provider.name === 'mongodb' &&
        provider.supports(Features.TRANSACTIONS) &&
        provider.supports(Features.FULL_TEXT_SEARCH) &&
        provider.supports(Features.TIME_SERIES) &&
        provider.supports(Features.VECTOR_SEARCH) &&
        capabilities[Features.RELATIONS] === 'partial') {
      console.log('✅ Test 1: Constructor and capabilities correct');
      console.log(`   Provider: ${provider.name}`);
      console.log(`   Supports Transactions: ${provider.supports(Features.TRANSACTIONS)}`);
      console.log(`   Supports Time Series: ${provider.supports(Features.TIME_SERIES)}`);
      console.log(`   Supports Relations: ${capabilities[Features.RELATIONS]} (partial via $lookup)`);
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
    const provider = new MongoDBProvider({
      host: 'localhost',
      database: 'test_db'
    });
    
    await provider.init();
    
    if (provider.client && provider.client.connected && provider.db) {
      console.log('\n✅ Test 2: Provider initializes successfully');
      passed++;
    } else {
      throw new Error('Client or database not initialized');
    }
  } catch (err) {
    console.error('❌ Test 2 Failed:', err.message);
    failed++;
  }
  
  // Test 3: JSON Schema validator generation
  try {
    const provider = new MongoDBProvider({
      host: 'localhost',
      database: 'test_db'
    });
    
    const schema = {
      name: 'users',
      columns: [
        { name: 'name', type: 'string', notNull: true },
        { name: 'email', type: 'string', notNull: true },
        { name: 'age', type: 'int' },
        { name: 'active', type: 'boolean' }
      ]
    };
    
    const validator = provider.buildValidator(schema);
    
    if (validator.bsonType === 'object' &&
        validator.required.includes('name') &&
        validator.required.includes('email') &&
        validator.properties.name.bsonType === 'string' &&
        validator.properties.age.bsonType === 'int') {
      console.log('\n✅ Test 3: JSON Schema validator generation works');
      console.log(`   Required fields: ${validator.required.join(', ')}`);
      console.log(`   Properties: ${Object.keys(validator.properties).length}`);
      passed++;
    } else {
      throw new Error('Validator structure incorrect');
    }
  } catch (err) {
    console.error('❌ Test 3 Failed:', err.message);
    failed++;
  }
  
  // Test 4: Security policies storage
  try {
    const provider = new MongoDBProvider({
      host: 'localhost',
      database: 'test_db'
    });
    
    await provider.init();
    
    const policies = [
      { id: 'policy1', collection: 'users', action: 'read' },
      { id: 'policy2', collection: 'posts', action: 'write' }
    ];
    
    await provider.applySecurityRules(policies);
    const retrieved = await provider.listSecurityRules();
    
    if (retrieved.length === 2 &&
        retrieved[0].id === 'policy1' &&
        retrieved[1].id === 'policy2') {
      console.log('\n✅ Test 4: Security policies storage works');
      console.log(`   Stored ${retrieved.length} policies`);
      passed++;
    } else {
      throw new Error('Policy storage incorrect');
    }
  } catch (err) {
    console.error('❌ Test 4 Failed:', err.message);
    failed++;
  }
  
  // Test 5: Required config validation
  try {
    let errorCaught = false;
    
    try {
      new MongoDBProvider({});
    } catch (err) {
      if (err.message.includes('URI or host is required')) {
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
    console.log('✅ All MongoDB provider tests passed!');
  } else {
    console.error('❌ Some tests failed');
    process.exit(1);
  }
})();
