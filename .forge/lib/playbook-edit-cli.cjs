// Playbook Editor CLI Interface
// Provides command-line interface for editing playbooks

const { PlaybookEditor } = require('./playbook-editor.cjs');
const readline = require('readline');

const editor = new PlaybookEditor();

async function editChunk(chunkId, editFn, reason) {
  try {
    const chunk = await editor.readChunk(chunkId);
    console.log(`\n📝 Editing chunk: ${chunkId}`);
    console.log(`   Current hash: ${chunk.hash}`);
    
    // Apply edit function
    const newContent = await editFn(chunk.content);
    
    // Show diff preview
    console.log(`\n📊 Changes preview:`);
    console.log(`   Old length: ${chunk.content.length} chars`);
    console.log(`   New length: ${newContent.length} chars`);
    console.log(`   Reason: ${reason}`);
    
    // Update chunk
    const result = await editor.updateChunk(chunkId, newContent, reason);
    console.log(`\n✅ Chunk updated successfully`);
    console.log(`   New hash: ${result.newHash}`);
    
    return result;
  } catch (err) {
    console.error(`\n❌ Edit failed: ${err.message}`);
    throw err;
  }
}

async function batchEdit(changes) {
  console.log(`\n🔄 Batch edit: ${changes.files.length} files`);
  
  // Check if plan gate needed
  if (editor.needsPlanGate(changes)) {
    console.log(`\n⚠️  Plan gate required (multiple files or sensitive changes)`);
    
    // Generate draft plan
    const { planPath, plan } = await editor.generateDraftPlan(changes);
    console.log(`\n📋 Draft plan generated:`);
    console.log(plan);
    console.log(`\n   Saved to: ${planPath}`);
    
    // Request approval
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const approved = await new Promise(resolve => {
      rl.question('\nApprove plan? (yes/no): ', answer => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes');
      });
    });
    
    if (!approved) {
      console.log('\n❌ Plan rejected - no changes made');
      return { approved: false };
    }
    
    // Execute plan
    const result = await editor.executePlan(planPath, true);
    console.log(`\n✅ Plan executed and archived`);
    return { approved: true, result };
  } else {
    // Single file edit - no plan gate needed
    console.log(`\n✅ Single file edit - no plan gate required`);
    return { approved: true, direct: true };
  }
}

module.exports = { editChunk, batchEdit };