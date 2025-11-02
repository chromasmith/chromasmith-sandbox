/**
 * Tests for Graceful Degradation
 * Forge Flow 6.4 - T3.5
 */

const { 
  DegradationStrategy, 
  GracefulDegradation,
  getDegradation 
} = require('./graceful-degradation.cjs');

(async () => {
  console.log('🧪 Testing Graceful Degradation...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Successful execution
  try {
    const gd = new GracefulDegradation();
    
    const result = await gd.execute('test_success', async () => {
      return 'success';
    });
    
    if (result !== 'success') throw new Error('Wrong result');
    
    console.log('✅ Test 1: Successful execution');
    passed++;
  } catch (err) {
    console.log('❌ Test 1: Successful execution -', err.message);
    failed++;
  }
  
  // Test 2: Fail fast strategy
  try {
    const gd = new GracefulDegradation();
    
    let caught = false;
    try {
      await gd.execute('test_fail_fast', async () => {
        throw new Error('Operation failed');
      }, {
        strategy: DegradationStrategy.FAIL_FAST
      });
    } catch (err) {
      caught = true;
    }
    
    if (!caught) throw new Error('Should have thrown');
    
    console.log('✅ Test 2: Fail fast strategy');
    passed++;
  } catch (err) {
    console.log('❌ Test 2: Fail fast strategy -', err.message);
    failed++;
  }
  
  // Test 3: Fallback value strategy
  try {
    const gd = new GracefulDegradation();
    
    const result = await gd.execute('test_fallback_value', async () => {
      throw new Error('Operation failed');
    }, {
      strategy: DegradationStrategy.FALLBACK_VALUE,
      fallbackValue: 'fallback'
    });
    
    if (result !== 'fallback') throw new Error('Should return fallback value');
    
    console.log('✅ Test 3: Fallback value strategy');
    passed++;
  } catch (err) {
    console.log('❌ Test 3: Fallback value strategy -', err.message);
    failed++;
  }
  
  // Test 4: Fallback cache strategy
  try {
    const gd = new GracefulDegradation();
    
    // First call succeeds and caches
    const result1 = await gd.execute('test_cache', async () => {
      return 'cached_value';
    }, {
      strategy: DegradationStrategy.FALLBACK_CACHE,
      cacheTTL: 5000
    });
    
    if (result1 !== 'cached_value') throw new Error('First call failed');
    
    // Second call fails but uses cache
    const result2 = await gd.execute('test_cache', async () => {
      throw new Error('Operation failed');
    }, {
      strategy: DegradationStrategy.FALLBACK_CACHE,
      fallbackValue: 'default'
    });
    
    if (result2 !== 'cached_value') throw new Error('Should use cached value');
    
    console.log('✅ Test 4: Fallback cache strategy');
    passed++;
  } catch (err) {
    console.log('❌ Test 4: Fallback cache strategy -', err.message);
    failed++;
  }
  
  // Test 5: Fallback function strategy
  try {
    const gd = new GracefulDegradation();
    
    const result = await gd.execute('test_fallback_fn', async () => {
      throw new Error('Operation failed');
    }, {
      strategy: DegradationStrategy.FALLBACK_FUNCTION,
      fallbackFn: async (error) => {
        return `fallback: ${error.message}`;
      }
    });
    
    if (!result.includes('fallback')) throw new Error('Should use fallback function');
    
    console.log('✅ Test 5: Fallback function strategy');
    passed++;
  } catch (err) {
    console.log('❌ Test 5: Fallback function strategy -', err.message);
    failed++;
  }
  
  // Test 6: Skip strategy
  try {
    const gd = new GracefulDegradation();
    
    const result = await gd.execute('test_skip', async () => {
      throw new Error('Operation failed');
    }, {
      strategy: DegradationStrategy.SKIP
    });
    
    if (result !== null) throw new Error('Should return null');
    
    console.log('✅ Test 6: Skip strategy');
    passed++;
  } catch (err) {
    console.log('❌ Test 6: Skip strategy -', err.message);
    failed++;
  }
  
  // Test 7: Feature flags - enabled
  try {
    const gd = new GracefulDegradation();
    
    gd.featureFlags.enable('test_feature');
    
    const result = await gd.execute('test_feature_enabled', async () => {
      return 'success';
    }, {
      feature: 'test_feature'
    });
    
    if (result !== 'success') throw new Error('Should execute when enabled');
    
    console.log('✅ Test 7: Feature flags - enabled');
    passed++;
  } catch (err) {
    console.log('❌ Test 7: Feature flags - enabled -', err.message);
    failed++;
  }
  
  // Test 8: Feature flags - disabled
  try {
    const gd = new GracefulDegradation();
    
    gd.featureFlags.disable('test_feature_disabled');
    
    const result = await gd.execute('test_feature_disabled', async () => {
      return 'should not execute';
    }, {
      feature: 'test_feature_disabled',
      strategy: DegradationStrategy.SKIP
    });
    
    if (result !== null) throw new Error('Should skip when disabled');
    
    console.log('✅ Test 8: Feature flags - disabled');
    passed++;
  } catch (err) {
    console.log('❌ Test 8: Feature flags - disabled -', err.message);
    failed++;
  }
  
  // Test 9: Cache expiration
  try {
    const gd = new GracefulDegradation();
    
    // Cache with short TTL
    await gd.execute('test_expire', async () => {
      return 'cached';
    }, {
      strategy: DegradationStrategy.FALLBACK_CACHE,
      cacheTTL: 50
    });
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 60));
    
    // Should not use expired cache
    const result = await gd.execute('test_expire', async () => {
      throw new Error('Failed');
    }, {
      strategy: DegradationStrategy.FALLBACK_CACHE,
      fallbackValue: 'fresh'
    });
    
    if (result !== 'fresh') throw new Error('Should not use expired cache');
    
    console.log('✅ Test 9: Cache expiration');
    passed++;
  } catch (err) {
    console.log('❌ Test 9: Cache expiration -', err.message);
    failed++;
  }
  
  // Test 10: Statistics
  try {
    const gd = new GracefulDegradation();
    
    // Execute some operations
    await gd.execute('stat1', async () => 'ok');
    
    try {
      await gd.execute('stat2', async () => { throw new Error('fail'); }, {
        strategy: DegradationStrategy.FALLBACK_VALUE,
        fallbackValue: 'fallback'
      });
    } catch (err) {}
    
    const stats = gd.getStats();
    
    if (typeof stats.success !== 'number') throw new Error('Missing success stat');
    if (typeof stats.fallback !== 'number') throw new Error('Missing fallback stat');
    
    console.log('✅ Test 10: Statistics');
    passed++;
  } catch (err) {
    console.log('❌ Test 10: Statistics -', err.message);
    failed++;
  }
  
  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Passed: ${passed}/10`);
  console.log(`❌ Failed: ${failed}/10`);
  console.log(`${'='.repeat(50)}`);
  
  if (failed > 0) {
    process.exit(1);
  }
  
})();
