/**
 * Forge Flow 6.4 - Health Mesh Module
 * Tracks system health and enforces safe-mode
 * Part of Pillar 3: Safety Guardrails
 */

const fs = require('fs').promises;
const path = require('path');

const FORGE_ROOT = path.join(__dirname, '..');
const HEALTH_FILE = path.join(FORGE_ROOT, 'status', 'health.json');

let healthCache = null;
let lastCheck = 0;
const CACHE_TTL_MS = 5000; // 5 second cache

/**
 * Get current health status
 * @returns {object} { safe_mode: 'healthy'|'read_only', reason: string, since: timestamp }
 */
async function getHealth() {
  const now = Date.now();
  
  // Return cached if still valid
  if (healthCache && (now - lastCheck) < CACHE_TTL_MS) {
    return healthCache;
  }
  
  try {
    const content = await fs.readFile(HEALTH_FILE, 'utf8');
    healthCache = JSON.parse(content);
    lastCheck = now;
    return healthCache;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, create default healthy state
      const defaultHealth = {
        safe_mode: 'healthy',
        reason: null,
        since: new Date().toISOString(),
        consecutive_failures: 0
      };
      await setHealth(defaultHealth);
      return defaultHealth;
    }
    throw error;
  }
}

/**
 * Set health status
 * @param {object} health - Health status object
 */
async function setHealth(health) {
  await fs.mkdir(path.dirname(HEALTH_FILE), { recursive: true });
  await fs.writeFile(HEALTH_FILE, JSON.stringify(health, null, 2));
  healthCache = health;
  lastCheck = Date.now();
}

/**
 * Enter safe-mode (read-only)
 * @param {string} reason - Reason for entering safe-mode
 */
async function enterSafeMode(reason) {
  const health = await getHealth();
  
  if (health.safe_mode === 'read_only') {
    // Already in safe-mode
    return;
  }
  
  console.warn(`⚠️  ENTERING SAFE-MODE: ${reason}`);
  
  await setHealth({
    safe_mode: 'read_only',
    reason,
    since: new Date().toISOString(),
    consecutive_failures: health.consecutive_failures || 0
  });
}

/**
 * Exit safe-mode (return to healthy)
 * @param {string} reason - Reason for recovery
 */
async function exitSafeMode(reason) {
  const health = await getHealth();
  
  if (health.safe_mode === 'healthy') {
    // Already healthy
    return;
  }
  
  console.log(`✅ EXITING SAFE-MODE: ${reason}`);
  
  await setHealth({
    safe_mode: 'healthy',
    reason: null,
    since: new Date().toISOString(),
    consecutive_failures: 0
  });
}

/**
 * Record a failure (increments consecutive failure count)
 */
async function recordFailure() {
  const health = await getHealth();
  const failures = (health.consecutive_failures || 0) + 1;
  
  await setHealth({
    ...health,
    consecutive_failures: failures
  });
  
  // Enter safe-mode after 3 consecutive failures
  if (failures >= 3 && health.safe_mode !== 'read_only') {
    await enterSafeMode(`${failures} consecutive failures detected`);
  }
  
  return failures;
}

/**
 * Record a success (resets consecutive failure count)
 */
async function recordSuccess() {
  const health = await getHealth();
  
  if (health.consecutive_failures > 0) {
    await setHealth({
      ...health,
      consecutive_failures: 0
    });
  }
  
  // Exit safe-mode after 5 consecutive successes
  if (health.safe_mode === 'read_only' && health.consecutive_failures === 0) {
    // Check if we have history of successes
    await exitSafeMode('System recovered: consecutive failures reset');
  }
}

/**
 * Check if circuit breaker is open
 * @returns {boolean} True if circuit is open (operations should be blocked)
 */
async function isCircuitOpen() {
  const health = await getHealth();
  return health.consecutive_failures >= 3;
}

/**
 * Reset circuit breaker manually (admin action)
 */
async function resetCircuitBreaker() {
  const health = await getHealth();
  
  console.log('🔄 Manual circuit breaker reset');
  
  await setHealth({
    ...health,
    consecutive_failures: 0,
    safe_mode: 'healthy',
    reason: null
  });
}

module.exports = {
  getHealth,
  setHealth,
  enterSafeMode,
  exitSafeMode,
  recordFailure,
  recordSuccess,
  isCircuitOpen,
  resetCircuitBreaker
};