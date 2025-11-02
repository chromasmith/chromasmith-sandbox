/**
 * Tests for Error Handling Foundation
 * Forge Flow 6.4 - T3.1
 */

const { 
  ErrorCategory, 
  ErrorCode, 
  ForgeFlowError, 
  mapHttpStatus, 
  isRetryable 
} = require('./error-taxonomy.cjs');

const { 
  calculateDelay, 
  withRetry, 
  batchRetry, 
  parallelRetry 
} = require('./retry-middleware.cjs');

const { 
  CircuitState, 
  CircuitBreaker, 
  registry 
} = require('./circuit-breaker.cjs');

// Test suite
(async () => {
  console.log('🧪 Testing Error Handling Foundation...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Error Taxonomy - ForgeFlowError creation
  try {
    const error = new ForgeFlowError('PROVIDER_RATE_LIMIT', 'Too many requests');
    
    if (error.code !== 'PROVIDER_RATE_LIMIT') throw new Error('Wrong code');
    if (error.category !== ErrorCategory.TRANSIENT) throw new Error('Wrong category');
    if (error.retryable !== true) throw new Error('Should be retryable');
    if (!error.timestamp) throw new Error('Missing timestamp');
    
    console.log('✅ Test 1: ForgeFlowError creation');
    passed++;
  } catch (err) {
    console.log('❌ Test 1: ForgeFlowError creation -', err.message);
    failed++;
  }
  
  // Test 2: Error Taxonomy - HTTP status mapping
  try {
    if (mapHttpStatus(429) !== 'PROVIDER_RATE_LIMIT') throw new Error('429 mapping failed');
    if (mapHttpStatus(401) !== 'INVALID_CREDENTIALS') throw new Error('401 mapping failed');
    if (mapHttpStatus(404) !== 'NOT_FOUND') throw new Error('404 mapping failed');
    if (mapHttpStatus(503) !== 'TRANSIENT_5XX') throw new Error('503 mapping failed');
    
    console.log('✅ Test 2: HTTP status mapping');
    passed++;
  } catch (err) {
    console.log('❌ Test 2: HTTP status mapping -', err.message);
    failed++;
  }
  
  // Test 3: Error Taxonomy - Retryable detection
  try {
    const retryableError = new ForgeFlowError('NETWORK_TIMEOUT', 'Connection timeout');
    const permanentError = new ForgeFlowError('INVALID_CREDENTIALS', 'Bad auth');
    
    if (!isRetryable(retryableError)) throw new Error('Should be retryable');
    if (isRetryable(permanentError)) throw new Error('Should not be retryable');
    
    console.log('✅ Test 3: Retryable detection');
    passed++;
  } catch (err) {
    console.log('❌ Test 3: Retryable detection -', err.message);
    failed++;
  }
  
  // Test 4: Retry Middleware - Delay calculation
  try {
    const delay0 = calculateDelay(0, 500, 15000, false);
    const delay1 = calculateDelay(1, 500, 15000, false);
    const delay2 = calculateDelay(2, 500, 15000, false);
    
    if (delay0 !== 500) throw new Error(`Attempt 0: expected 500, got ${delay0}`);
    if (delay1 !== 1000) throw new Error(`Attempt 1: expected 1000, got ${delay1}`);
    if (delay2 !== 2000) throw new Error(`Attempt 2: expected 2000, got ${delay2}`);
    
    // Test max delay cap
    const delayCapped = calculateDelay(10, 500, 15000, false);
    if (delayCapped > 15000) throw new Error('Delay not capped');
    
    console.log('✅ Test 4: Delay calculation');
    passed++;
  } catch (err) {
    console.log('❌ Test 4: Delay calculation -', err.message);
    failed++;
  }
  
  // Test 5: Retry Middleware - Successful retry
  try {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) {
        const error = new Error('NETWORK_TIMEOUT');
        error.code = 'NETWORK_TIMEOUT';
        throw error;
      }
      return 'success';
    };
    
    const result = await withRetry(fn, { 
      maxRetries: 3, 
      baseDelayMs: 10,
      timeoutMs: 5000 
    });
    
    if (result !== 'success') throw new Error('Wrong result');
    if (attempts !== 3) throw new Error(`Expected 3 attempts, got ${attempts}`);
    
    console.log('✅ Test 5: Successful retry after failures');
    passed++;
  } catch (err) {
    console.log('❌ Test 5: Successful retry after failures -', err.message);
    failed++;
  }
  
  // Test 6: Retry Middleware - Non-retryable error
  try {
    const fn = async () => {
      throw new ForgeFlowError('INVALID_CREDENTIALS', 'Bad auth');
    };
    
    let caught = false;
    try {
      await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
    } catch (err) {
      caught = true;
      if (err.code !== 'INVALID_CREDENTIALS') throw new Error('Wrong error code');
    }
    
    if (!caught) throw new Error('Should have thrown');
    
    console.log('✅ Test 6: Non-retryable error fails fast');
    passed++;
  } catch (err) {
    console.log('❌ Test 6: Non-retryable error fails fast -', err.message);
    failed++;
  }
  
  // Test 7: Retry Middleware - Max retries exhausted
  try {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      const error = new Error('NETWORK_TIMEOUT');
      error.code = 'NETWORK_TIMEOUT';
      throw error;
    };
    
    let caught = false;
    try {
      await withRetry(fn, { maxRetries: 2, baseDelayMs: 10, timeoutMs: 5000 });
    } catch (err) {
      caught = true;
      if (attempts !== 3) throw new Error(`Expected 3 attempts, got ${attempts}`);
    }
    
    if (!caught) throw new Error('Should have thrown after max retries');
    
    console.log('✅ Test 7: Max retries exhausted');
    passed++;
  } catch (err) {
    console.log('❌ Test 7: Max retries exhausted -', err.message);
    failed++;
  }
  
  // Test 8: Circuit Breaker - State transitions
  try {
    const breaker = new CircuitBreaker('test-service', {
      failureThreshold: 2,
      successThreshold: 2,
      timeout: 100
    });
    
    // Should start CLOSED
    if (breaker.state !== CircuitState.CLOSED) throw new Error('Should start CLOSED');
    
    // First failure
    try {
      await breaker.execute(async () => { throw new Error('Fail 1'); });
    } catch (err) {}
    
    if (breaker.state !== CircuitState.CLOSED) throw new Error('Should stay CLOSED after 1 failure');
    
    // Second failure should open circuit
    try {
      await breaker.execute(async () => { throw new Error('Fail 2'); });
    } catch (err) {}
    
    if (breaker.state !== CircuitState.OPEN) throw new Error('Should be OPEN after 2 failures');
    
    // Should fail fast now
    let failedFast = false;
    try {
      await breaker.execute(async () => 'should not run');
    } catch (err) {
      failedFast = err.code === 'SERVICE_UNAVAILABLE';
    }
    
    if (!failedFast) throw new Error('Should fail fast when OPEN');
    
    console.log('✅ Test 8: Circuit breaker state transitions');
    passed++;
  } catch (err) {
    console.log('❌ Test 8: Circuit breaker state transitions -', err.message);
    failed++;
  }
  
  // Test 9: Circuit Breaker - Recovery to HALF_OPEN
  try {
    const breaker = new CircuitBreaker('recovery-test', {
      failureThreshold: 1,
      successThreshold: 1,
      timeout: 50
    });
    
    // Open the circuit
    try {
      await breaker.execute(async () => { throw new Error('Fail'); });
    } catch (err) {}
    
    if (breaker.state !== CircuitState.OPEN) throw new Error('Should be OPEN');
    
    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 60));
    
    // Next call should move to HALF_OPEN
    await breaker.execute(async () => 'success');
    
    if (breaker.state !== CircuitState.CLOSED) throw new Error('Should be CLOSED after success in HALF_OPEN');
    
    console.log('✅ Test 9: Circuit breaker recovery');
    passed++;
  } catch (err) {
    console.log('❌ Test 9: Circuit breaker recovery -', err.message);
    failed++;
  }
  
  // Test 10: Circuit Breaker - Registry
  try {
    const breaker1 = registry.get('service1');
    const breaker2 = registry.get('service2');
    const breaker3 = registry.get('service1'); // Should return same instance
    
    if (breaker1 !== breaker3) throw new Error('Should return same instance');
    if (breaker1 === breaker2) throw new Error('Should be different instances');
    
    const statuses = registry.getAll();
    if (!statuses.service1) throw new Error('Missing service1 status');
    if (!statuses.service2) throw new Error('Missing service2 status');
    
    console.log('✅ Test 10: Circuit breaker registry');
    passed++;
  } catch (err) {
    console.log('❌ Test 10: Circuit breaker registry -', err.message);
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