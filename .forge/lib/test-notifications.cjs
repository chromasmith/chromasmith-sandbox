const { NotificationManager } = require('./notifications.cjs');
const fs = require('fs').promises;

async function runTests() {
  console.log('🧪 Testing Notification Policy System\n');
  
  const manager = new NotificationManager();
  let passed = 0;
  
  // Clean up queue before tests
  try {
    await fs.unlink(manager.queuePath);
  } catch {}
  
  // Test 1: Load config
  try {
    console.log('Test 1: Load notifications config...');
    const config = await manager.loadConfig();
    
    console.log(`  Version: ${config.version}`);
    console.log(`  Aggregation enabled: ${config.aggregation.enabled}`);
    console.log(`  Rules defined: ${config.rules.length}`);
    console.log(`  Channels: ${Object.keys(config.channels).join(', ')}`);
    
    if (config.version === '1.0' && config.rules.length > 0) {
      console.log('  ✅ Config loaded successfully\n');
      passed++;
    } else {
      console.log('  ❌ Config invalid\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 2: Immediate notification
  try {
    console.log('Test 2: Immediate notification (critical incident)...');
    
    const event = {
      type: 'incident.critical',
      message: 'Database connection lost',
      severity: 'critical',
      data: { service: 'postgres' }
    };
    
    const result = await manager.notify(event);
    
    console.log(`  Sent immediately: ${result.immediate}`);
    console.log(`  Channels: ${result.channels?.join(', ')}`);
    
    if (result.sent && result.immediate) {
      console.log('  ✅ Immediate notification sent\n');
      passed++;
    } else {
      console.log('  ❌ Immediate notification failed\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 3: Aggregated notification (queued)
  try {
    console.log('Test 3: Aggregated notification (queued)...');
    
    const event = {
      type: 'incident.high',
      message: 'API timeout',
      severity: 'high',
      data: { endpoint: '/api/users' }
    };
    
    const result = await manager.notify(event);
    
    console.log(`  Queued: ${result.queued}`);
    console.log(`  Window: ${result.window}`);
    console.log(`  Immediate: ${result.immediate}`);
    
    if (result.queued && !result.immediate) {
      console.log('  ✅ Notification queued for aggregation\n');
      passed++;
    } else {
      console.log('  ❌ Aggregation queueing failed\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 4: Queue status
  try {
    console.log('Test 4: Queue status check...');
    
    const status = await manager.getQueueStatus();
    
    console.log(`  Total queued: ${status.total_queued}`);
    console.log(`  Windows tracked: ${Object.keys(status.windows).length}`);
    
    if (status.total_queued > 0) {
      console.log('  ✅ Queue status working\n');
      passed++;
    } else {
      console.log('  ❌ Queue empty (expected at least 1)\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 5: Window flushing
  try {
    console.log('Test 5: Force flush aggregation window...');
    
    // Add more events to reach max_count
    for (let i = 0; i < 5; i++) {
      await manager.notify({
        type: 'incident.high',
        message: `Test incident ${i}`,
        severity: 'high'
      });
    }
    
    // Flush the incidents window (force=true for testing)
    const flushResult = await manager.flushWindow('incidents', { force: true });
    
    console.log(`  Flushed: ${flushResult.flushed} notifications`);
    console.log(`  Window: ${flushResult.window}`);
    
    // Check queue is now empty for that window
    const statusAfter = await manager.getQueueStatus();
    const incidentsCount = statusAfter.windows.incidents.count;
    
    console.log(`  Incidents remaining: ${incidentsCount}`);
    
    if (flushResult.flushed > 0 && incidentsCount === 0) {
      console.log('  ✅ Window flushing working\n');
      passed++;
    } else {
      console.log('  ❌ Window flushing failed\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Cleanup
  try {
    await fs.unlink(manager.queuePath);
  } catch {}
  
  console.log(`\n📊 Results: ${passed}/5 passed`);
  return passed === 5;
}

if (require.main === module) {
  runTests().then(success => process.exit(success ? 0 : 1));
}

module.exports = { runTests };
