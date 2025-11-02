/**
 * Resilient Provider Wrapper for Forge Flow 6.4
 * Wraps provider instances with retry logic and circuit breakers
 */

const { withRetry } = require('./retry-middleware.cjs');
const { registry } = require('./circuit-breaker.cjs');
const { ForgeFlowError } = require('./error-taxonomy.cjs');

/**
 * Default configuration for provider resilience
 */
const DEFAULT_RESILIENCE_CONFIG = {
  retry: {
    maxRetries: 3,
    baseDelayMs: 500,
    maxDelayMs: 15000,
    jitter: true,
    timeoutMs: 30000
  },
  circuitBreaker: {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 60000
  },
  // Methods that should NOT be retried (destructive operations)
  nonRetryableMethods: ['delete', 'drop', 'truncate'],
  // Methods that should have circuit breakers
  circuitBreakerMethods: ['init', 'ping', 'query', 'create', 'update', 'delete']
};

/**
 * Wrap a provider instance with resilience features
 * 
 * @param {Object} provider - Provider instance to wrap
 * @param {Object} config - Resilience configuration
 * @returns {Proxy} Wrapped provider with retry and circuit breaker
 */
function wrapProvider(provider, config = {}) {
  const cfg = { ...DEFAULT_RESILIENCE_CONFIG, ...config };
  
  // Get or create circuit breaker for this provider
  const breakerName = `provider-${provider.name || provider.constructor.name}`;
  const breaker = registry.get(breakerName, cfg.circuitBreaker);
  
  // Create proxy to intercept method calls
  return new Proxy(provider, {
    get(target, prop) {
      const originalValue = target[prop];
      
      // If not a function, return as-is
      if (typeof originalValue !== 'function') {
        return originalValue;
      }
      
      // Don't wrap internal/utility methods
      if (prop.startsWith('_') || prop === 'constructor') {
        return originalValue.bind(target);
      }
      
      // Don't wrap capability checks
      if (prop === 'supports' || prop === 'getCapabilityLevel') {
        return originalValue.bind(target);
      }
      
      // Wrap with resilience features
      return async function (...args) {
        const methodName = String(prop);
        
        // Check if method should be non-retryable
        const isNonRetryable = cfg.nonRetryableMethods.some(
          pattern => methodName.toLowerCase().includes(pattern.toLowerCase())
        );
        
        // Check if method should have circuit breaker
        const useCircuitBreaker = cfg.circuitBreakerMethods.some(
          pattern => methodName.toLowerCase().includes(pattern.toLowerCase())
        );
        
        // Build the operation function
        const operation = async () => {
          try {
            return await originalValue.apply(target, args);
          } catch (error) {
            // Convert to ForgeFlowError if not already
            if (error instanceof ForgeFlowError) {
              throw error;
            }
            
            // Map common errors
            if (error.message?.includes('rate limit')) {
              throw new ForgeFlowError('PROVIDER_RATE_LIMIT', error.message, { 
                provider: breakerName,
                method: methodName,
                originalError: error
              });
            }
            
            if (error.message?.includes('timeout')) {
              throw new ForgeFlowError('NETWORK_TIMEOUT', error.message, {
                provider: breakerName,
                method: methodName,
                originalError: error
              });
            }
            
            if (error.message?.includes('auth') || error.message?.includes('permission')) {
              throw new ForgeFlowError('INVALID_CREDENTIALS', error.message, {
                provider: breakerName,
                method: methodName,
                originalError: error
              });
            }
            
            // Default: transient error
            throw new ForgeFlowError('TRANSIENT_5XX', error.message, {
              provider: breakerName,
              method: methodName,
              originalError: error
            });
          }
        };
        
        // Apply retry if retryable
        const operationWithRetry = isNonRetryable 
          ? operation 
          : () => withRetry(operation, {
              ...cfg.retry,
              onRetry: (attempt, error, delayMs) => {
                console.log(`[${breakerName}] Retry attempt ${attempt} for ${methodName} after ${delayMs}ms`);
              }
            });
        
        // Apply circuit breaker if enabled
        if (useCircuitBreaker) {
          return breaker.execute(operationWithRetry);
        } else {
          return operationWithRetry();
        }
      };
    }
  });
}

/**
 * Get circuit breaker status for a provider
 */
function getProviderStatus(providerName) {
  const breakerName = `provider-${providerName}`;
  const breaker = registry.get(breakerName);
  return breaker.getStatus();
}

/**
 * Get all provider circuit breaker statuses
 */
function getAllProviderStatuses() {
  return registry.getAll();
}

/**
 * Reset circuit breaker for a provider
 */
function resetProvider(providerName) {
  const breakerName = `provider-${providerName}`;
  const breaker = registry.get(breakerName);
  breaker.reset();
}

/**
 * Reset all provider circuit breakers
 */
function resetAllProviders() {
  registry.resetAll();
}

module.exports = {
  DEFAULT_RESILIENCE_CONFIG,
  wrapProvider,
  getProviderStatus,
  getAllProviderStatuses,
  resetProvider,
  resetAllProviders
};
