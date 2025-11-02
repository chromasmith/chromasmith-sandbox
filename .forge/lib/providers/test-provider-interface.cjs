/**
 * Provider Interface Tests
 * Verify registry, capabilities, and interface contracts
 */

const { Provider, Features } = require('./provider-interface.cjs');
const { ProviderRegistry, registry } = require('./provider-registry.cjs');
const { getCapabilities, compareProviders, findProvidersWithFeatures } = require('./capability-matrix.cjs');

console.log('🧪 Testing Provider Interface System...\n');

let passed = 0;
let failed = 0;

// Test 1: Base Provider interface
try {
  const provider = new Provider({});
  
  // Should have required methods
  if (typeof provider.init === 'function' &&
      typeof provider.ping === 'function' &&
      typeof provider.insert === 'function' &&
      typeof provider.query === 'function' &&
      typeof provider.supports === 'function') {
    console.log('✅ Test 1: Base Provider has required methods');
    passed++;
  } else {
    throw new Error('Missing required methods');
  }
} catch (err) {
  console.error('❌ Test 1 Failed:', err.message);
  failed++;
}

// Test 2: Provider registry
try {
  // Create a mock provider
  class MockProvider extends Provider {
    constructor(config) {
      super(config);
      this.name = 'mock';
    }
    
    async init() { return; }
    async ping() { return true; }
  }
  
  const testRegistry = new ProviderRegistry();
  testRegistry.register('mock', MockProvider);
  
  if (testRegistry.has('mock') &&
      testRegistry.listAvailable().includes('mock')) {
    const instance = testRegistry.create('mock', { test: true });
    if (instance instanceof Provider && instance.name === 'mock') {
      console.log('✅ Test 2: Provider registry works');
      passed++;
    } else {
      throw new Error('Instance creation failed');
    }
  } else {
    throw new Error('Registration failed');
  }
} catch (err) {
  console.error('❌ Test 2 Failed:', err.message);
  failed++;
}

// Test 3: Capability matrix
try {
  const supabaseCaps = getCapabilities('supabase');
  const firebaseCaps = getCapabilities('firebase');
  
  if (supabaseCaps &&
      supabaseCaps[Features.ROW_LEVEL_SECURITY] === true &&
      firebaseCaps &&
      firebaseCaps[Features.REAL_TIME_SUBSCRIPTIONS] === true) {
    console.log('✅ Test 3: Capability matrix accessible');
    console.log(`   Supabase supports ${Object.keys(supabaseCaps).filter(k => supabaseCaps[k] === true).length} features`);
    console.log(`   Firebase supports ${Object.keys(firebaseCaps).filter(k => firebaseCaps[k] === true).length} features`);
    passed++;
  } else {
    throw new Error('Capability lookup failed');
  }
} catch (err) {
  console.error('❌ Test 3 Failed:', err.message);
  failed++;
}

// Test 4: Provider comparison
try {
  const comparison = compareProviders(
    ['supabase', 'firebase', 'mysql'],
    [Features.ROW_LEVEL_SECURITY, Features.REAL_TIME_SUBSCRIPTIONS]
  );
  
  if (comparison[Features.ROW_LEVEL_SECURITY] &&
      comparison[Features.ROW_LEVEL_SECURITY].supabase === true &&
      comparison[Features.REAL_TIME_SUBSCRIPTIONS].firebase === true) {
    console.log('✅ Test 4: Provider comparison works');
    console.log('   Comparison result:');
    console.log(JSON.stringify(comparison, null, 2));
    passed++;
  } else {
    throw new Error('Comparison failed');
  }
} catch (err) {
  console.error('❌ Test 4 Failed:', err.message);
  failed++;
}

// Test 5: Feature-based provider search
try {
  const withRLS = findProvidersWithFeatures([Features.ROW_LEVEL_SECURITY]);
  const withRealtime = findProvidersWithFeatures([Features.REAL_TIME_SUBSCRIPTIONS]);
  
  if (withRLS.includes('supabase') &&
      withRealtime.includes('firebase') &&
      withRealtime.includes('supabase')) {
    console.log('✅ Test 5: Feature-based search works');
    console.log(`   Providers with RLS: ${withRLS.join(', ')}`);
    console.log(`   Providers with Realtime: ${withRealtime.join(', ')}`);
    passed++;
  } else {
    throw new Error('Feature search failed');
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
  console.log('✅ All provider interface tests passed!');
} else {
  console.error('❌ Some tests failed');
  process.exit(1);
}
