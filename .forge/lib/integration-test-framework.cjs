/**
 * Integration Test Framework for Forge Flow 6.4
 * End-to-end testing across all systems
 */

const { getLogger } = require('./logger.cjs');
const { getMetrics } = require('./metrics.cjs');
const { ForgeFlowError } = require('./error-taxonomy.cjs');
const { withRetry } = require('./retry-middleware.cjs');
const { registry } = require('./circuit-breaker.cjs');
const { getDLQManager } = require('./dlq-manager.cjs');
const { getDegradation } = require('./graceful-degradation.cjs');
const { getHealthCheck } = require('./health-check.cjs');

/**
 * Test result
 */
class TestResult {
  constructor(name, category, passed, duration, error = null) {
    this.name = name;
    this.category = category;
    this.passed = passed;
    this.duration = duration;
    this.error = error;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Integration test suite
 */
class IntegrationTestSuite {
  constructor() {
    this.tests = [];
    this.results = [];
    this.logger = getLogger({ enableConsole: true, enableFile: false });
    this.metrics = getMetrics();
  }
  
  /**
   * Register a test
   */
  register(name, category, testFn) {
    this.tests.push({ name, category, testFn });
  }
  
  /**
   * Run all tests
   */
  async runAll() {
    this.logger.info(`Running ${this.tests.length} integration tests...`);
    this.results = [];
    
    for (const test of this.tests) {
      await this.runTest(test);
    }
    
    return this.getSummary();
  }
  
  /**
   * Run a single test
   */
  async runTest(test) {
    const start = Date.now();
    
    try {
      await test.testFn();
      const duration = Date.now() - start;
      
      const result = new TestResult(test.name, test.category, true, duration);
      this.results.push(result);
      
      this.logger.info(`✅ ${test.name} (${duration}ms)`);
      this.metrics.increment('integration_test_passed', { category: test.category });
      
    } catch (error) {
      const duration = Date.now() - start;
      
      const result = new TestResult(test.name, test.category, false, duration, error);
      this.results.push(result);
      
      this.logger.error(`❌ ${test.name} (${duration}ms)`, { error });
      this.metrics.increment('integration_test_failed', { category: test.category });
    }
  }
  
  /**
   * Run tests by category
   */
  async runCategory(category) {
    const categoryTests = this.tests.filter(t => t.category === category);
    this.logger.info(`Running ${categoryTests.length} tests in category: ${category}`);
    
    for (const test of categoryTests) {
      await this.runTest(test);
    }
    
    return this.getSummary();
  }
  
  /**
   * Get test summary
   */
  getSummary() {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    const byCategory = {};
    for (const result of this.results) {
      if (!byCategory[result.category]) {
        byCategory[result.category] = { passed: 0, failed: 0, duration: 0 };
      }
      
      if (result.passed) {
        byCategory[result.category].passed++;
      } else {
        byCategory[result.category].failed++;
      }
      
      byCategory[result.category].duration += result.duration;
    }
    
    return {
      total: this.results.length,
      passed,
      failed,
      passRate: this.results.length > 0 ? (passed / this.results.length) * 100 : 0,
      totalDuration,
      avgDuration: this.results.length > 0 ? totalDuration / this.results.length : 0,
      byCategory,
      results: this.results
    };
  }
  
  /**
   * Print summary
   */
  printSummary(summary) {
    console.log('\n' + '='.repeat(60));
    console.log('INTEGRATION TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${summary.total}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`Pass Rate: ${summary.passRate.toFixed(1)}%`);
    console.log(`Total Duration: ${summary.totalDuration}ms`);
    console.log(`Avg Duration: ${summary.avgDuration.toFixed(0)}ms`);
    console.log('');
    console.log('By Category:');
    
    for (const [category, stats] of Object.entries(summary.byCategory)) {
      console.log(`  ${category}:`);
      console.log(`    ✅ ${stats.passed} passed`);
      console.log(`    ❌ ${stats.failed} failed`);
      console.log(`    ⏱️  ${stats.duration}ms`);
    }
    
    if (summary.failed > 0) {
      console.log('');
      console.log('Failed Tests:');
      for (const result of summary.results) {
        if (!result.passed) {
          console.log(`  ❌ ${result.name}: ${result.error.message}`);
        }
      }
    }
    
    console.log('='.repeat(60));
  }
}

/**
 * Mock providers for testing
 */
class MockProvider {
  constructor(name, options = {}) {
    this.name = name;
    this.shouldFail = options.shouldFail || false;
    this.latency = options.latency || 0;
    this.callCount = 0;
  }
  
  async call() {
    this.callCount++;
    
    if (this.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latency));
    }
    
    if (this.shouldFail) {
      throw new Error(`${this.name} failed`);
    }
    
    return { success: true, provider: this.name };
  }
  
  reset() {
    this.callCount = 0;
  }
}

module.exports = {
  TestResult,
  IntegrationTestSuite,
  MockProvider
};
