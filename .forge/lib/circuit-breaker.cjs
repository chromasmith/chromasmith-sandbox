/**
 * Circuit Breaker for Forge Flow 6.4
 * Prevents cascading failures by failing fast when service is unhealthy
 */

const { ForgeFlowError } = require('./error-taxonomy.cjs');

const CircuitState = {
  CLOSED: 'CLOSED',       // Normal operation, requests flow through
  OPEN: 'OPEN',           // Circuit broken, fail fast
  HALF_OPEN: 'HALF_OPEN'  // Testing if service recovered
};

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CONFIG = {
  failureThreshold: 3,      // Open after N consecutive failures
  successThreshold: 2,      // Close after N consecutive successes in HALF_OPEN
  timeout: 60000,           // Time to wait before HALF_OPEN (ms)
  onStateChange: null       // callback(oldState, newState)
};

/**
 * Circuit Breaker implementation
 */
class CircuitBreaker {
  constructor(name, config = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    this.lastError = null;
  }
  
  /**
   * Execute function with circuit breaker protection
   */
  async execute(fn) {
    // Check if circuit is OPEN
    if (this.state === CircuitState.OPEN) {
      // Check if timeout elapsed
      if (Date.now() < this.nextAttempt) {
        throw new ForgeFlowError(
          'SERVICE_UNAVAILABLE',
          `Circuit breaker ${this.name} is OPEN`,
          { 
            state: this.state,
            nextAttempt: new Date(this.nextAttempt).toISOString(),
            lastError: this.lastError
          }
        );
      }
      
      // Move to HALF_OPEN
      this.changeState(CircuitState.HALF_OPEN);
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
      
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }
  
  /**
   * Handle successful execution
   */
  onSuccess() {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.config.successThreshold) {
        this.changeState(CircuitState.CLOSED);
        this.successCount = 0;
      }
    }
  }
  
  /**
   * Handle failed execution
   */
  onFailure(error) {
    this.lastError = error;
    this.successCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      // Failed in HALF_OPEN, go back to OPEN
      this.changeState(CircuitState.OPEN);
      this.nextAttempt = Date.now() + this.config.timeout;
      return;
    }
    
    if (this.state === CircuitState.CLOSED) {
      this.failureCount++;
      
      if (this.failureCount >= this.config.failureThreshold) {
        this.changeState(CircuitState.OPEN);
        this.nextAttempt = Date.now() + this.config.timeout;
      }
    }
  }
  
  /**
   * Change circuit state
   */
  changeState(newState) {
    const oldState = this.state;
    this.state = newState;
    
    if (this.config.onStateChange) {
      this.config.onStateChange(oldState, newState);
    }
  }
  
  /**
   * Get current status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: new Date(this.nextAttempt).toISOString(),
      lastError: this.lastError
    };
  }
  
  /**
   * Manually reset circuit
   */
  reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    this.lastError = null;
  }
}

/**
 * Global circuit breaker registry
 */
class CircuitBreakerRegistry {
  constructor() {
    this.breakers = new Map();
  }
  
  /**
   * Get or create circuit breaker
   */
  get(name, config) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name);
  }
  
  /**
   * Get all circuit breaker statuses
   */
  getAll() {
    const statuses = {};
    for (const [name, breaker] of this.breakers) {
      statuses[name] = breaker.getStatus();
    }
    return statuses;
  }
  
  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Singleton registry
const registry = new CircuitBreakerRegistry();

module.exports = {
  CircuitState,
  CircuitBreaker,
  CircuitBreakerRegistry,
  registry
};