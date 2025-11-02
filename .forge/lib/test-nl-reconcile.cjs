const { scan } = require('./nl-reconcile-scan.cjs');
const { repair } = require('./nl-reconcile-repair.cjs');
const fs = require('fs').promises;
const path = require('path');

async function runTests() {
  console.log('🧪 Testing NL Reconciliation System\n');
  
  let passed = 0;
  
  // Test 1: Scan basic structure
  try {
    console.log('Test 1: Scanning .forge/ structure...');
    const scanResult = await scan({ mode: 'quick' });
    
    console.log(`  Total issues found: ${scanResult.summary.total}`);
    console.log(`  High severity: ${scanResult.summary.high}`);
    console.log(`  Auto-fixable: ${scanResult.summary.auto_fixable}`);
    console.log('  ✅ Scan completed\n');
    passed++;
  } catch (err) {
    console.log(`  ❌ Scan failed: ${err.message}\n`);
  }
  
  // Test 2: Full scan
  try {
    console.log('Test 2: Full system scan...');
    const fullScan = await scan({ mode: 'full' });
    
    console.log(`  Issues by severity:`);
    console.log(`    High: ${fullScan.summary.high}`);
    console.log(`    Medium: ${fullScan.summary.medium}`);
    console.log(`    Low: ${fullScan.summary.low}`);
    console.log('  ✅ Full scan completed\n');
    passed++;
  } catch (err) {
    console.log(`  ❌ Full scan failed: ${err.message}\n`);
  }
  
  // Test 3: Dry-run repair
  try {
    console.log('Test 3: Dry-run repair simulation...');
    const scanResult = await scan({ mode: 'quick' });
    const repairResult = await repair(scanResult, { dryRun: true, autoFix: true });
    
    console.log(`  Would attempt: ${repairResult.attempted || 0} repairs`);
    console.log(`  Would skip: ${repairResult.skipped} low-confidence issues`);
    console.log('  ✅ Dry-run completed\n');
    passed++;
  } catch (err) {
    console.log(`  ❌ Dry-run failed: ${err.message}\n`);
  }
  
  // Test 4: Create and repair test issue
  try {
    console.log('Test 4: Testing actual repair...');
    const testDir = path.join(__dirname, '..', '_test_reconcile_temp');
    
    // Create test issue (missing directory)
    const testIssue = {
      issues: [{
        type: 'missing_directory',
        severity: 'high',
        path: '_test_reconcile_temp',
        fix: 'create_directory',
        confidence: 1.0
      }]
    };
    
    // Repair it
    const repairResult = await repair(testIssue, { dryRun: false, autoFix: true });
    
    // Verify repair worked
    const exists = await fs.access(testDir).then(() => true).catch(() => false);
    
    if (exists) {
      console.log('  ✅ Directory created successfully');
      // Cleanup
      await fs.rmdir(testDir);
      console.log('  🧹 Test directory cleaned up\n');
      passed++;
    } else {
      console.log('  ❌ Repair did not create directory\n');
    }
  } catch (err) {
    console.log(`  ❌ Repair test failed: ${err.message}\n`);
  }
  
  console.log(`\n📊 Results: ${passed}/4 passed`);
  return passed === 4;
}

if (require.main === module) {
  runTests().then(success => process.exit(success ? 0 : 1));
}

module.exports = { runTests };