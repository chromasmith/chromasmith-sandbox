/**
 * Forge Playbooks - Test Suite
 * Comprehensive tests for workflow engine (15+ tests)
 */

const engine = require('./playbook-engine.cjs');
const playbooks = require('./index.cjs');
const path = require('path');

// Test counters
let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push({ name, status: 'PASS' });
    console.log(`✓ ${name}`);
  } catch (error) {
    failed++;
    results.push({ name, status: 'FAIL', error: error.message });
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

console.log('🧪 Running Forge Playbooks Test Suite\n');

// ====================
// SCHEMA VALIDATION TESTS
// ====================
console.log('📋 Schema Validation Tests');

test('Valid playbook passes validation', () => {
  const validPlaybook = {
    name: 'test-playbook',
    version: '1.0',
    steps: [
      { id: 'step1', action: 'test.action', description: 'Test step' }
    ]
  };
  const result = engine.validatePlaybook(validPlaybook);
  assert(result.valid === true, 'Valid playbook should pass');
  assert(result.errors.length === 0, 'Should have no errors');
});

test('Missing required fields fails validation', () => {
  const invalidPlaybook = {
    name: 'test-playbook'
    // Missing version and steps
  };
  const result = engine.validatePlaybook(invalidPlaybook);
  assert(result.valid === false, 'Invalid playbook should fail');
  assert(result.errors.length > 0, 'Should have validation errors');
});

test('Invalid version format fails validation', () => {
  const invalidPlaybook = {
    name: 'test-playbook',
    version: 'v1.0.0', // Should be just "1.0"
    steps: [
      { id: 'step1', action: 'test.action', description: 'Test' }
    ]
  };
  const result = engine.validatePlaybook(invalidPlaybook);
  assert(result.valid === false, 'Invalid version format should fail');
});

// ====================
// DEPENDENCY RESOLUTION TESTS
// ====================
console.log('\n🔗 Dependency Resolution Tests');

test('Steps with no dependencies are valid', () => {
  const steps = [
    { id: 'step1', action: 'test.a', description: 'A' },
    { id: 'step2', action: 'test.b', description: 'B' }
  ];
  const result = engine.checkDependencies(steps);
  assert(result.valid === true, 'Steps without dependencies should be valid');
  assert(result.issues.length === 0, 'Should have no issues');
});

test('Valid dependencies pass check', () => {
  const steps = [
    { id: 'step1', action: 'test.a', description: 'A' },
    { id: 'step2', action: 'test.b', description: 'B', dependencies: ['step1'] }
  ];
  const result = engine.checkDependencies(steps);
  assert(result.valid === true, 'Valid dependencies should pass');
});

test('Non-existent dependency fails check', () => {
  const steps = [
    { id: 'step1', action: 'test.a', description: 'A', dependencies: ['nonexistent'] }
  ];
  const result = engine.checkDependencies(steps);
  assert(result.valid === false, 'Non-existent dependency should fail');
  assert(result.issues.length > 0, 'Should report missing dependency');
});

test('Circular dependencies are detected', () => {
  const steps = [
    { id: 'step1', action: 'test.a', description: 'A', dependencies: ['step2'] },
    { id: 'step2', action: 'test.b', description: 'B', dependencies: ['step1'] }
  ];
  const result = engine.checkDependencies(steps);
  assert(result.valid === false, 'Circular dependencies should be detected');
});

test('Step execution order is resolved correctly', () => {
  const steps = [
    { id: 'step3', action: 'test.c', description: 'C', dependencies: ['step1', 'step2'] },
    { id: 'step1', action: 'test.a', description: 'A' },
    { id: 'step2', action: 'test.b', description: 'B', dependencies: ['step1'] }
  ];
  const ordered = engine.resolveStepOrder(steps);
  assert(ordered.length === 3, 'Should have all steps');
  assert(ordered[0].id === 'step1', 'Step1 should be first');
  assert(ordered[1].id === 'step2', 'Step2 should be second');
  assert(ordered[2].id === 'step3', 'Step3 should be last');
});

// ====================
// CONDITION EVALUATION TESTS
// ====================
console.log('\n🎯 Condition Evaluation Tests');

test('No condition evaluates to true', () => {
  const result = engine.evaluateCondition(null, {});
  assert(result === true, 'No condition should evaluate to true');
});

test('Variable existence check works', () => {
  const condition = { if: 'myVar' };
  assert(engine.evaluateCondition(condition, { myVar: 'value' }) === true, 'Should find existing var');
  assert(engine.evaluateCondition(condition, {}) === false, 'Should not find missing var');
});

test('Equality check works', () => {
  const condition = { if: 'myVar', equals: 'value' };
  assert(engine.evaluateCondition(condition, { myVar: 'value' }) === true, 'Should match equal value');
  assert(engine.evaluateCondition(condition, { myVar: 'other' }) === false, 'Should not match different value');
});

// ====================
// PLAN GENERATION TESTS
// ====================
console.log('\n📝 Plan Generation Tests');

test('Execution plan is generated correctly', () => {
  const playbook = {
    name: 'test-workflow',
    version: '1.0',
    steps: [
      { id: 'step1', action: 'test.action', description: 'Test step' }
    ]
  };
  const plan = engine.generateExecutionPlan(playbook, {});
  assert(plan.playbook === 'test-workflow', 'Should have correct playbook name');
  assert(plan.mode === 'DRY_RUN', 'Should be in dry-run mode');
  assert(plan.steps.length === 1, 'Should have one step');
  assert(plan.steps[0].sequence === 1, 'Step should have sequence number');
});

test('Plan includes input warnings', () => {
  const playbook = {
    name: 'test-workflow',
    version: '1.0',
    inputs: {
      required_input: {
        type: 'string',
        description: 'Required input',
        required: true
      }
    },
    steps: [
      { id: 'step1', action: 'test.action', description: 'Test' }
    ]
  };
  const plan = engine.generateExecutionPlan(playbook, {});
  assert(plan.warnings.length > 0, 'Should have warning for missing required input');
});

// ====================
// WORKFLOW EXAMPLE TESTS
// ====================
console.log('\n🔄 Workflow Example Tests');

test('Deploy-feature workflow loads successfully', () => {
  const workflowPath = path.join(__dirname, 'workflows', 'deploy-feature.json');
  const workflow = playbooks.playbooks_load(workflowPath);
  assert(workflow.name === 'deploy-feature', 'Should have correct name');
  assert(workflow.steps.length === 5, 'Should have 5 steps');
});

test('Deploy-feature workflow validates successfully', () => {
  const workflowPath = path.join(__dirname, 'workflows', 'deploy-feature.json');
  const workflow = playbooks.playbooks_load(workflowPath);
  const result = playbooks.playbooks_validate(workflow);
  assert(result.valid === true, 'Deploy workflow should be valid');
});

test('Publish-content workflow loads successfully', () => {
  const workflowPath = path.join(__dirname, 'workflows', 'publish-content.json');
  const workflow = playbooks.playbooks_load(workflowPath);
  assert(workflow.name === 'publish-content', 'Should have correct name');
  assert(workflow.steps.length === 5, 'Should have 5 steps');
});

test('Publish-content workflow validates successfully', () => {
  const workflowPath = path.join(__dirname, 'workflows', 'publish-content.json');
  const workflow = playbooks.playbooks_load(workflowPath);
  const result = playbooks.playbooks_validate(workflow);
  assert(result.valid === true, 'Publish workflow should be valid');
});

// ====================
// ERROR HANDLING TESTS
// ====================
console.log('\n⚠️  Error Handling Tests');

test('Invalid JSON file throws error', () => {
  try {
    playbooks.playbooks_load('/nonexistent/path.json');
    assert(false, 'Should throw error for nonexistent file');
  } catch (error) {
    assert(error.message.includes('not found'), 'Should have appropriate error message');
  }
});

test('Invalid playbook structure throws on plan generation', () => {
  const invalidPlaybook = {
    name: 'test',
    version: '1.0',
    steps: [] // Empty steps array
  };
  try {
    engine.generateExecutionPlan(invalidPlaybook, {});
    assert(false, 'Should throw error for empty steps');
  } catch (error) {
    assert(error.message.includes('validation failed'), 'Should fail validation');
  }
});

// ====================
// MODULE API TESTS
// ====================
console.log('\n🔧 Module API Tests');

test('playbooks_info returns module metadata', () => {
  const info = playbooks.playbooks_info();
  assert(info.module === 'forge-playbooks', 'Should have correct module name');
  assert(info.version === '1.0', 'Should have version');
  assert(info.mode === 'DRY_RUN', 'Should be in dry-run mode');
  assert(Array.isArray(info.features), 'Should have features list');
});

test('playbooks_list_workflows returns workflow list', () => {
  const workflows = playbooks.playbooks_list_workflows();
  assert(Array.isArray(workflows), 'Should return array');
  assert(workflows.length >= 2, 'Should have at least 2 example workflows');
  assert(workflows.some(w => w.name === 'deploy-feature'), 'Should include deploy-feature');
  assert(workflows.some(w => w.name === 'publish-content'), 'Should include publish-content');
});

// ====================
// RESULTS SUMMARY
// ====================
console.log('\n' + '='.repeat(60));
console.log('📊 Test Results Summary');
console.log('='.repeat(60));
console.log(`Total Tests: ${passed + failed}`);
console.log(`✓ Passed: ${passed}`);
console.log(`✗ Failed: ${failed}`);
console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log('\n❌ Failed Tests:');
  results.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`  - ${r.name}: ${r.error}`);
  });
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}