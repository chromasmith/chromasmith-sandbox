const { ChannelManager } = require('./forgeview-channels.cjs');
const fs = require('fs').promises;
const path = require('path');

async function runTests() {
  console.log('🧪 Testing ForgeView Two-Channel System\n');
  
  const manager = new ChannelManager();
  let passed = 0;
  
  // Clean up any existing state before tests
  try {
    await fs.unlink(manager.stateFile);
  } catch {}
  
  // Test 1: Initial state
  try {
    console.log('Test 1: Initial state...');
    const state = await manager.loadState();
    
    console.log(`  Channel 1 loaded: ${state.channels[1].loaded}`);
    console.log(`  Channel 2 loaded: ${state.channels[2].loaded}`);
    console.log(`  Focus: ${state.focus}`);
    
    if (state.channels[1].loaded === null && state.focus === 1) {
      console.log('  ✅ Default state correct\n');
      passed++;
    } else {
      console.log('  ❌ Default state incorrect\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 2: Load artifact to channel 1
  try {
    console.log('Test 2: Load artifact to channel 1...');
    const result = await manager.loadArtifact(1, 'components/HomePage.tsx', {
      component: 'HomePage',
      route: '/'
    });
    
    console.log(`  Loaded to channel: ${result.channel}`);
    console.log(`  Artifact: ${result.artifact}`);
    
    const info = await manager.getChannelInfo(1);
    console.log(`  Channel 1 state: ${info.state.loaded}`);
    
    if (info.state.loaded === 'components/HomePage.tsx') {
      console.log('  ✅ Artifact loaded successfully\n');
      passed++;
    } else {
      console.log('  ❌ Artifact not loaded\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 3: Smart routing
  try {
    console.log('Test 3: Smart routing...');
    
    const route1 = await manager.smartRoute('Show me the homepage');
    const route2 = await manager.smartRoute('Compare this with the old version');
    
    console.log(`  Primary request → Channel ${route1.channel}`);
    console.log(`  Comparison request → Channel ${route2.channel}`);
    
    if (route1.channel === 1 && route2.channel === 2) {
      console.log('  ✅ Smart routing working correctly\n');
      passed++;
    } else {
      console.log('  ❌ Smart routing failed\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 4: Conflict detection
  try {
    console.log('Test 4: Conflict detection...');
    
    // Load to channel 2
    await manager.loadArtifact(2, 'components/AboutPage.tsx');
    
    // Mark both dirty
    await manager.markDirty(1, 'Test modification');
    await manager.markDirty(2, 'Test modification');
    
    // Try to promote
    const canPromote = await manager.canPromote();
    
    console.log(`  Can promote: ${canPromote.allowed}`);
    console.log(`  Reason: ${canPromote.reason}`);
    console.log(`  Conflict detected: ${canPromote.conflict}`);
    
    if (!canPromote.allowed && canPromote.conflict) {
      console.log('  ✅ Conflict detection working\n');
      passed++;
    } else {
      console.log('  ❌ Conflict detection failed\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 5: Channel promotion (after clearing conflict)
  try {
    console.log('Test 5: Channel promotion...');
    
    // Clear conflict by clearing channel 1
    await manager.clearChannel(1);
    
    // Now promote should work
    const promoted = await manager.promoteChannel2ToChannel1();
    
    console.log(`  Promoted: ${promoted.promoted}`);
    console.log(`  Artifact: ${promoted.artifact}`);
    
    // Verify promotion
    const status = await manager.getStatus();
    const channel1HasContent = status.channels[0].loaded === 'components/AboutPage.tsx';
    const channel2Empty = status.channels[1].loaded === null;
    
    console.log(`  Channel 1 has promoted content: ${channel1HasContent}`);
    console.log(`  Channel 2 is empty: ${channel2Empty}`);
    
    if (promoted.promoted && channel1HasContent && channel2Empty) {
      console.log('  ✅ Promotion successful\n');
      passed++;
    } else {
      console.log('  ❌ Promotion failed\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Cleanup
  try {
    await fs.unlink(manager.stateFile);
  } catch {}
  
  console.log(`\n📊 Results: ${passed}/5 passed`);
  return passed === 5;
}

if (require.main === module) {
  runTests().then(success => process.exit(success ? 0 : 1));
}

module.exports = { runTests };