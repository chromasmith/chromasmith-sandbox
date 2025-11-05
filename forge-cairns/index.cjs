/**
 * Forge Cairns - Durability Layer for Forge Flow 7.0
 * 
 * Provides WAL, audit logging, event ledger, and locking primitives
 * Ported from Forge Flow 6.4 with path adjustments for modular architecture
 */

// Import real implementations from durability module
const durability = require('./durability.cjs');
const logger = require('./lib/logger.cjs');
const metrics = require('./lib/metrics.cjs');

// Legacy stubs for backward compatibility (deprecated - use durability directly)
const store = new Map();       // path -> payload
const events = new Map();      // idempotency_key -> event
let walOffset = 0;

function crc32_stub(s) {
  let c = 0;
  for (let i = 0; i < s.length; i++) c = (c + s.charCodeAt(i)) >>> 0;
  return c.toString(16);
}

/**
 * DEPRECATED: Use durability.atomicWriteJson directly
 * Legacy stub wrapper for backward compatibility
 */
function wal_append({ record }) {
  const payload = JSON.stringify(record || {});
  const crc32 = crc32_stub(payload);
  const offset = ++walOffset;
  return { crc32, offset };
}

/**
 * Atomic write JSON with WAL protection
 * Wraps durability.atomicWriteJson for convenience
 */
async function atomic_write_json({ path, payload, runId }) {
  try {
    const checksum = await durability.atomicWriteJson(path, payload, runId);
    return { status: "ok", checksum };
  } catch (error) {
    return { status: "error", message: error.message };
  }
}

/**
 * Append event to ledger with idempotency protection
 * Wraps durability.appendEventLedger
 */
async function events_append(sourceEventId, payload, targetScope) {
  try {
    const idempotencyKey = await durability.appendEventLedger(
      sourceEventId,
      payload,
      targetScope
    );
    return { status: "ok", idempotency_key: idempotencyKey };
  } catch (error) {
    return { status: "error", message: error.message };
  }
}

/**
 * STUB: Context loading (to be implemented in Phase 6.2)
 * Placeholder for context budget and trio map loading
 */
function context_load({ project }) {
  const trio_tokens = 900;
  const maps_loaded = ["project_fingerprint.json","map_index_with_triggers.json","active_intent.json"];
  return { trio_tokens, maps_loaded, policy_applied: "none" };
}

/**
 * Acquire distributed lock for critical sections
 */
async function acquire_lock(ownerId, maxWaitMs) {
  return durability.acquireLock(ownerId, maxWaitMs);
}

/**
 * Release distributed lock
 */
async function release_lock() {
  return durability.releaseLock();
}

/**
 * Append to audit log with hash chain
 */
async function append_audit(event) {
  return durability.appendAuditLog(event);
}

/**
 * Replay uncommitted WAL entries on recovery
 */
async function replay_wal() {
  return durability.replayWAL();
}

// Export public API
module.exports = {
  // Real durability functions
  atomic_write_json,
  events_append,
  acquire_lock,
  release_lock,
  append_audit,
  replay_wal,
  
  // Stub for future implementation
  context_load,
  
  // Legacy compatibility (deprecated)
  wal_append,
  
  // Direct access to modules
  durability,
  logger,
  metrics
};
