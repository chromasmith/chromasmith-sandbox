/**
 * Firebase Provider Tests
 * Verify Firebase/Firestore implementation works correctly
 */

const { FirebaseProvider } = require('./provider-firebase.cjs');
const { Features } = require('./provider-interface.cjs');
const { parseRLS } = require('../security-parse-rls.cjs');

console.log('🧪 Testing Firebase Provider...\n');

let passed = 0;
let failed = 0;

(async () => {
  // Test 1: Constructor and capabilities
  try {
    const provider = new FirebaseProvider({
      projectId: 'test-project',
      apiKey: 'test-key'
    });
    
    if (provider.name === 'firebase' &&
        provider.supports(Features.REAL_TIME_SUBSCRIPTIONS) &&
        provider.supports(Features.ROW_LEVEL_SECURITY) &&  // Via security rules
        !provider.supports(Features.JOINS)) {  // NoSQL, no joins
      console.log('✅ Test 1: Constructor and capabilities correct');
      console.log(`   Provider: ${provider.name}`);
      console.log(`   Supports Realtime: ${provider.supports(Features.REAL_TIME_SUBSCRIPTIONS)}`);
      console.log(`   Supports Security Rules: ${provider.supports(Features.ROW_LEVEL_SECURITY)}`);
      console.log(`   Supports Joins: ${provider.supports(Features.JOINS)} (expected: false)`);
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
    const provider = new FirebaseProvider({
      projectId: 'test-project',
      apiKey: 'test-key'
    });
    
    await provider.init();
    
    if (provider.client && provider.client.initialized && provider.db) {
      console.log('\n✅ Test 2: Provider initializes successfully');
      passed++;
    } else {
      throw new Error('Client or database not initialized');
    }
  } catch (err) {
    console.error('❌ Test 2 Failed:', err.message);
    failed++;
  }
  
  // Test 3: Security rules generation
  try {
    const provider = new FirebaseProvider({
      projectId: 'test-project',
      apiKey: 'test-key'
    });
    
    await provider.init();
    
    const sql = `CREATE POLICY "test" ON posts FOR SELECT USING (auth.uid() = user_id);`;
    const ast = parseRLS(sql);
    
    await provider.applySecurityRules(ast);
    
    if (provider.securityRules &&
        provider.securityRules.includes('service cloud.firestore') &&
        provider.securityRules.includes('request.auth.uid')) {
      console.log('\n✅ Test 3: Security rules generation works');
      console.log('   Generated rules excerpt:');
      console.log(provider.securityRules.split('\n').slice(0, 5).join('\n') + '...');
      passed++;
    } else {
      throw new Error('Security rules generation failed');
    }
  } catch (err) {
    console.error('❌ Test 3 Failed:', err.message);
    failed++;
  }
  
  // Test 4: Complex nested logical in security rules
  try {
    const provider = new FirebaseProvider({
      projectId: 'test-project',
      apiKey: 'test-key'
    });
    
    await provider.init();
    
    const sql = `
      CREATE POLICY "complex" ON posts 
      FOR SELECT 
      USING (auth.uid() = user_id OR (role = 'admin' AND active = true));
    `;
    const ast = parseRLS(sql);
    
    await provider.applySecurityRules(ast);
    
    if (provider.securityRules &&
        provider.securityRules.includes('or') &&
        provider.securityRules.includes('and')) {
      console.log('\n✅ Test 4: Complex nested logical in security rules');
      passed++;
    } else {
      throw new Error('Complex rules generation failed');
    }
  } catch (err) {
    console.error('❌ Test 4 Failed:', err.message);
    failed++;
  }
  
  // Test 5: Required config validation
  try {
    let errorCaught = false;
    
    try {
      new FirebaseProvider({});
    } catch (err) {
      if (err.message.includes('project ID is required')) {
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
    console.log('✅ All Firebase provider tests passed!');
  } else {
    console.error('❌ Some tests failed');
    process.exit(1);
  }
})();
