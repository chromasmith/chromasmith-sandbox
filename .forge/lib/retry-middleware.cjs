/**
 * Retry Middleware for Forge Flow 6.4
 * Implements exponential backoff with jitter for transient failures
 */

const { isRetryable, ForgeFlowError } = require('./error-taxonomy.cjs');

/**
 * Default retry configuration
 */
const DEFAULT_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 15000,
  jitter: true,
  timeoutMs: 30000,
  onRetry: null // callback(attempt, error, nextDelayMs)
};

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(attempt, baseDelayMs, maxDelayMs, jitter) {
  // Exponential backoff: baseDelay * (2 ^ attempt)
  let delay = baseDelayMs * Math.pow(2, attempt);
  
  // Cap at max delay
  delay = Math.min(delay, maxDelayMs);
  
  // Add jitter (randomize ±25%)
  if (jitter) {
    const jitterRange = delay * 0.25;
    delay = delay + (Math.random() * jitterRange * 2 - jitterRange);
  }
  
  return Math.floor(delay);
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper with exponential backoff
 * 
 * @param {Function} fn - Async function to retry
 * @param {Object} config - Retry configuration
 * @returns {Promise} Result of fn
 * @throws {ForgeFlowError} If all retries exhausted
 */
async function withRetry(fn, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  let lastError;
  let attempt = 0;
  
  while (attempt <= cfg.maxRetries) {
    try {
      // Wrap in timeout
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('TIMEOUT')), cfg.timeoutMs)
        )
      ]);
      
      return result;
      
    } catch (error) {
      lastError = error;
      
      // If not retryable, throw immediately
      if (!isRetryable(error)) {
        throw error;
      }
      
      // If max retries reached, throw
      if (attempt >= cfg.maxRetries) {
        throw new ForgeFlowError(
          'TRANSIENT_5XX',
          `Operation failed after ${cfg.maxRetries} retries: ${error.message}`,
          { 
            originalError: error,
            attempts: attempt + 1
          }
        );
      }
      
      // Calculate delay
      const delayMs = calculateDelay(attempt, cfg.baseDelayMs, cfg.maxDelayMs, cfg.jitter);
      
      // Call retry callback if provided
      if (cfg.onRetry) {
        cfg.onRetry(attempt + 1, error, delayMs);
      }
      
      // Wait before retry
      await sleep(delayMs);
      
      attempt++;
    }
  }
  
  // Should never reach here, but just in case
  throw lastError;
}

/**
 * Batch retry - retry multiple operations with shared config
 * Fails fast if any operation fails permanently
 */
async function batchRetry(operations, config = {}) {
  const results = [];
  
  for (const op of operations) {
    const result = await withRetry(op, config);
    results.push(result);
  }
  
  return results;
}

/**
 * Parallel retry - retry multiple operations in parallel
 * Continues even if some operations fail
 */
async function parallelRetry(operations, config = {}) {
  const promises = operations.map(op => 
    withRetry(op, config).catch(error => ({ error }))
  );
  
  return Promise.all(promises);
}

module.exports = {
  DEFAULT_CONFIG,
  calculateDelay,
  withRetry,
  batchRetry,
  parallelRetry
};