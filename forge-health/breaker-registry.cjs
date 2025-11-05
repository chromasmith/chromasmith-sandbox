// Circuit Breaker Registry for forge-health
// Tracks service health and breaker states

const BREAKER_STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

const FAILURE_THRESHOLD = 3;
const HALF_OPEN_TIMEOUT = 60 * 1000; // 60 seconds

// Internal state
const breakers = new Map();

/**
 * Register a new circuit breaker
 * @param {string} serviceName - Unique service identifier
 */
function registerBreaker(serviceName) {
  if (!breakers.has(serviceName)) {
    breakers.set(serviceName, {
      state: BREAKER_STATES.CLOSED,
      failureCount: 0,
      lastFailure: null,
      openedAt: null,
      halfOpenAt: null
    });
  }
  return { status: 'ok', serviceName };
}

/**
 * Record a service failure
 * @param {string} serviceName - Service identifier
 */
function recordFailure(serviceName) {
  if (!breakers.has(serviceName)) {
    registerBreaker(serviceName);
  }
  
  const breaker = breakers.get(serviceName);
  breaker.failureCount++;
  breaker.lastFailure = new Date().toISOString();
  
  // Open breaker after threshold failures
  if (breaker.failureCount >= FAILURE_THRESHOLD && breaker.state !== BREAKER_STATES.OPEN) {
    breaker.state = BREAKER_STATES.OPEN;
    breaker.openedAt = new Date().toISOString();
    breaker.halfOpenAt = new Date(Date.now() + HALF_OPEN_TIMEOUT).toISOString();
  }
  
  return {
    serviceName,
    state: breaker.state,
    failureCount: breaker.failureCount
  };
}

/**
 * Record a service success
 * @param {string} serviceName - Service identifier
 */
function recordSuccess(serviceName) {
  if (!breakers.has(serviceName)) {
    registerBreaker(serviceName);
  }
  
  const breaker = breakers.get(serviceName);
  
  // If half-open and success, close the breaker
  if (breaker.state === BREAKER_STATES.HALF_OPEN) {
    breaker.state = BREAKER_STATES.CLOSED;
    breaker.failureCount = 0;
    breaker.lastFailure = null;
    breaker.openedAt = null;
    breaker.halfOpenAt = null;
  } else if (breaker.state === BREAKER_STATES.CLOSED) {
    // Reset failure count on success
    breaker.failureCount = 0;
    breaker.lastFailure = null;
  }
  
  return {
    serviceName,
    state: breaker.state,
    failureCount: breaker.failureCount
  };
}

/**
 * Get current state of a breaker
 * @param {string} serviceName - Service identifier
 * @returns {object} Breaker state
 */
function getState(serviceName) {
  if (!breakers.has(serviceName)) {
    return {
      serviceName,
      state: BREAKER_STATES.CLOSED,
      failureCount: 0,
      registered: false
    };
  }
  
  const breaker = breakers.get(serviceName);
  
  // Auto-transition to HALF_OPEN if timeout expired
  if (breaker.state === BREAKER_STATES.OPEN && breaker.halfOpenAt) {
    const halfOpenTime = new Date(breaker.halfOpenAt).getTime();
    if (Date.now() >= halfOpenTime) {
      breaker.state = BREAKER_STATES.HALF_OPEN;
    }
  }
  
  return {
    serviceName,
    state: breaker.state,
    failureCount: breaker.failureCount,
    lastFailure: breaker.lastFailure,
    openedAt: breaker.openedAt,
    halfOpenAt: breaker.halfOpenAt,
    registered: true
  };
}

/**
 * Reset a breaker to CLOSED state
 * @param {string} serviceName - Service identifier
 */
function reset(serviceName) {
  if (breakers.has(serviceName)) {
    breakers.set(serviceName, {
      state: BREAKER_STATES.CLOSED,
      failureCount: 0,
      lastFailure: null,
      openedAt: null,
      halfOpenAt: null
    });
  }
  return { status: 'ok', serviceName };
}

/**
 * Get all breakers
 * @returns {Array} All registered breakers
 */
function getAllBreakers() {
  const all = [];
  for (const [serviceName] of breakers) {
    all.push(getState(serviceName));
  }
  return all;
}

/**
 * Check if any breaker is OPEN
 * @returns {boolean} True if any breaker is OPEN
 */
function hasOpenBreaker() {
  for (const [serviceName] of breakers) {
    const state = getState(serviceName);
    if (state.state === BREAKER_STATES.OPEN) {
      return true;
    }
  }
  return false;
}

module.exports = {
  BREAKER_STATES,
  registerBreaker,
  recordFailure,
  recordSuccess,
  getState,
  reset,
  getAllBreakers,
  hasOpenBreaker
};
