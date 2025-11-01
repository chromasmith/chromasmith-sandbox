/**
 * Forge Flow 6.4 - Guard Module
 * Safety guardrails for autonomous operations
 * Part of Pillar 3: Safety Guardrails
 */

const healthMesh = require('./health-mesh.cjs');

/**
 * Enforce safe-mode check
 * Throws error if system is in read-only mode
 */
async function enforceSafeMode() {
  const health = await healthMesh.getHealth();
  
  // Check circuit breaker first
  if (await healthMesh.isCircuitOpen()) {
    throw new Error(`CIRCUIT_BREAKER_OPEN: ${health.consecutive_failures} consecutive failures detected`);
  }
  
  if (health.safe_mode === 'read_only') {
    throw new Error(`SAFE_MODE_READ_ONLY: ${health.reason || 'System in read-only mode'}`);
  }
}

/**
 * Never auto-create infrastructure guard
 * @param {boolean} confirm - Explicit confirmation required
 */
function neverAutoInfra(confirm) {
  if (!confirm) {
    throw new Error('Infrastructure creation requires explicit confirmation');
  }
}

/**
 * Adaptive enforcement check
 * Warns first, then blocks based on violation history
 * @param {string} operation - Operation being attempted
 * @param {boolean} allowOverride - Allow override in soft_block mode
 */
async function adaptiveEnforce(operation, allowOverride = false) {
  const level = await healthMesh.getEnforcementLevel();
  const health = await healthMesh.getHealth();
  
  if (level === healthMesh.ENFORCEMENT_LEVELS.WARN) {
    console.warn(`⚠️  Warning: ${operation} (enforcement level: warn)`);
    return true; // Allow with warning
  }
  
  if (level === healthMesh.ENFORCEMENT_LEVELS.SOFT_BLOCK) {
    if (allowOverride) {
      console.warn(`⚠️  Soft block overridden: ${operation}`);
      return true;
    }
    await healthMesh.recordViolation(operation);
    throw new Error(`SOFT_BLOCK: ${operation} blocked (${health.violation_warnings || 0} violations)`);
  }
  
  if (level === healthMesh.ENFORCEMENT_LEVELS.HARD_BLOCK) {
    await healthMesh.recordViolation(operation);
    throw new Error(`HARD_BLOCK: ${operation} strictly blocked (${health.violation_warnings || 0} violations)`);
  }
}

module.exports = {
  enforceSafeMode,
  neverAutoInfra,
  adaptiveEnforce
};