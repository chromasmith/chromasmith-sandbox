/**
 * Graceful Degradation for Forge Flow 6.4
 * Fallback strategies when services fail
 */

const { getLogger } = require('./logger.cjs');
const { getMetrics } = require('./metrics.cjs');

/**
 * Degradation strategies
 */
const DegradationStrategy = {
  FAIL_FAST: 'fail_fast',           // Throw error immediately
  FALLBACK_VALUE: 'fallback_value', // Return default value
  FALLBACK_CACHE: 'fallback_cache', // Return cached value
  FALLBACK_FUNCTION: 'fallback_fn', // Call fallback function
  SKIP: 'skip'                      // Skip operation, return null
};

/**
 * Feature flags for disabling broken features
 */
class FeatureFlags {
  constructor() {
    this.flags = new Map();
  }
  
  enable(feature) {
    this.flags.set(feature, true);
  }
  
  disable(feature) {
    this.flags.set(feature, false);
  }
  
  isEnabled(feature) {
    return this.flags.get(feature) !== false;
  }
  
  getAll() {
    const result = {};
    for (const [key, value] of this.flags) {
      result[key] = value;
    }
    return result;
  }
}

/**
 * Graceful degradation wrapper
 */
class GracefulDegradation {
  constructor(config = {}) {
    this.logger = getLogger();
    this.metrics = getMetrics();
    this.cache = new Map();
    this.featureFlags = new FeatureFlags();
  }
  
  /**
   * Execute with graceful degradation
   */
  async execute(name, fn, options = {}) {
    const {
      strategy = DegradationStrategy.FAIL_FAST,
      fallbackValue = null,
      fallbackFn = null,
      cacheTTL = 60000,
      feature = null
    } = options;
    
    // Check feature flag
    if (feature && !this.featureFlags.isEnabled(feature)) {
      this.logger.warn(`Feature ${feature} is disabled`, { name });
      this.metrics.increment('degradation_feature_disabled', { name, feature });
      
      if (strategy === DegradationStrategy.SKIP) {
        return null;
      }
      
      return this.handleFallback(name, strategy, fallbackValue, fallbackFn);
    }
    
    try {
      const result = await fn();
      
      // Cache successful result
      if (strategy === DegradationStrategy.FALLBACK_CACHE) {
        this.setCache(name, result, cacheTTL);
      }
      
      this.metrics.increment('degradation_success', { name });
      return result;
      
    } catch (error) {
      this.logger.error(`Operation ${name} failed, applying degradation strategy`, {
        name,
        strategy,
        error
      });
      
      this.metrics.increment('degradation_fallback', { 
        name, 
        strategy,
        errorCode: error.code || 'UNKNOWN'
      });
      
      return this.handleFallback(name, strategy, fallbackValue, fallbackFn, error);
    }
  }
  
  /**
   * Handle fallback based on strategy
   */
  async handleFallback(name, strategy, fallbackValue, fallbackFn, error) {
    switch (strategy) {
      case DegradationStrategy.FAIL_FAST:
        throw error;
        
      case DegradationStrategy.FALLBACK_VALUE:
        this.logger.info(`Using fallback value for ${name}`);
        return fallbackValue;
        
      case DegradationStrategy.FALLBACK_CACHE:
        const cached = this.getCache(name);
        if (cached) {
          this.logger.info(`Using cached value for ${name}`);
          return cached;
        }
        this.logger.warn(`No cached value for ${name}, using fallback`);
        return fallbackValue;
        
      case DegradationStrategy.FALLBACK_FUNCTION:
        if (!fallbackFn) {
          this.logger.error(`No fallback function provided for ${name}`);
          return fallbackValue;
        }
        this.logger.info(`Using fallback function for ${name}`);
        return await fallbackFn(error);
        
      case DegradationStrategy.SKIP:
        this.logger.info(`Skipping operation ${name}`);
        return null;
        
      default:
        throw new Error(`Unknown degradation strategy: ${strategy}`);
    }
  }
  
  /**
   * Set cache value
   */
  setCache(key, value, ttl) {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl
    });
  }
  
  /**
   * Get cache value
   */
  getCache(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }
  
  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
  
  /**
   * Get degradation statistics
   */
  getStats() {
    const metrics = this.metrics.getAll();
    
    return {
      success: metrics.degradation_success?.value || 0,
      fallback: metrics.degradation_fallback?.value || 0,
      featureDisabled: metrics.degradation_feature_disabled?.value || 0,
      cacheSize: this.cache.size,
      features: this.featureFlags.getAll()
    };
  }
}

// Singleton instance
let instance = null;

function getDegradation() {
  if (!instance) {
    instance = new GracefulDegradation();
  }
  return instance;
}

module.exports = {
  DegradationStrategy,
  FeatureFlags,
  GracefulDegradation,
  getDegradation
};
