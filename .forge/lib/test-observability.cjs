/**
 * Tests for Observability Layer
 * Forge Flow 6.4 - T3.4
 */

const fs = require('fs');
const path = require('path');
const { Logger, LogLevel, getLogger } = require('./logger.cjs');
const { MetricsRegistry, MetricType, getMetrics } = require('./metrics.cjs');

// Test log directory
const TEST_LOG_DIR = '.forge/logs_test';

// Cleanup helper
function cleanup() {
  try {
    if (fs.existsSync(TEST_LOG_DIR)) {
      fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true });
    }
  } catch (error) {
    // Ignore
  }
}

// Test suite
(async () => {
  console.log('🧪 Testing Observability Layer...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Cleanup before tests
  cleanup();
  
  // Test 1: Logger - Basic logging
  try {
    const logger = new Logger({
      level: LogLevel.DEBUG,
      enableConsole: false,
      enableFile: false
    });
    
    // Should not throw
    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warn message');
    logger.error('Error message');
    logger.fatal('Fatal message');
    
    console.log('✅ Test 1: Logger basic logging');
    passed++;
  } catch (err) {
    console.log('❌ Test 1: Logger basic logging -', err.message);
    failed++;
  }
  
  // Test 2: Logger - Context
  try {
    const logger = new Logger({ enableConsole: false, enableFile: false });
    
    logger.setContext({ service: 'test', version: '1.0' });
    
    // Create child with additional context
    const child = logger.child({ requestId: '123' });
    
    if (!child.context.service) throw new Error('Missing parent context');
    if (!child.context.requestId) throw new Error('Missing child context');
    
    console.log('✅ Test 2: Logger context and child');
    passed++;
  } catch (err) {
    console.log('❌ Test 2: Logger context and child -', err.message);
    failed++;
  }
  
  // Test 3: Logger - Correlation ID
  try {
    const logger = new Logger({ enableConsole: false, enableFile: false });
    
    logger.setCorrelationId('corr-123');
    
    if (logger.correlationId !== 'corr-123') throw new Error('Correlation ID not set');
    
    logger.clearCorrelationId();
    
    if (logger.correlationId !== null) throw new Error('Correlation ID not cleared');
    
    console.log('✅ Test 3: Logger correlation ID');
    passed++;
  } catch (err) {
    console.log('❌ Test 3: Logger correlation ID -', err.message);
    failed++;
  }
  
  // Test 4: Logger - File output
  try {
    const logger = new Logger({
      level: LogLevel.INFO,
      enableConsole: false,
      enableFile: true,
      logDir: TEST_LOG_DIR
    });
    
    logger.info('Test log message', { foo: 'bar' });
    
    const logFile = path.join(TEST_LOG_DIR, 'forge-flow.log');
    if (!fs.existsSync(logFile)) throw new Error('Log file not created');
    
    const content = fs.readFileSync(logFile, 'utf8');
    if (!content.includes('Test log message')) throw new Error('Log message not found');
    if (!content.includes('INFO')) throw new Error('Log level not found');
    
    console.log('✅ Test 4: Logger file output');
    passed++;
  } catch (err) {
    console.log('❌ Test 4: Logger file output -', err.message);
    failed++;
  }
  
  // Test 5: Metrics - Counter
  try {
    const metrics = new MetricsRegistry();
    
    metrics.increment('test_counter');
    metrics.increment('test_counter');
    metrics.increment('test_counter', {}, 3);
    
    const all = metrics.getAll();
    if (all.test_counter.value !== 5) {
      throw new Error(`Expected 5, got ${all.test_counter.value}`);
    }
    
    console.log('✅ Test 5: Metrics counter');
    passed++;
  } catch (err) {
    console.log('❌ Test 5: Metrics counter -', err.message);
    failed++;
  }
  
  // Test 6: Metrics - Gauge
  try {
    const metrics = new MetricsRegistry();
    
    metrics.set('test_gauge', {}, 42);
    metrics.set('test_gauge', {}, 100);
    
    const all = metrics.getAll();
    if (all.test_gauge.value !== 100) {
      throw new Error(`Expected 100, got ${all.test_gauge.value}`);
    }
    
    console.log('✅ Test 6: Metrics gauge');
    passed++;
  } catch (err) {
    console.log('❌ Test 6: Metrics gauge -', err.message);
    failed++;
  }
  
  // Test 7: Metrics - Histogram
  try {
    const metrics = new MetricsRegistry();
    
    metrics.record('test_histogram', {}, 10);
    metrics.record('test_histogram', {}, 20);
    metrics.record('test_histogram', {}, 30);
    
    const all = metrics.getAll();
    const stats = all.test_histogram.value;
    
    if (stats.count !== 3) throw new Error('Wrong count');
    if (stats.min !== 10) throw new Error('Wrong min');
    if (stats.max !== 30) throw new Error('Wrong max');
    if (stats.avg !== 20) throw new Error('Wrong avg');
    
    console.log('✅ Test 7: Metrics histogram');
    passed++;
  } catch (err) {
    console.log('❌ Test 7: Metrics histogram -', err.message);
    failed++;
  }
  
  // Test 8: Metrics - Timer
  try {
    const metrics = new MetricsRegistry();
    
    const timer = metrics.startTimer('test_timer');
    
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const duration = timer();
    
    if (duration < 10) throw new Error('Duration too short');
    
    const all = metrics.getAll();
    if (all.test_timer.value.count !== 1) throw new Error('Timer not recorded');
    
    console.log('✅ Test 8: Metrics timer');
    passed++;
  } catch (err) {
    console.log('❌ Test 8: Metrics timer -', err.message);
    failed++;
  }
  
  // Test 9: Metrics - Labels
  try {
    const metrics = new MetricsRegistry();
    
    metrics.increment('test_labeled', { status: 'success' });
    metrics.increment('test_labeled', { status: 'failure' });
    metrics.increment('test_labeled', { status: 'success' });
    
    const all = metrics.getAll();
    
    if (!all.test_labeled.labels) throw new Error('Labels not found');
    
    const successLabel = Object.values(all.test_labeled.labels).find(
      l => l.labels.status === 'success'
    );
    const failureLabel = Object.values(all.test_labeled.labels).find(
      l => l.labels.status === 'failure'
    );
    
    if (successLabel.value !== 2) throw new Error('Wrong success count');
    if (failureLabel.value !== 1) throw new Error('Wrong failure count');
    
    console.log('✅ Test 9: Metrics with labels');
    passed++;
  } catch (err) {
    console.log('❌ Test 9: Metrics with labels -', err.message);
    failed++;
  }
  
  // Test 10: Prometheus export
  try {
    const metrics = new MetricsRegistry();
    
    metrics.increment('http_requests_total', { method: 'GET' }, 5);
    metrics.record('http_duration_ms', { method: 'GET' }, 100);
    
    const prometheus = metrics.exportPrometheus();
    
    if (!prometheus.includes('http_requests_total')) throw new Error('Missing counter');
    if (!prometheus.includes('http_duration_ms')) throw new Error('Missing histogram');
    if (!prometheus.includes('# HELP')) throw new Error('Missing help text');
    if (!prometheus.includes('# TYPE')) throw new Error('Missing type text');
    
    console.log('✅ Test 10: Prometheus export');
    passed++;
  } catch (err) {
    console.log('❌ Test 10: Prometheus export -', err.message);
    failed++;
  }
  
  // Cleanup after tests
  cleanup();
  
  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Passed: ${passed}/10`);
  console.log(`❌ Failed: ${failed}/10`);
  console.log(`${'='.repeat(50)}`);
  
  if (failed > 0) {
    process.exit(1);
  }
  
})();
