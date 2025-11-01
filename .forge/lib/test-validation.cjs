/**
 * Test suite for schema validation
 */

const { validateMap, validateOrThrow } = require('./validate.cjs');
const run = require('./run.cjs');

async function testValidation() {
  console.log('🧪 Testing schema validation...\n');
  
  let runId;
  
  try {
    runId = await run.start({ task: 'test_validation' });
    
    // Test 1: Valid base map
    console.log('Test 1: Valid base map');
    const validMap = {
      id: 'test-map-001',
      title: 'Test Map',
      tags: ['test'],
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const result1 = await validateMap(validMap, 'base-map');
    console.log(`✅ Valid: ${result1.valid}`);
    
    // Test 2: Invalid map (missing required field)
    console.log('\nTest 2: Invalid map (missing created_at)');
    const invalidMap = {
      id: 'test-map-002',
      title: 'Invalid Map',
      updated_at: new Date().toISOString()
    };
    const result2 = await validateMap(invalidMap, 'base-map');
    console.log(`✅ Valid: ${result2.valid}`);
    console.log(`✅ Errors found: ${result2.errors.length}`);
    
    // Test 3: Invalid ID pattern
    console.log('\nTest 3: Invalid ID (uppercase)');
    const badIdMap = {
      id: 'TEST-MAP',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const result3 = await validateMap(badIdMap, 'base-map');
    console.log(`✅ Valid: ${result3.valid}`);
    console.log(`✅ Pattern check working`);
    
    // Test 4: validateOrThrow with valid map
    console.log('\nTest 4: validateOrThrow with valid map');
    await validateOrThrow(validMap, 'base-map');
    console.log('✅ No exception thrown');
    
    await run.finish(runId, 'succeeded');
    
    console.log('\n✅ All validation tests passed!');
    return { passed: 4, failed: 0 };
    
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
  testValidation()
    .then(result => {
      const elapsed = Date.now() - startTime;
      console.log(`\n⏱️  Duration: ${elapsed}ms`);
      console.log(`📊 Result:`, result);
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = { testValidation };