/**
 * Tests for Health Check System
 * Forge Flow 6.4 - T3.6
 */

const {
  HealthStatus,
  HealthCheckResult,
  ServiceHealthChecker,
  HealthCheckManager
} = require('./health-check.cjs');

(async () => {
  console.log('🧪 Testing Health Check System...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: HealthCheckResult creation
  try {
    const result = new HealthCheckResult('test-service', HealthStatus.HEALTHY, {
      responseTime: 100
    });
    
    if (!result.isHealthy()) throw new Error('Should be healthy');
    if (result.isDegraded()) throw new Error('Should not be degraded');
    if (result.isUnhealthy()) throw new Error('Should not be unhealthy');
    if (result.responseTime !== 100) throw new Error('Wrong response time');
    
    console.log('​✅ Test 1: HealthCheckResult creation');
    passed++;
  } catch (err) {
    console.log('❌ Test 1: HealthCheckResult creation -', err.message);
    failed++;
  }
  
  // Test 2: ServiceHealthChecker - successful check
  try {
    const checker = new ServiceHealthChecker(
      'test-service',
      async () => ({ ok: true }),
      { healthyThreshold: 1 }
    );
    
    const result = await checker.check();
    
    if (!result.isHealthy()) throw new Error('Should be healthy');
    if (checker.consecutiveFailures !== 0) throw new Error('Should have no failures');
    if (checker.consecutiveSuccesses !== 1) throw new Error('Should have 1 success');
    
    console.log('✅ Test 2: ServiceHealthChecker successful check');
    passed++;
  } catch (err) {
    console.log('❌ Test 2: ServiceHealthChecker successful check -', err.message);
    failed++;
  }
  
  // Test 3: ServiceHealthChecker - failed check
  try {
    const checker = new ServiceHealthChecker(
      'test-service',
      async () => { throw new Error('Check failed'); },
      { unhealthyThreshold: 2 }
    );
    
    await checker.check();
    if (!checker.isDegraded()) throw new Error('Should be degraded after 1 failure');
    
    await checker.check();
    if (!checker.isUnhealthy()) throw new Error('Should be unhealthy after 2 failures');
    if (checker.consecutiveFailures !== 2) throw new Error('Should have 2 failures');
    
    console.log('✅ Test 3: ServiceHealthChecker failed check');
    passed++;
  } catch (err) {
    console.log('❌ Test 3: ServiceHealthChecker failed check -', err.message);
    failed++;
  }
  
  // Test 4: ServiceHealthChecker - timeout
  try {
    const checker = new ServiceHealthChecker(
      'test-service',
      async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { ok: true };
      },
      { timeout: 50 }
    );
    
    const result = await checker.check();
    
    if (!result.details.error) throw new Error('Should have error');
    if (!result.details.error.includes('TIMEOUT')) throw new Error('Should timeout');
    
    console.log('✅ Test 4: ServiceHealthChecker timeout');
    passed++;
  } catch (err) {
    console.log('❌ Test 4: ServiceHealthChecker timeout -', err.message);
    failed++;
  }
  
  // Test 5: ServiceHealthChecker - needs restart
  try {
    const checker = new ServiceHealthChecker(
      'test-service',
      async () => { throw new Error('Failed'); },
      { unhealthyThreshold: 1, autoRestart: true }
    );
    
    await checker.check();
    
    if (!checker.needsRestart()) throw new Error('Should need restart');
    
    console.log('✅ Test 5: ServiceHealthChecker needs restart');
    passed++;
  } catch (err) {
    console.log('❌ Test 5: ServiceHealthChecker needs restart -', err.message);
    failed++;
  }
  
  // Test 6: ServiceHealthChecker - restart cooldown
  try {
    const checker = new ServiceHealthChecker(
      'test-service',
      async () => { throw new Error('Failed'); },
      { unhealthyThreshold: 1, autoRestart: true, restartCooldown: 5000 }
    );
    
    await checker.check();
    
    if (!checker.needsRestart()) throw new Error('Should need restart');
    
    checker.markRestarted();
    
    if (checker.needsRestart()) throw new Error('Should be in cooldown');
    if (checker.restartCount !== 1) throw new Error('Should have 1 restart');
    
    console.log('✅ Test 6: ServiceHealthChecker restart cooldown');
    passed++;
  } catch (err) {
    console.log('❌ Test 6: ServiceHealthChecker restart cooldown -', err.message);
    failed++;
  }
  
  // Test 7: HealthCheckManager - register service
  try {
    const manager = new HealthCheckManager();
    
    manager.register('test-service', async () => ({ ok: true }));
    
    if (!manager.services.has('test-service')) throw new Error('Service not registered');
    
    console.log('✅ Test 7: HealthCheckManager register service');
    passed++;
  } catch (err) {
    console.log('❌ Test 7: HealthCheckManager register service -', err.message);
    failed++;
  }
  
  // Test 8: HealthCheckManager - check all
  try {
    const manager = new HealthCheckManager({ healthyThreshold: 1 });
    
    manager.register('service1', async () => ({ ok: true }));
    manager.register('service2', async () => ({ ok: true }));
    
    const results = await manager.checkAll();
    
    if (results.length !== 2) throw new Error('Should have 2 results');
    if (!results[0].isHealthy()) throw new Error('Service1 should be healthy');
    if (!results[1].isHealthy()) throw new Error('Service2 should be healthy');
    
    console.log('✅ Test 8: HealthCheckManager check all');
    passed++;
  } catch (err) {
    console.log('❌ Test 8: HealthCheckManager check all -', err.message);
    failed++;
  }
  
  // Test 9: HealthCheckManager - aggregate status (FIXED: disable auto-restart)
  try {
    const manager = new HealthCheckManager({ 
      healthyThreshold: 1,
      unhealthyThreshold: 1,
      autoRestart: false  // Disable auto-restart for this test
    });
    
    manager.register('healthy-service', async () => ({ ok: true }));
    manager.register('unhealthy-service', async () => { throw new Error('Failed'); });
    
    await manager.checkAll();
    
    const status = manager.getAggregateStatus();
    
    if (status.total !== 2) throw new Error('Should have 2 services');
    if (status.healthy !== 1) throw new Error('Should have 1 healthy');
    if (status.unhealthy !== 1) throw new Error('Should have 1 unhealthy');
    if (status.status !== HealthStatus.UNHEALTHY) throw new Error('Overall should be unhealthy');
    
    console.log('✅ Test 9: HealthCheckManager aggregate status');
    passed++;
  } catch (err) {
    console.log('❌ Test 9: HealthCheckManager aggregate status -', err.message);
    failed++;
  }
  
  // Test 10: HealthCheckManager - restart handler
  try {
    const manager = new HealthCheckManager({
      unhealthyThreshold: 1,
      autoRestart: true
    });
    
    let restarted = false;
    
    manager.register('failing-service', async () => { 
      throw new Error('Failed'); 
    });
    
    manager.onRestart('failing-service', async () => {
      restarted = true;
    });
    
    await manager.checkAll();
    
    if (!restarted) throw new Error('Should have called restart handler');
    
    console.log('✅ Test 10: HealthCheckManager restart handler');
    passed++;
  } catch (err) {
    console.log('❌ Test 10: HealthCheckManager restart handler -', err.message);
    failed++;
  }
  
  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Passed: ${passed}/10`);
  console.log(`❌ Failed: ${failed}/10`);
  console.log(`${'='.repeat(50)}`);
  
  if (failed > 0) {
    process.exit(1);
  }
  
})();
