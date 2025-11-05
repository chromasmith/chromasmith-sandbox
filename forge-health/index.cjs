// forge-health: Health monitoring and safe-mode integration
const breaker = require('./breaker-registry.cjs');

// Internal state
let SAFE_MODE = 'off'; // 'off' | 'read_only'

/**
 * Check health of a service
 * @param {string} serviceName - Service to check
 * @returns {object} Health status
 */
function health_check(serviceName) {
  const state = breaker.getState(serviceName);
  
  return {
    serviceName,
    healthy: state.state === breaker.BREAKER_STATES.CLOSED,
    state: state.state,
    failureCount: state.failureCount,
    lastFailure: state.lastFailure,
    advice: state.state === breaker.BREAKER_STATES.OPEN 
      ? 'Service unhealthy. Consider restarting dependent services.'
      : null
  };
}

/**
 * Get aggregate health status
 * @returns {object} Overall health status
 */
function health_get_status() {
  const allBreakers = breaker.getAllBreakers();
  
  if (allBreakers.length === 0) {
    return {
      status: 'healthy',
      services: [],
      message: 'No services registered'
    };
  }
  
  const unhealthy = allBreakers.filter(b => b.state === breaker.BREAKER_STATES.OPEN);
  const degraded = allBreakers.filter(b => b.state === breaker.BREAKER_STATES.HALF_OPEN);
  
  let status = 'healthy';
  if (unhealthy.length > 0) {
    status = 'unhealthy';
  } else if (degraded.length > 0) {
    status = 'degraded';
  }
  
  return {
    status,
    services: allBreakers.map(b => ({
      name: b.serviceName,
      state: b.state,
      failureCount: b.failureCount
    })),
    safeMode: SAFE_MODE,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get current safe mode
 * @returns {object} Safe mode status
 */
function health_get_safe_mode() {
  return {
    mode: SAFE_MODE,
    active: SAFE_MODE === 'read_only',
    reason: breaker.hasOpenBreaker() ? 'breaker_open' : null
  };
}

/**
 * Set safe mode
 * @param {string} mode - 'off' or 'read_only'
 * @returns {object} Status
 */
function health_set_safe_mode({ mode }) {
  if (mode !== 'off' && mode !== 'read_only') {
    return {
      status: 'error',
      message: 'Invalid mode. Must be "off" or "read_only"'
    };
  }
  
  SAFE_MODE = mode;
  return {
    status: 'ok',
    mode: SAFE_MODE
  };
}

/**
 * Check if writes should be blocked
 * @returns {boolean} True if writes should be blocked
 */
function health_should_block_writes() {
  // Block writes if safe mode is active OR any breaker is OPEN
  return SAFE_MODE === 'read_only' || breaker.hasOpenBreaker();
}

/**
 * Register a service for monitoring
 * @param {string} serviceName - Service to register
 * @returns {object} Registration status
 */
function health_register_service(serviceName) {
  return breaker.registerBreaker(serviceName);
}

/**
 * Record service failure
 * @param {string} serviceName - Service that failed
 * @returns {object} Updated state
 */
function health_record_failure(serviceName) {
  const result = breaker.recordFailure(serviceName);
  
  // Auto-enable safe mode when breaker opens
  if (result.state === breaker.BREAKER_STATES.OPEN && SAFE_MODE === 'off') {
    SAFE_MODE = 'read_only';
    console.warn(`[forge-health] Safe mode auto-enabled due to ${serviceName} breaker OPEN`);
  }
  
  return result;
}

/**
 * Record service success
 * @param {string} serviceName - Service that succeeded
 * @returns {object} Updated state
 */
function health_record_success(serviceName) {
  const result = breaker.recordSuccess(serviceName);
  
  // Auto-disable safe mode when all breakers close
  if (!breaker.hasOpenBreaker() && SAFE_MODE === 'read_only') {
    SAFE_MODE = 'off';
    console.log('[forge-health] Safe mode auto-disabled - all breakers CLOSED');
  }
  
  return result;
}

/**
 * Reset a service breaker
 * @param {string} serviceName - Service to reset
 * @returns {object} Status
 */
function health_reset_breaker(serviceName) {
  const result = breaker.reset(serviceName);
  
  // Check if we should disable safe mode
  if (!breaker.hasOpenBreaker() && SAFE_MODE === 'read_only') {
    SAFE_MODE = 'off';
    console.log('[forge-health] Safe mode auto-disabled after breaker reset');
  }
  
  return result;
}

module.exports = {
  health_check,
  health_get_status,
  health_get_safe_mode,
  health_set_safe_mode,
  health_should_block_writes,
  health_register_service,
  health_record_failure,
  health_record_success,
  health_reset_breaker
};
