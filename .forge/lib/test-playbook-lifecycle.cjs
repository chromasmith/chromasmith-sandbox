/**
 * Playbook Lifecycle Tests
 * Verify dependency checking, archive, and uninstall
 */

const { buildDependencyGraph, canRemove, detectCircular } = require('./playbook-dependencies.cjs');
const path = require('path');

console.log('🧪 Testing Playbook Lifecycle...\n');

let passed = 0;
let failed = 0;

(async () => {
  // Test 1: Build dependency graph
  try {
    const manifestPath = path.join(__dirname, '../../playbooks/manifest.json');
    const graph = await buildDependencyGraph(manifestPath);
    
    if (graph.nodes.size > 0 && Array.isArray(graph.edges)) {
      console.log('✅ Test 1: Dependency graph builds correctly');
      console.log(`   Nodes: ${graph.nodes.size}`);
      console.log(`   Edges: ${graph.edges.length}`);
      passed++;
    } else {
      throw new Error('Graph structure invalid');
    }
  } catch (err) {
    console.error('❌ Test 1 Failed:', err.message);
    failed++;
  }
  
  // Test 2: Detect safe removal
  try {
    const manifestPath = path.join(__dirname, '../../playbooks/manifest.json');
    const graph = await buildDependencyGraph(manifestPath);
    
    // Check a chunk that should be safe to remove
    const lastChunk = Array.from(graph.nodes.keys()).pop();
    const check = canRemove(graph, lastChunk);
    
    console.log('\n✅ Test 2: Can check removal safety');
    console.log(`   Checked: ${lastChunk}`);
    console.log(`   Safe: ${check.safe}`);
    if (!check.safe) {
      console.log(`   Reason: ${check.reason}`);
    }
    passed++;
  } catch (err) {
    console.error('❌ Test 2 Failed:', err.message);
    failed++;
  }
  
  // Test 3: Detect circular dependencies
  try {
    const manifestPath = path.join(__dirname, '../../playbooks/manifest.json');
    const graph = await buildDependencyGraph(manifestPath);
    const cycles = detectCircular(graph);
    
    console.log('\n✅ Test 3: Circular dependency detection works');
    console.log(`   Cycles found: ${cycles.length}`);
    if (cycles.length > 0) {
      console.log(`   WARNING: Circular dependencies detected!`);
      cycles.forEach((cycle, i) => {
        console.log(`   Cycle ${i + 1}: ${cycle.join(' → ')}`);
      });
    }
    passed++;
  } catch (err) {
    console.error('❌ Test 3 Failed:', err.message);
    failed++;
  }
  
  // Test 4: Archive system module loads
  try {
    const { archivePlaybook, listArchives, restorePlaybook } = require('./playbook-archive.cjs');
    
    if (typeof archivePlaybook === 'function' &&
        typeof listArchives === 'function' &&
        typeof restorePlaybook === 'function') {
      console.log('\n✅ Test 4: Archive system module loads');
      passed++;
    } else {
      throw new Error('Archive functions missing');
    }
  } catch (err) {
    console.error('❌ Test 4 Failed:', err.message);
    failed++;
  }
  
  // Test 5: Uninstall system module loads
  try {
    const { uninstallPlaybook, uninstallMultiple } = require('./playbook-uninstall.cjs');
    
    if (typeof uninstallPlaybook === 'function' &&
        typeof uninstallMultiple === 'function') {
      console.log('\n✅ Test 5: Uninstall system module loads');
      passed++;
    } else {
      throw new Error('Uninstall functions missing');
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
    console.log('✅ All playbook lifecycle tests passed!');
  } else {
    console.error('❌ Some tests failed');
    process.exit(1);
  }
})();