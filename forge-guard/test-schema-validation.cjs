const { guard_enforce, guard_confirm_request } = require('./index.cjs');

// Test cases
const tests = [
  {
    name: 'valid_payload_passes',
    action: 'build.prepare_forgeview',
    payload: { repo_name: 'test-app', channel: '1' },
    expect: { allowed: true }
  },
  {
    name: 'missing_required_field',
    action: 'build.prepare_forgeview',
    payload: { repo_name: 'test-app' },
    expect: { allowed: false, reason: 'SCHEMA_INVALID' }
  },
  {
    name: 'invalid_channel_value',
    action: 'build.prepare_forgeview',
    payload: { repo_name: 'test-app', channel: '3' },
    expect: { allowed: false, reason: 'SCHEMA_INVALID' }
  },
  {
    name: 'invalid_repo_name_pattern',
    action: 'build.deploy_preview',
    payload: { repo_name: 'Test_App!', confirm_token: 'tok_abc123' },
    expect: { allowed: false, reason: 'SCHEMA_INVALID' }
  },
  {
    name: 'invalid_domain_pattern',
    action: 'build.deploy_production',
    payload: { repo_name: 'test-app', domain: 'not-a-domain', confirm_token: 'tok_abc123' },
    expect: { allowed: false, reason: 'SCHEMA_INVALID' }
  }
];

// Helper function to compare results
function compareResults(actual, expected) {
  if (expected.allowed !== undefined && actual.allowed !== expected.allowed) {
    return false;
  }
  if (expected.reason !== undefined && actual.reason !== expected.reason) {
    return false;
  }
  return true;
}

// Run tests
function runTests() {
  console.log('='.repeat(60));
  console.log('FORGE-GUARD SCHEMA VALIDATION TESTS');
  console.log('='.repeat(60));
  console.log();

  let passed = 0;
  let failed = 0;

  tests.forEach((test, index) => {
    console.log(`Test ${index + 1}: ${test.name}`);
    console.log(`  Action: ${test.action}`);
    console.log(`  Payload:`, JSON.stringify(test.payload));

    try {
      const result = guard_enforce({
        action: test.action,
        payload: test.payload
      });

      const success = compareResults(result, test.expect);

      if (success) {
        console.log(`  ✓ PASS`);
        passed++;
      } else {
        console.log(`  ✗ FAIL`);
        console.log(`    Expected:`, JSON.stringify(test.expect));
        console.log(`    Got:`, JSON.stringify(result));
        failed++;
      }
    } catch (error) {
      console.log(`  ✗ ERROR: ${error.message}`);
      failed++;
    }

    console.log();
  });

  console.log('='.repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  return { passed, failed, total: tests.length };
}

// Run if executed directly
if (require.main === module) {
  const results = runTests();
  process.exit(results.failed > 0 ? 1 : 0);
}

module.exports = { runTests };
