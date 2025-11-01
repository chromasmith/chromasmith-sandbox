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

module.exports = {
  enforceSafeMode,
  neverAutoInfra
};