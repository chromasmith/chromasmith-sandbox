/**
 * Supabase Provider Tests
 * Verify Supabase implementation works correctly
 */

const { SupabaseProvider } = require('./provider-supabase.cjs');
const { Features } = require('./provider-interface.cjs');
const { parseRLS } = require('../security-parse-rls.cjs');

console.log('🧪 Testing Supabase Provider...\n');

let passed = 0;
let failed = 0;

// Test 1: Constructor and capabilities
try {
  const provider = new SupabaseProvider({
    url: 'https://test.supabase.co',
    key: 'test-key'
  });
  
  if (provider.name === 'supabase' &&
      provider.supports(Features.ROW_LEVEL_SECURITY) &&
      provider.supports(Features.REAL_TIME_SUBSCRIPTIONS) &&
      !provider.supports(Features.COLUMN_LEVEL_SECURITY)) {
    console.log('✅ Test 1: Constructor and capabilities correct');
    console.log(`   Provider: ${provider.name}`);
    console.log(`   Supports RLS: ${provider.supports(Features.ROW_LEVEL_SECURITY)}`);
    console.log(`   Supports Realtime: ${provider.supports(Features.REAL_TIME_SUBSCRIPTIONS)}`);
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
  const provider = new SupabaseProvider({
    url: 'https://test.supabase.co',
    key: 'test-key'
  });
  
  await provider.init();
  
  if (provider.client && provider.client.initialized) {
    console.log('\n✅ Test 2: Provider initializes successfully');
    passed++;
  } else {
    throw new Error('Client not initialized');
  }
} catch (err) {
  console.error('❌ Test 2 Failed:', err.message);
  failed++;
}

// Test 3: AST to RLS SQL conversion
try {
  const provider = new SupabaseProvider({
    url: 'https://test.supabase.co',
    key: 'test-key'
  });
  
  await provider.init();
  
  const sql = `CREATE POLICY "test" ON posts FOR SELECT USING (auth.uid() = user_id);`;
  const ast = parseRLS(sql);
  const generatedSQL = provider.astToRLSSQL(ast);
  
  if (generatedSQL.includes('CREATE POLICY') &&
      generatedSQL.includes('auth.uid()') &&
      generatedSQL.includes('user_id')) {
    console.log('\n✅ Test 3: AST to RLS SQL conversion works');
    console.log('   Generated SQL:');
    console.log(generatedSQL);
    passed++;
  } else {
    throw new Error('SQL generation incorrect');
  }
} catch (err) {
  console.error('❌ Test 3 Failed:', err.message);
  failed++;
}

// Test 4: Complex AST conversion (nested logical)
try {
  const provider = new SupabaseProvider({
    url: 'https://test.supabase.co',
    key: 'test-key'
  });
  
  await provider.init();
  
  const sql = `
    CREATE POLICY "complex" ON posts 
    FOR SELECT 
    USING (auth.uid() = user_id OR (role = 'admin' AND active = true));
  `;
  const ast = parseRLS(sql);
  const generatedSQL = provider.astToRLSSQL(ast);
  
  if (generatedSQL.includes('OR') &&
      generatedSQL.includes('AND') &&
      generatedSQL.includes('auth.uid()')) {
    console.log('\n✅ Test 4: Complex nested logical conversion works');
    console.log('   Generated SQL:');
    console.log(generatedSQL);
    passed++;
  } else {
    throw new Error('Complex SQL generation incorrect');
  }
} catch (err) {
  console.error('❌ Test 4 Failed:', err.message);
  failed++;
}

// Test 5: Required config validation
try {
  let errorCaught = false;
  
  try {
    new SupabaseProvider({});
  } catch (err) {
    if (err.message.includes('URL is required')) {
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
  console.log('✅ All Supabase provider tests passed!');
} else {
  console.error('❌ Some tests failed');
  process.exit(1);
}