#!/usr/bin/env node

/**
 * Forge Tendrils - Test Suite
 * 
 * Tests for the Tendrils declarative adapter layer
 * Run: node forge-tendrils/test-tendrils.cjs
 */

const path = require('path');
const {
  tendrils_load_manifest,
  tendrils_validate_manifest,
  tendrils_capability_check,
  tendrils_export_plan,
  tendrils_provider_info,
  tendrils_find_providers,
  tendrils_info,
  capability,
  planning
} = require('./index.cjs');

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    testsPassed++;
  } else {
    console.log(`✗ ${message}`);
    testsFailed++;
  }
}

function assertEquals(actual, expected, message) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  assert(passed, message);
  if (!passed) {
    console.log(`  Expected: ${JSON.stringify(expected)}`);
    console.log(`  Actual: ${JSON.stringify(actual)}`);
  }
}

function assertTruthy(value, message) {
  assert(!!value, message);
}

function assertFalsy(value, message) {
  assert(!value, message);
}

console.log('═══════════════════════════════════════════════════');
console.log('Forge Tendrils Test Suite');
console.log('═══════════════════════════════════════════════════\n');

// Test 1: Module info
console.log('Test 1: Module Info');
console.log('───────────────────────────────────────────────────');
const info = tendrils_info();
assertTruthy(info.name === 'forge-tendrils', 'Module name is correct');
assertTruthy(info.mode === 'plan-only', 'Module is in plan-only mode');
assertTruthy(info.supported_providers.total > 0, 'Has supported providers');
console.log('');

// Test 2: Load sample manifest
console.log('Test 2: Load Sample Manifest');
console.log('───────────────────────────────────────────────────');
try {
  const manifest = tendrils_load_manifest(path.join(__dirname, 'sample-trellis.json'));
  assertTruthy(manifest, 'Loaded sample manifest');
  assertEquals(manifest.project.name, 'blog-platform', 'Project name is correct');
  assertEquals(manifest.providers.database, 'supabase', 'Database provider is correct');
  console.log('');
} catch (error) {
  assert(false, `Failed to load manifest: ${error.message}`);
  console.log('');
}

// Test 3: Validate manifest
console.log('Test 3: Validate Manifest');
console.log('───────────────────────────────────────────────────');
const manifest = tendrils_load_manifest(path.join(__dirname, 'sample-trellis.json'));
const validation = tendrils_validate_manifest(manifest);
assertTruthy(validation.valid, 'Sample manifest is valid');
assertEquals(validation.errors.length, 0, 'No validation errors');
console.log('');

// Test 4: Validate invalid manifest
console.log('Test 4: Handle Invalid Manifest');
console.log('───────────────────────────────────────────────────');
const invalidManifest = { version: '1.0' }; // Missing required fields
const invalidValidation = tendrils_validate_manifest(invalidManifest);
assertFalsy(invalidValidation.valid, 'Invalid manifest fails validation');
assertTruthy(invalidValidation.errors.length > 0, 'Has validation errors');
console.log('');

// Test 5: Capability checks
console.log('Test 5: Capability Matrix - Supabase');
console.log('───────────────────────────────────────────────────');
const supabaseRls = capability.check('supabase', 'rls');
assertEquals(supabaseRls, true, 'Supabase supports RLS');

const supabaseRealtime = capability.check('supabase', 'realtime');
assertEquals(supabaseRealtime, true, 'Supabase supports realtime');
console.log('');

// Test 6: MySQL lacks RLS
console.log('Test 6: Capability Matrix - MySQL');
console.log('───────────────────────────────────────────────────');
const mysqlRls = capability.check('mysql', 'rls');
assertEquals(mysqlRls, false, 'MySQL does not support RLS');

const mysqlTriggers = capability.check('mysql', 'triggers');
assertEquals(mysqlTriggers, true, 'MySQL supports triggers');
console.log('');

// Test 7: Firebase partial RLS
console.log('Test 7: Capability Matrix - Firebase');
console.log('───────────────────────────────────────────────────');
const firebaseRls = capability.check('firebase', 'rls');
assertEquals(firebaseRls, 'partial', 'Firebase has partial RLS support');
console.log('');

// Test 8: Provider info
console.log('Test 8: Provider Info');
console.log('───────────────────────────────────────────────────');
const providerInfo = tendrils_provider_info('supabase');
assertTruthy(providerInfo.supported, 'Supabase is supported');
assertTruthy(providerInfo.capabilities.rls, 'Supabase capabilities include RLS');
console.log('');

// Test 9: Find providers by capability
console.log('Test 9: Find Providers by Capability');
console.log('───────────────────────────────────────────────────');
const rlsProviders = tendrils_find_providers('rls');
assertTruthy(rlsProviders.providers.full.includes('supabase'), 'Supabase in full RLS support');
assertTruthy(rlsProviders.providers.none.includes('mysql'), 'MySQL in no RLS support');
assertTruthy(rlsProviders.providers.partial.includes('firebase'), 'Firebase in partial RLS support');
console.log('');

// Test 10: Capability check for manifest
console.log('Test 10: Manifest Capability Check');
console.log('───────────────────────────────────────────────────');
const capCheck = tendrils_capability_check(manifest);
assertTruthy(capCheck.project === 'blog-platform', 'Project name in capability check');
assertTruthy(capCheck.providers.database.supported, 'Database provider is supported');
assertTruthy(capCheck.capabilities.rls.database, 'Database has RLS capability');
console.log('');

// Test 11: Generate provision plan
console.log('Test 11: Generate Provision Plan');
console.log('───────────────────────────────────────────────────');
const provisionPlan = planning.generateProvisionPlan(manifest);
assertTruthy(provisionPlan.phase === 'provision', 'Plan phase is provision');
assertTruthy(provisionPlan.steps.length > 0, 'Plan has steps');
assertTruthy(provisionPlan.estimated_time_minutes > 0, 'Plan has estimated time');
assertTruthy(
  provisionPlan.steps.some(s => s.action === 'provision_database'),
  'Plan includes database provisioning'
);
console.log('');

// Test 12: Generate migration plan
console.log('Test 12: Generate Migration Plan');
console.log('───────────────────────────────────────────────────');
const migrationPlan = planning.generateMigrationPlan(manifest);
assertTruthy(migrationPlan.phase === 'migrate', 'Plan phase is migrate');
assertTruthy(migrationPlan.steps.length > 0, 'Plan has steps');
assertTruthy(
  migrationPlan.steps.some(s => s.action === 'apply_rls'),
  'Plan includes RLS (Supabase supports it)'
);
console.log('');

// Test 13: Generate deployment plan
console.log('Test 13: Generate Deployment Plan');
console.log('───────────────────────────────────────────────────');
const deploymentPlan = planning.generateDeploymentPlan(manifest);
assertTruthy(deploymentPlan.phase === 'deploy', 'Plan phase is deploy');
assertTruthy(deploymentPlan.steps.length > 0, 'Plan has steps');
assertTruthy(
  deploymentPlan.steps.some(s => s.action === 'build'),
  'Plan includes build step'
);
console.log('');

// Test 14: Generate complete plan
console.log('Test 14: Generate Complete Multi-Phase Plan');
console.log('───────────────────────────────────────────────────');
const completePlan = planning.generateCompletePlan(manifest);
assertTruthy(completePlan.project === 'blog-platform', 'Complete plan has project name');
assertTruthy(completePlan.phases.provision, 'Has provision phase');
assertTruthy(completePlan.phases.migrate, 'Has migrate phase');
assertTruthy(completePlan.phases.deploy, 'Has deploy phase');
assertTruthy(completePlan.total_estimated_minutes > 0, 'Has total estimated time');
console.log('');

// Test 15: Export plan (full integration)
console.log('Test 15: Full Export Plan');
console.log('───────────────────────────────────────────────────');
const exportPlan = tendrils_export_plan(manifest, ['provision', 'migrate', 'deploy']);
assertTruthy(exportPlan.success, 'Export plan succeeded');
assertTruthy(exportPlan.validation.valid, 'Validation passed');
assertTruthy(exportPlan.plan.phases.provision, 'Has provision phase');
assertTruthy(exportPlan.plan.phases.migrate, 'Has migrate phase');
assertTruthy(exportPlan.plan.phases.deploy, 'Has deploy phase');
console.log('');

// Test 16: Export plan with invalid manifest
console.log('Test 16: Export Plan with Invalid Manifest');
console.log('───────────────────────────────────────────────────');
const invalidExport = tendrils_export_plan({ version: '1.0' });
assertFalsy(invalidExport.success, 'Invalid manifest fails export');
assertTruthy(invalidExport.errors, 'Has error details');
console.log('');

// Test 17: Handle unknown provider
console.log('Test 17: Handle Unknown Provider');
console.log('───────────────────────────────────────────────────');
try {
  capability.check('unknown-provider', 'rls');
  assert(false, 'Should throw error for unknown provider');
} catch (error) {
  assert(true, 'Throws error for unknown provider');
}
console.log('');

// Test 18: Handle unknown capability
console.log('Test 18: Handle Unknown Capability');
console.log('───────────────────────────────────────────────────');
try {
  capability.check('supabase', 'unknown-capability');
  assert(false, 'Should throw error for unknown capability');
} catch (error) {
  assert(true, 'Throws error for unknown capability');
}
console.log('');

// Test 19: List all providers
console.log('Test 19: List All Providers');
console.log('───────────────────────────────────────────────────');
const providers = capability.listProviders();
assertTruthy(providers.includes('supabase'), 'Providers include Supabase');
assertTruthy(providers.includes('firebase'), 'Providers include Firebase');
assertTruthy(providers.includes('mysql'), 'Providers include MySQL');
assertTruthy(providers.includes('mongodb'), 'Providers include MongoDB');
assertTruthy(providers.includes('dynamodb'), 'Providers include DynamoDB');
console.log('');

// Test 20: List all capabilities
console.log('Test 20: List All Capabilities');
console.log('───────────────────────────────────────────────────');
const capabilities = capability.listCapabilities();
assertTruthy(capabilities.includes('rls'), 'Capabilities include rls');
assertTruthy(capabilities.includes('triggers'), 'Capabilities include triggers');
assertTruthy(capabilities.includes('functions'), 'Capabilities include functions');
assertTruthy(capabilities.includes('realtime'), 'Capabilities include realtime');
console.log('');

// Summary
console.log('═══════════════════════════════════════════════════');
console.log('Test Summary');
console.log('═══════════════════════════════════════════════════');
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);
console.log(`Total: ${testsPassed + testsFailed}`);
console.log('');

if (testsFailed === 0) {
  console.log('✓ All tests passed!');
  process.exit(0);
} else {
  console.log('✗ Some tests failed');
  process.exit(1);
}
