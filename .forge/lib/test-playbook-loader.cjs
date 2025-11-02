const { loadPlaybook, cachePlaybook } = require('./playbook-loader.cjs');

async function runTests() {
  console.log('🧪 Testing Playbook Selective Loader\n');
  
  let passed = 0;
  
  // Test 1: Load with no triggers (only always_load)
  try {
    console.log('Test 1: Load always-load chunks only...');
    const result = await loadPlaybook({ triggers: [] });
    
    const alwaysLoadCount = result.chunks.filter(c => c.priority === 'always_load').length;
    console.log(`  Loaded: ${result.chunks.length} chunks`);
    console.log(`  Always-load: ${alwaysLoadCount}`);
    console.log(`  Tokens used: ${result.manifest.tokens_used}/${result.manifest.token_budget}`);
    
    if (alwaysLoadCount >= 5) {
      console.log('  ✅ Correct number of always-load chunks\n');
      passed++;
    } else {
      console.log(`  ❌ Expected ≥5 always-load chunks, got ${alwaysLoadCount}\n`);
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 2: Load with triggers
  try {
    console.log('Test 2: Load with deployment triggers...');
    const result = await loadPlaybook({ 
      triggers: ['deploy', 'vercel', 'webhook'] 
    });
    
    const hasDeploy = result.chunks.some(c => c.id === '08_deployment_chains');
    console.log(`  Loaded: ${result.chunks.length} chunks`);
    console.log(`  Has deployment chunk: ${hasDeploy}`);
    console.log(`  Tokens used: ${result.manifest.tokens_used}/${result.manifest.token_budget}`);
    
    if (hasDeploy) {
      console.log('  ✅ Deployment chunk loaded correctly\n');
      passed++;
    } else {
      console.log('  ❌ Deployment chunk should be loaded\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 3: Dependency resolution
  try {
    console.log('Test 3: Dependency resolution...');
    const result = await loadPlaybook({ 
      triggers: ['error', 'incident', 'dlq']
    });
    
    const hasErrorHandling = result.chunks.some(c => c.id === '09_error_handling');
    const hasDurability = result.chunks.some(c => c.id === '04_durability_layer');
    
    console.log(`  Loaded: ${result.chunks.length} chunks`);
    console.log(`  Has error handling: ${hasErrorHandling}`);
    console.log(`  Has durability (dependency): ${hasDurability}`);
    
    if (hasErrorHandling && hasDurability) {
      console.log('  ✅ Dependencies resolved correctly\n');
      passed++;
    } else {
      console.log('  ❌ Dependencies not resolved\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 4: Caching
  try {
    console.log('Test 4: Cache playbook...');
    const result = await loadPlaybook({ triggers: ['deploy'] });
    await cachePlaybook(result);
    
    const fs = require('fs').promises;
    const path = require('path');
    const cachePath = path.join(__dirname, '..', '_cache', 'playbook_session.json');
    const exists = await fs.access(cachePath).then(() => true).catch(() => false);
    
    if (exists) {
      console.log('  ✅ Cache file created\n');
      passed++;
    } else {
      console.log('  ❌ Cache file not created\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 5: Token budget enforcement
  try {
    console.log('Test 5: Token budget enforcement...');
    const result = await loadPlaybook({ 
      triggers: ['deploy', 'webhook', 'error', 'incident', 'map', 'edit'],
      maxTokens: 5000 // Very restrictive
    });
    
    console.log(`  Loaded: ${result.chunks.length} chunks`);
    console.log(`  Tokens used: ${result.manifest.tokens_used}/${result.manifest.token_budget}`);
    
    if (result.manifest.tokens_used <= 5000) {
      console.log('  ✅ Budget respected\n');
      passed++;
    } else {
      console.log('  ❌ Budget exceeded\n');
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
