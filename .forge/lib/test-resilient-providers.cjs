/**
 * Tests for Resilient Provider Integration
 * Forge Flow 6.4 - T3.2
 */

const { wrapProvider, getAllProviderStatuses, resetAllProviders } = require('./resilient-provider-wrapper.cjs');
const { CircuitState } = require('./circuit-breaker.cjs');
const { ForgeFlowError } = require('./error-taxonomy.cjs');

// Mock provider for testing
class MockProvider {
  constructor(name) {
    this.name = name;
    this.callCount = 0;
    this.shouldFail = false;
    this.failureType = 'transient';
  }
  
  async ping() {
    this.callCount++;
    if (this.shouldFail) {
      if (this.failureType === 'rate-limit') {
        throw new Error('rate limit exceeded');
      } else if (this.failureType === 'auth') {
        throw new Error('authentication failed');
      } else if (this.failureType === 'timeout') {
        throw new Error('connection timeout');
      } else {
        throw new Error('transient error');
      }
    }
    return 'pong';
  }
  
  async query() {
    this.callCount++;
    if (this.shouldFail) {
      throw new Error('query failed');
    }
    return [{ id: 1 }];
  }
  
  async delete() {
    this.callCount++;
    if (this.shouldFail) {
      throw new Error('delete failed');
    }
    return true;
  }
  
  supports(feature) {
    return true;
  }
}

// Test suite
(async () => {
  console.log('🧪 Testing Resilient Provider Integration...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Reset all circuit breakers before tests
  resetAllProviders();
  
  // Test 1: Basic wrapping - successful call
  try {
    const provider = new MockProvider('test-basic');
    const wrapped = wrapProvider(provider);
    
    const result = await wrapped.ping();
    
    if (result !== 'pong') throw new Error('Wrong result');
    if (provider.callCount !== 1) throw new Error('Should call once');
    
    console.log('✅ Test 1: Basic successful call');
    passed++;
  } catch (err) {
    console.log('❌ Test 1: Basic successful call -', err.message);
    failed++;
  }
  
  // Test 2: Retry on transient failure
  try {
    const provider = new MockProvider('test-retry');
    const wrapped = wrapProvider(provider, {
      retry: { maxRetries: 3, baseDelayMs: 10, timeoutMs: 5000 }
    });
    
    provider.shouldFail = true;
    provider.failureType = 'transient';
    
    // Fail 2 times, then succeed
    let attempts = 0;
    provider.ping = async function() {
      attempts++;
      if (attempts < 3) {
        throw new Error('transient error');
      }
      return 'pong';
    };
    
    const result = await wrapped.ping();
    
    if (result !== 'pong') throw new Error('Should eventually succeed');
    if (attempts !== 3) throw new Error(`Expected 3 attempts, got ${attempts}`);
    
    console.log('✅ Test 2: Retry on transient failure');
    passed++;
  } catch (err) {
    console.log('❌ Test 2: Retry on transient failure -', err.message);
    failed++;
  }
  
  // Test 3: Error conversion to ForgeFlowError
  try {
    const provider = new MockProvider('test-error-conversion');
    const wrapped = wrapProvider(provider, {
      retry: { maxRetries: 0 }
    });
    
    provider.shouldFail = true;
    provider.failureType = 'rate-limit';
    
    let caught = false;
    try {
      await wrapped.ping();
    } catch (err) {
      caught = true;
      if (!(err instanceof ForgeFlowError)) throw new Error('Should be ForgeFlowError');
      if (err.code !== 'PROVIDER_RATE_LIMIT') throw new Error('Wrong error code');
    }
    
    if (!caught) throw new Error('Should have thrown');
    
    console.log('✅ Test 3: Error conversion to ForgeFlowError');
    passed++;
  } catch (err) {
    console.log('❌ Test 3: Error conversion to ForgeFlowError -', err.message);
    failed++;
  }
  
  // Test 4: Non-retryable methods (delete)
  try {
    const provider = new MockProvider('test-non-retryable');
    const wrapped = wrapProvider(provider, {
      retry: { maxRetries: 3, baseDelayMs: 10 },
      nonRetryableMethods: ['delete']
    });
    
    provider.shouldFail = true;
    
    let caught = false;
    let attempts = 0;
    
    provider.delete = async function() {
      attempts++;
      throw new Error('delete failed');
    };
    
    try {
      await wrapped.delete();
    } catch (err) {
      caught = true;
      if (attempts !== 1) throw new Error(`Should only attempt once, got ${attempts}`);
    }
    
    if (!caught) throw new Error('Should have thrown');
    
    console.log('✅ Test 4: Non-retryable methods');
    passed++;
  } catch (err) {
    console.log('❌ Test 4: Non-retryable methods -', err.message);
    failed++;
  }
  
  // Test 5: Circuit breaker integration - open after failures
  try {
    resetAllProviders();
    
    const provider = new MockProvider('test-circuit');
    const wrapped = wrapProvider(provider, {
      retry: { maxRetries: 0 },
      circuitBreaker: { failureThreshold: 2, timeout: 100 },
      circuitBreakerMethods: ['ping']
    });
    
    provider.shouldFail = true;
    
    // First failure
    try { await wrapped.ping(); } catch (err) {}
    
    // Second failure - should open circuit
    try { await wrapped.ping(); } catch (err) {}
    
    // Get status
    const statuses = getAllProviderStatuses();
    const circuitStatus = statuses['provider-test-circuit'];
    
    if (!circuitStatus) throw new Error('Circuit breaker not found');
    if (circuitStatus.state !== CircuitState.OPEN) {
      throw new Error(`Circuit should be OPEN, got ${circuitStatus.state}`);
    }
    
    // Third call should fail fast
    let failedFast = false;
    try {
      await wrapped.ping();
    } catch (err) {
      failedFast = err.code === 'SERVICE_UNAVAILABLE';
    }
    
    if (!failedFast) throw new Error('Should fail fast when circuit OPEN');
    
    console.log('✅ Test 5: Circuit breaker opens after failures');
    passed++;
  } catch (err) {
    console.log('❌ Test 5: Circuit breaker opens after failures -', err.message);
    failed++;
  }
  
  // Test 6: Circuit breaker recovery
  try {
    resetAllProviders();
    
    const provider = new MockProvider('test-recovery');
    const wrapped = wrapProvider(provider, {
      retry: { maxRetries: 0 },
      circuitBreaker: { failureThreshold: 1, successThreshold: 1, timeout: 50 },
      circuitBreakerMethods: ['ping']
    });
    
    // Open circuit
    provider.shouldFail = true;
    try { await wrapped.ping(); } catch (err) {}
    
    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 60));
    
    // Fix provider and try again
    provider.shouldFail = false;
    const result = await wrapped.ping();
    
    if (result !== 'pong') throw new Error('Should succeed after recovery');
    
    // Check circuit is closed
    const statuses = getAllProviderStatuses();
    const circuitStatus = statuses['provider-test-recovery'];
    
    if (circuitStatus.state !== CircuitState.CLOSED) {
      throw new Error(`Circuit should be CLOSED, got ${circuitStatus.state}`);
    }
    
    console.log('✅ Test 6: Circuit breaker recovery');
    passed++;
  } catch (err) {
    console.log('❌ Test 6: Circuit breaker recovery -', err.message);
    failed++;
  }
  
  // Test 7: Methods without circuit breaker
  try {
    resetAllProviders();
    
    const provider = new MockProvider('test-no-circuit');
    const wrapped = wrapProvider(provider, {
      retry: { maxRetries: 0 },
      circuitBreaker: { failureThreshold: 1 },
      circuitBreakerMethods: ['ping'] // query not included
    });
    
    provider.shouldFail = true;
    
    // Fail query multiple times - should not open circuit
    try { await wrapped.query(); } catch (err) {}
    try { await wrapped.query(); } catch (err) {}
    
    const statuses = getAllProviderStatuses();
    const circuitStatus = statuses['provider-test-no-circuit'];
    
    // Circuit might be closed or not exist yet
    if (circuitStatus && circuitStatus.state !== CircuitState.CLOSED) {
      throw new Error('Circuit should not be affected by non-monitored methods');
    }
    
    console.log('✅ Test 7: Methods without circuit breaker');
    passed++;
  } catch (err) {
    console.log('❌ Test 7: Methods without circuit breaker -', err.message);
    failed++;
  }
  
  // Test 8: Capability methods not wrapped
  try {
    const provider = new MockProvider('test-capabilities');
    provider.supports = jest?.fn ? jest.fn(() => true) : (() => true);
    
    const wrapped = wrapProvider(provider);
    
    const result = wrapped.supports('TEST_FEATURE');
    
    if (!result) throw new Error('Should support feature');
    
    console.log('✅ Test 8: Capability methods not wrapped');
    passed++;
  } catch (err) {
    console.log('❌ Test 8: Capability methods not wrapped -', err.message);
    failed++;
  }
  
  // Test 9: Authentication error mapping
  try {
    const provider = new MockProvider('test-auth-error');
    const wrapped = wrapProvider(provider, {
      retry: { maxRetries: 0 }
    });
    
    provider.shouldFail = true;
    provider.failureType = 'auth';
    
    let caught = false;
    try {
      await wrapped.ping();
    } catch (err) {
      caught = true;
      if (err.code !== 'INVALID_CREDENTIALS') {
        throw new Error(`Expected INVALID_CREDENTIALS, got ${err.code}`);
      }
      if (err.retryable !== false) {
        throw new Error('Auth errors should not be retryable');
      }
    }
    
    if (!caught) throw new Error('Should have thrown');
    
    console.log('✅ Test 9: Authentication error mapping');
    passed++;
  } catch (err) {
    console.log('❌ Test 9: Authentication error mapping -', err.message);
    failed++;
  }
  
  // Test 10: Timeout error mapping
  try {
    const provider = new MockProvider('test-timeout-error');
    const wrapped = wrapProvider(provider, {
      retry: { maxRetries: 0 }
    });
    
    provider.shouldFail = true;
    provider.failureType = 'timeout';
    
    let caught = false;
    try {
      await wrapped.ping();
    } catch (err) {
      caught = true;
      if (err.code !== 'NETWORK_TIMEOUT') {
        throw new Error(`Expected NETWORK_TIMEOUT, got ${err.code}`);
      }
      if (err.retryable !== true) {
        throw new Error('Timeout errors should be retryable');
      }
    }
    
    if (!caught) throw new Error('Should have thrown');
    
    console.log('✅ Test 10: Timeout error mapping');
    passed++;
  } catch (err) {
    console.log('❌ Test 10: Timeout error mapping -', err.message);
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
