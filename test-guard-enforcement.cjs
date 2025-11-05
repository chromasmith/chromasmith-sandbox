#!/usr/bin/env node
/**
 * test-guard-enforcement.cjs
 * Comprehensive Guard Enforcement Test Suite
 * Forge Flow 7.0 MVP - Phase P4 Step 4.2
 * 
 * Tests the actual forge-guard token-based confirmation system
 */

const forgeGuard = require('./forge-guard/index.cjs');
const forgeSpeak = require('./forge-speak/index.cjs');

// Test counters
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

// Test results
const results = [];

/**
 * Test runner utility
 */
function test(name, fn) {
  testsRun++;
  try {
    fn();
    testsPassed++;
    results.push({ name, status: 'PASS' });
    console.log(`✓ ${name}`);
  } catch (error) {
    testsFailed++;
    results.push({ name, status: 'FAIL', error: error.message });
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error.message}`);
  }
}

/**
 * Assertion utilities
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

console.log('');
console.log('='.repeat(70));
console.log('GUARD ENFORCEMENT COMPREHENSIVE TEST SUITE');
console.log('Forge Flow 7.0 MVP - Phase P4 Step 4.2');
console.log('='.repeat(70));
console.log('');

// ====================
// FORGE-GUARD TESTS
// ====================

// Test 1: Module Loading
test('forge-guard module loads correctly', () => {
  assert(typeof forgeGuard === 'object', 'forge-guard should export an object');
  assert(typeof forgeGuard.guard_enforce === 'function', 'guard_enforce should be a function');
  assert(typeof forgeGuard.guard_confirm_request === 'function', 'guard_confirm_request should be a function');
  assert(typeof forgeGuard.guard_safe_mode_get === 'function', 'guard_safe_mode_get should be a function');
  assert(typeof forgeGuard.guard_safe_mode_set === 'function', 'guard_safe_mode_set should be a function');
});

// Test 2: Safe Mode Get (initial state)
test('guard_safe_mode_get returns current mode', () => {
  const result = forgeGuard.guard_safe_mode_get();
  assert(result.mode !== undefined, 'Should return mode property');
  assert(['off', 'read_only'].includes(result.mode), 'Mode should be off or read_only');
});

// Test 3: Safe Mode Set to read_only
test('guard_safe_mode_set can enable read_only mode', () => {
  const result = forgeGuard.guard_safe_mode_set({ mode: 'read_only' });
  assertEqual(result.status, 'ok', 'Should return ok status');
  
  const getResult = forgeGuard.guard_safe_mode_get();
  assertEqual(getResult.mode, 'read_only', 'Mode should be read_only');
});

// Test 4: Safe Mode Set to off
test('guard_safe_mode_set can disable read_only mode', () => {
  const result = forgeGuard.guard_safe_mode_set({ mode: 'off' });
  assertEqual(result.status, 'ok', 'Should return ok status');
  
  const getResult = forgeGuard.guard_safe_mode_get();
  assertEqual(getResult.mode, 'off', 'Mode should be off');
});

// Test 5: Enforce non-infra action without token (should allow)
test('guard_enforce allows non-infra actions without token', () => {
  const result = forgeGuard.guard_enforce({ action: 'test.simple_read' });
  assertEqual(result.allowed, true, 'Should allow non-infra action');
  assert(result.ticket, 'Should return ticket');
});

// Test 6: Enforce infra action without token (should block)
test('guard_enforce blocks infra actions without token', () => {
  const result = forgeGuard.guard_enforce({ action: 'build.deploy_preview' });
  assertEqual(result.allowed, false, 'Should block infra action without token');
  assertEqual(result.reason, 'CONFIRM_TOKEN_REQUIRED', 'Should require confirm token');
});

// Test 7: Create confirmation token
test('guard_confirm_request creates valid token', () => {
  const result = forgeGuard.guard_confirm_request({
    action: 'build.deploy_preview',
    summary: 'Test deployment'
  });
  
  assert(result.confirm_token, 'Should return confirm_token');
  assert(result.confirm_token.startsWith('tok_'), 'Token should start with tok_');
  assert(result.expires_at, 'Should return expires_at');
});

// Test 8: Enforce infra action with valid token (should allow)
test('guard_enforce allows infra action with valid token', () => {
  // Create token
  const tokenResult = forgeGuard.guard_confirm_request({
    action: 'build.deploy_preview',
    summary: 'Test deployment'
  });
  
  // Use token
  const result = forgeGuard.guard_enforce({
    action: 'build.deploy_preview',
    confirm_token: tokenResult.confirm_token
  });
  
  assertEqual(result.allowed, true, 'Should allow infra action with valid token');
  assert(result.ticket, 'Should return ticket');
});

// Test 9: Enforce infra action with wrong action token (should block)
test('guard_enforce blocks infra action with mismatched token', () => {
  // Create token for one action
  const tokenResult = forgeGuard.guard_confirm_request({
    action: 'build.deploy_preview',
    summary: 'Preview deployment'
  });
  
  // Try to use token for different action
  const result = forgeGuard.guard_enforce({
    action: 'build.deploy_production',
    confirm_token: tokenResult.confirm_token
  });
  
  assertEqual(result.allowed, false, 'Should block mismatched action');
  assertEqual(result.reason, 'TOKEN_INVALID', 'Should indicate invalid token');
});

// Test 10: Enforce infra action with invalid token (should block)
test('guard_enforce blocks infra action with fake token', () => {
  const result = forgeGuard.guard_enforce({
    action: 'build.deploy_preview',
    confirm_token: 'tok_fakefake'
  });
  
  assertEqual(result.allowed, false, 'Should block fake token');
  assertEqual(result.reason, 'TOKEN_INVALID', 'Should indicate invalid token');
});

// Test 11: Safe mode blocks infra actions
test('guard_enforce blocks infra actions when in read_only mode', () => {
  // Enable safe mode
  forgeGuard.guard_safe_mode_set({ mode: 'read_only' });
  
  // Create valid token
  const tokenResult = forgeGuard.guard_confirm_request({
    action: 'build.deploy_preview',
    summary: 'Test deployment'
  });
  
  // Try to enforce even with valid token
  const result = forgeGuard.guard_enforce({
    action: 'build.deploy_preview',
    confirm_token: tokenResult.confirm_token
  });
  
  assertEqual(result.allowed, false, 'Should block in safe mode');
  assertEqual(result.reason, 'SAFE_MODE', 'Should indicate safe mode');
  
  // Restore normal mode
  forgeGuard.guard_safe_mode_set({ mode: 'off' });
});

// Test 12: All infra actions are guarded
test('guard_enforce recognizes all infra actions', () => {
  const infraActions = [
    'build.prepare_forgeview',
    'build.deploy_preview',
    'build.deploy_production'
  ];
  
  for (const action of infraActions) {
    const result = forgeGuard.guard_enforce({ action });
    assertEqual(result.allowed, false, `${action} should require token`);
    assertEqual(result.reason, 'CONFIRM_TOKEN_REQUIRED', `${action} should require token`);
  }
});

// ====================
// FORGE-SPEAK TESTS
// ====================

// Test 13: forge-speak module loads correctly
test('forge-speak module loads correctly', () => {
  assert(typeof forgeSpeak === 'object', 'forge-speak should export an object');
  assert(typeof forgeSpeak.speak_parse === 'function', 'speak_parse should be a function');
  assert(typeof forgeSpeak.speak_grammar_add === 'function', 'speak_grammar_add should be a function');
});

// Test 14: Parse artifacts preview intent
test('speak_parse recognizes artifacts preview intent', () => {
  const result = forgeSpeak.speak_parse({
    utterance: 'show a quick mockup',
    context_hint: ''
  });
  
  assertEqual(result.intent_id, 'artifacts_preview', 'Should recognize artifacts intent');
  assertEqual(result.requires_confirmation, false, 'Artifacts should not require confirmation');
  assertEqual(result.risk, 'none', 'Artifacts should have no risk');
  assert(result.confidence > 0.5, 'Should have high confidence');
});

// Test 15: Parse forgeview preview intent
test('speak_parse recognizes forgeview preview intent', () => {
  const result = forgeSpeak.speak_parse({
    utterance: 'forge view',
    context_hint: ''
  });
  
  assertEqual(result.intent_id, 'forgeview_preview', 'Should recognize forgeview intent');
  assertEqual(result.requires_confirmation, true, 'Forgeview should require confirmation');
  assertEqual(result.risk, 'infra', 'Forgeview should have infra risk');
});

// Test 16: Parse vercel preview intent
test('speak_parse recognizes vercel preview intent', () => {
  const result = forgeSpeak.speak_parse({
    utterance: 'deploy a preview',
    context_hint: ''
  });
  
  assertEqual(result.intent_id, 'vercel_preview', 'Should recognize vercel intent');
  assertEqual(result.requires_confirmation, true, 'Vercel should require confirmation');
  assertEqual(result.risk, 'infra', 'Vercel should have infra risk');
});

// Test 17: Parse production launch intent
test('speak_parse recognizes production launch intent', () => {
  const result = forgeSpeak.speak_parse({
    utterance: 'go live',
    context_hint: ''
  });
  
  assertEqual(result.intent_id, 'production_launch', 'Should recognize production intent');
  assertEqual(result.requires_confirmation, true, 'Production should require confirmation');
  assertEqual(result.risk, 'infra', 'Production should have infra risk');
});

// Test 18: Parse extracts project name
test('speak_parse extracts project name from utterance', () => {
  const result = forgeSpeak.speak_parse({
    utterance: 'deploy a preview called my-awesome-project',
    context_hint: ''
  });
  
  assert(result.slots.project_name, 'Should extract project name');
  assertEqual(result.slots.project_name, 'my-awesome-project', 'Should extract correct project name');
});

// Test 19: Parse extracts domain
test('speak_parse extracts domain from utterance', () => {
  const result = forgeSpeak.speak_parse({
    utterance: 'launch to production at example.com',
    context_hint: ''
  });
  
  assert(result.slots.domain, 'Should extract domain');
  assertEqual(result.slots.domain, 'example.com', 'Should extract correct domain');
});

// Test 20: Add custom grammar
test('speak_grammar_add extends grammar with custom intents', () => {
  const result = forgeSpeak.speak_grammar_add({
    intent_id: 'custom_action',
    utterances: ['do custom thing', 'run custom']
  });
  
  assertEqual(result.status, 'ok', 'Should return ok status');
  
  // Verify it works
  const parseResult = forgeSpeak.speak_parse({
    utterance: 'do custom thing',
    context_hint: ''
  });
  
  assertEqual(parseResult.intent_id, 'custom_action', 'Should recognize custom intent');
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

// Test 21: End-to-end workflow: parse intent -> create token -> enforce
test('Integration: parse intent, create token, and enforce action', () => {
  // Step 1: Parse natural language command
  const parseResult = forgeSpeak.speak_parse({
    utterance: 'deploy a preview',
    context_hint: ''
  });
  
  assertEqual(parseResult.requires_confirmation, true, 'Should require confirmation');
  
  // Step 2: Create confirmation token
  const tokenResult = forgeGuard.guard_confirm_request({
    action: 'build.deploy_preview',
    summary: 'Preview deployment based on natural language command'
  });
  
  assert(tokenResult.confirm_token, 'Should create token');
  
  // Step 3: Enforce action with token
  const enforceResult = forgeGuard.guard_enforce({
    action: 'build.deploy_preview',
    confirm_token: tokenResult.confirm_token
  });
  
  assertEqual(enforceResult.allowed, true, 'Should allow action with proper workflow');
});

// Test 22: Integration: safe mode blocks full workflow
test('Integration: safe mode blocks even with valid workflow', () => {
  // Enable safe mode
  forgeGuard.guard_safe_mode_set({ mode: 'read_only' });
  
  // Create valid token
  const tokenResult = forgeGuard.guard_confirm_request({
    action: 'build.deploy_production',
    summary: 'Production deployment'
  });
  
  // Try to enforce
  const enforceResult = forgeGuard.guard_enforce({
    action: 'build.deploy_production',
    confirm_token: tokenResult.confirm_token
  });
  
  assertEqual(enforceResult.allowed, false, 'Safe mode should block');
  assertEqual(enforceResult.reason, 'SAFE_MODE', 'Should indicate safe mode');
  
  // Restore normal mode
  forgeGuard.guard_safe_mode_set({ mode: 'off' });
});

// ============================================================================
// RESULTS SUMMARY
// ============================================================================

console.log('');
console.log('='.repeat(70));
console.log('TEST RESULTS SUMMARY');
console.log('='.repeat(70));
console.log('');
console.log(`Total Tests Run:    ${testsRun}`);
console.log(`Tests Passed:       ${testsPassed} ✓`);
console.log(`Tests Failed:       ${testsFailed} ✗`);
console.log(`Success Rate:       ${((testsPassed / testsRun) * 100).toFixed(1)}%`);
console.log('');

if (testsFailed > 0) {
  console.log('FAILED TESTS:');
  results
    .filter(r => r.status === 'FAIL')
    .forEach(r => {
      console.log(`  - ${r.name}`);
      console.log(`    ${r.error}`);
    });
  console.log('');
}

// Determine if ready for step 4.3
const readyForStep43 = testsFailed === 0;

console.log('='.repeat(70));
console.log(`READY FOR STEP 4.3: ${readyForStep43 ? 'YES ✓' : 'NO ✗'}`);
console.log('='.repeat(70));
console.log('');

// Additional context for next steps
if (readyForStep43) {
  console.log('✓ All guard enforcement tests passed');
  console.log('✓ Token-based confirmation system working correctly');
  console.log('✓ Safe mode functionality verified');
  console.log('✓ Natural language intent parsing operational');
  console.log('✓ Integration workflow validated');
  console.log('');
  console.log('System is ready for Step 4.3: Build Integration');
} else {
  console.log('⚠ Guard enforcement tests failed');
  console.log('⚠ Review failed tests above for details');
  console.log('⚠ Fix issues before proceeding to Step 4.3');
}

console.log('');

// Exit with appropriate code
process.exit(testsFailed > 0 ? 1 : 0);

