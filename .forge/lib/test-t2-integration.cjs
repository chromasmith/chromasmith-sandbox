// T2 Integration Test - Full Pipeline
// Tests all three T2 systems working together

const { discover } = require('./nl-verb-discover.cjs');
const { generate } = require('./nl-playbook-generate.cjs');
const { scan } = require('./nl-reconcile-scan.cjs');
const { repair } = require('./nl-reconcile-repair.cjs');
const fs = require('fs').promises;
const path = require('path');

async function integrationTest() {
  console.log('🧪 T2 INTEGRATION TEST - Full Pipeline\n');
  console.log('=' .repeat(60));
  
  const startTime = Date.now();
  const results = {
    steps: [],
    passed: 0,
    failed: 0
  };
  
  // STEP 1: Natural Language → Verb Discovery
  console.log('\n📝 STEP 1: Natural Language Processing');
  console.log('-'.repeat(60));
  
  const nlRequest = "Handle critical system failures with incident tracking";
  console.log(`Input: "${nlRequest}"`);
  
  try {
    const discovery = await discover(nlRequest);
    console.log(`✅ Intent detected: ${discovery.analysis.intent}`);
    console.log(`   Confidence: ${discovery.analysis.confidence}`);
    console.log(`   Verbs identified: ${discovery.analysis.verbs.length}`);
    console.log(`   Sequence: ${discovery.analysis.verbs.join(' → ')}`);
    
    results.steps.push({
      step: 1,
      name: 'Verb Discovery',
      status: 'passed',
      data: discovery.analysis
    });
    results.passed++;
  } catch (err) {
    console.log(`❌ Verb discovery failed: ${err.message}`);
    results.steps.push({
      step: 1,
      name: 'Verb Discovery',
      status: 'failed',
      error: err.message
    });
    results.failed++;
    return results;
  }
  
  // STEP 2: Generate Playbook from Discovery
  console.log('\n🔨 STEP 2: Playbook Generation');
  console.log('-'.repeat(60));
  
  let generatedPlaybook;
  try {
    generatedPlaybook = await generate(nlRequest, {
      name: 'integration-test-playbook',
      dryRun: false
    });
    
    console.log(`✅ Playbook generated: ${generatedPlaybook.fileName}`);
    console.log(`   Path: ${generatedPlaybook.filePath}`);
    console.log(`   Verbs in template: ${generatedPlaybook.discovery.verbs.length}`);
    
    // Verify file was created
    const exists = await fs.access(generatedPlaybook.filePath)
      .then(() => true)
      .catch(() => false);
    
    if (!exists) {
      throw new Error('Playbook file was not created on disk');
    }
    
    console.log('   File verified on disk ✓');
    
    results.steps.push({
      step: 2,
      name: 'Playbook Generation',
      status: 'passed',
      data: {
        fileName: generatedPlaybook.fileName,
        verbCount: generatedPlaybook.discovery.verbs.length
      }
    });
    results.passed++;
  } catch (err) {
    console.log(`❌ Playbook generation failed: ${err.message}`);
    results.steps.push({
      step: 2,
      name: 'Playbook Generation',
      status: 'failed',
      error: err.message
    });
    results.failed++;
    return results;
  }
  
  // STEP 3: Execute Generated Playbook
  console.log('\n▶️  STEP 3: Playbook Execution');
  console.log('-'.repeat(60));
  
  try {
    const playbookModule = require(generatedPlaybook.filePath);
    
    if (!playbookModule.runTests) {
      throw new Error('Generated playbook missing runTests() function');
    }
    
    console.log('   Running generated playbook tests...');
    const testResult = await playbookModule.runTests();
    
    if (testResult) {
      console.log('✅ Generated playbook executed successfully');
      results.steps.push({
        step: 3,
        name: 'Playbook Execution',
        status: 'passed'
      });
      results.passed++;
    } else {
      throw new Error('Playbook tests returned false');
    }
  } catch (err) {
    console.log(`❌ Playbook execution failed: ${err.message}`);
    results.steps.push({
      step: 3,
      name: 'Playbook Execution',
      status: 'failed',
      error: err.message
    });
    results.failed++;
  }
  
  // STEP 4: System Reconciliation Scan
  console.log('\n🔍 STEP 4: System Reconciliation');
  console.log('-'.repeat(60));
  
  try {
    const scanResult = await scan({ mode: 'full' });
    
    console.log(`✅ System scan completed`);
    console.log(`   Total issues: ${scanResult.summary.total}`);
    console.log(`   High severity: ${scanResult.summary.high}`);
    console.log(`   Auto-fixable: ${scanResult.summary.auto_fixable}`);
    
    if (scanResult.summary.high > 0) {
      console.log('   ⚠️  High severity issues detected');
    }
    
    results.steps.push({
      step: 4,
      name: 'Reconciliation Scan',
      status: 'passed',
      data: scanResult.summary
    });
    results.passed++;
    
    // STEP 5: Auto-repair if needed
    if (scanResult.summary.auto_fixable > 0) {
      console.log('\n🔧 STEP 5: Auto-Repair');
      console.log('-'.repeat(60));
      
      const repairResult = await repair(scanResult, {
        dryRun: false,
        autoFix: true,
        confidenceThreshold: 0.9
      });
      
      console.log(`✅ Repair completed`);
      console.log(`   Attempted: ${repairResult.attempted}`);
      console.log(`   Succeeded: ${repairResult.succeeded}`);
      console.log(`   Failed: ${repairResult.failed}`);
      console.log(`   Skipped: ${repairResult.skipped}`);
      
      results.steps.push({
        step: 5,
        name: 'Auto-Repair',
        status: 'passed',
        data: {
          attempted: repairResult.attempted,
          succeeded: repairResult.succeeded
        }
      });
      results.passed++;
    } else {
      console.log('\n✨ STEP 5: Auto-Repair');
      console.log('-'.repeat(60));
      console.log('   No repairs needed - system is healthy!');
      
      results.steps.push({
        step: 5,
        name: 'Auto-Repair',
        status: 'skipped',
        reason: 'No auto-fixable issues found'
      });
    }
  } catch (err) {
    console.log(`❌ Reconciliation failed: ${err.message}`);
    results.steps.push({
      step: 4,
      name: 'Reconciliation Scan',
      status: 'failed',
      error: err.message
    });
    results.failed++;
  }
  
  // CLEANUP: Remove test playbook
  console.log('\n🧹 CLEANUP');
  console.log('-'.repeat(60));
  
  try {
    if (generatedPlaybook && generatedPlaybook.filePath) {
      await fs.unlink(generatedPlaybook.filePath);
      console.log(`   Removed test playbook: ${generatedPlaybook.fileName}`);
    }
  } catch (err) {
    console.log(`   ⚠️  Cleanup warning: ${err.message}`);
  }
  
  // FINAL REPORT
  const elapsed = Date.now() - startTime;
  console.log('\n' + '='.repeat(60));
  console.log('📊 INTEGRATION TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`Total Steps: ${results.steps.length}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Duration: ${elapsed}ms`);
  console.log('='.repeat(60));
  
  const allPassed = results.failed === 0;
  if (allPassed) {
    console.log('\n✅ INTEGRATION TEST PASSED - Full T2 pipeline operational!\n');
  } else {
    console.log('\n❌ INTEGRATION TEST FAILED - See errors above\n');
  }
  
  return allPassed;
}

if (require.main === module) {
  integrationTest().then(success => process.exit(success ? 0 : 1));
}

module.exports = { integrationTest };