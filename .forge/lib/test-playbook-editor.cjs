const { PlaybookEditor } = require('./playbook-editor.cjs');
const fs = require('fs').promises;
const path = require('path');

async function runTests() {
  console.log('🧪 Testing Playbook Editor\n');
  
  const editor = new PlaybookEditor();
  let passed = 0;
  
  // Test 1: Read chunk
  try {
    console.log('Test 1: Read chunk...');
    const chunk = await editor.readChunk('01_viewing_stages');
    
    console.log(`  Chunk ID: ${chunk.id}`);
    console.log(`  File: ${chunk.file}`);
    console.log(`  Content length: ${chunk.content.length} chars`);
    console.log(`  Hash: ${chunk.hash}`);
    
    if (chunk.content.includes('Progressive Disclosure')) {
      console.log('  ✅ Chunk read successfully\n');
      passed++;
    } else {
      console.log('  ❌ Unexpected content\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 2: Validate markdown
  try {
    console.log('Test 2: Markdown validation...');
    
    const valid = editor.validateMarkdown('# Test\n\nContent here');
    const invalid1 = editor.validateMarkdown('');
    const invalid2 = editor.validateMarkdown('No headers here');
    
    console.log(`  Valid markdown: ${valid}`);
    console.log(`  Empty string: ${invalid1}`);
    console.log(`  No headers: ${invalid2}`);
    
    if (valid && !invalid1 && !invalid2) {
      console.log('  ✅ Validation working correctly\n');
      passed++;
    } else {
      console.log('  ❌ Validation failed\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 3: Plan gate detection
  try {
    console.log('Test 3: Plan gate detection...');
    
    const singleFile = { files: [{ path: 'test.md', action: 'modify' }] };
    const multiFile = { files: [
      { path: 'test1.md', action: 'modify' },
      { path: 'test2.md', action: 'modify' }
    ]};
    const schemaFile = { files: [{ path: '.forge/_schema/test.json', action: 'modify' }] };
    
    const needsGate1 = editor.needsPlanGate(singleFile);
    const needsGate2 = editor.needsPlanGate(multiFile);
    const needsGate3 = editor.needsPlanGate(schemaFile);
    
    console.log(`  Single file: ${needsGate1} (should be false)`);
    console.log(`  Multiple files: ${needsGate2} (should be true)`);
    console.log(`  Schema change: ${needsGate3} (should be true)`);
    
    if (!needsGate1 && needsGate2 && needsGate3) {
      console.log('  ✅ Plan gate logic correct\n');
      passed++;
    } else {
      console.log('  ❌ Plan gate logic failed\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 4: Generate draft plan
  try {
    console.log('Test 4: Generate draft plan...');
    
    const changes = {
      intent: 'Test playbook updates',
      files: [
        { path: 'playbooks/chunks/01_viewing_stages.md', action: 'modify' },
        { path: 'playbooks/manifest.json', action: 'modify' }
      ],
      operations: [
        { verb: 'read_chunk', params: '01_viewing_stages' },
        { verb: 'update_chunk', params: '01_viewing_stages, newContent' }
      ],
      safetyChecks: [
        { description: 'Markdown structure valid', passed: true },
        { description: 'Cross-references intact', passed: true }
      ],
      warnings: ['This is a test warning']
    };
    
    const { planPath, plan } = await editor.generateDraftPlan(changes);
    
    console.log(`  Plan generated: ${planPath}`);
    console.log(`  Plan includes intent: ${plan.includes('Test playbook updates')}`);
    console.log(`  Plan includes files: ${plan.includes('Modified Files')}`);
    
    // Verify file exists
    const exists = await fs.access(planPath).then(() => true).catch(() => false);
    
    if (exists && plan.includes('DRAFT PLAN')) {
      console.log('  ✅ Draft plan generated\n');
      
      // Cleanup
      await fs.unlink(planPath);
      passed++;
    } else {
      console.log('  ❌ Draft plan generation failed\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 5: Update chunk (safe test - revert immediately)
  try {
    console.log('Test 5: Update chunk with revert...');
    
    const originalChunk = await editor.readChunk('01_viewing_stages');
    const originalContent = originalChunk.content;
    const originalHash = originalChunk.hash;
    
    // Add a comment at the end
    const testContent = originalContent + '\n<!-- Test comment -->';
    
    // Update
    const updateResult = await editor.updateChunk('01_viewing_stages', testContent, 'Test update');
    console.log(`  Updated: ${updateResult.chunkId}`);
    console.log(`  New hash: ${updateResult.newHash}`);
    
    // Verify update
    const updatedChunk = await editor.readChunk('01_viewing_stages');
    const wasUpdated = updatedChunk.content.includes('Test comment');
    
    // Revert immediately
    await editor.updateChunk('01_viewing_stages', originalContent, 'Revert test update');
    
    // Verify revert
    const revertedChunk = await editor.readChunk('01_viewing_stages');
    const wasReverted = revertedChunk.hash === originalHash;
    
    console.log(`  Update successful: ${wasUpdated}`);
    console.log(`  Revert successful: ${wasReverted}`);
    
    if (wasUpdated && wasReverted) {
      console.log('  ✅ Update and revert successful\n');
      passed++;
    } else {
      console.log('  ❌ Update/revert failed\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  console.log(`\n📊 Results: ${passed}/5 passed`);
  return passed === 5;
}

if (require.main === module) {
  runTests().then(success => process.exit(success ? 0 : 1));
}

module.exports = { runTests };