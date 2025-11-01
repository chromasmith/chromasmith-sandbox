const durability = require('./durability');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const FORGE_ROOT = path.join(__dirname, '..');

// Start a new run
async function start(payload) {
  const runId = `run-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  
  // Acquire lock
  await durability.acquireLock(runId);
  
  // Create run record
  const runRecord = {
    id: runId,
    state: 'executing',
    started_at: new Date().toISOString(),
    payload: payload,
    notes: [],
    context_digest: null,
    schema_digest: null
  };
  
  // Write run file with WAL protection
  const runPath = `runs/${runId}.json`;
  await durability.atomicWriteJson(runPath, runRecord, runId);
  
  // Audit log
  await durability.appendAuditLog({
    action: 'run.start',
    run_id: runId,
    payload: payload
  });
  
  // Event ledger
  await durability.appendEventLedger(
    runId,
    { action: 'start', payload: payload },
    'run_lifecycle'
  );
  
  console.log(`✅ Run started: ${runId}`);
  return runId;
}

// Add progress note to run
async function note(runId, notePayload) {
  const runPath = path.join(FORGE_ROOT, `runs/${runId}.json`);
  
  // Read current run
  const runRecord = JSON.parse(await fs.readFile(runPath, 'utf8'));
  
  // Add note
  const noteEntry = {
    timestamp: new Date().toISOString(),
    content: notePayload
  };
  runRecord.notes.push(noteEntry);
  
  // Write updated run
  await durability.atomicWriteJson(`runs/${runId}.json`, runRecord, runId);
  
  // Audit log
  await durability.appendAuditLog({
    action: 'run.note',
    run_id: runId,
    note: notePayload
  });
  
  console.log(`📝 Note added to run ${runId}`);
  return noteEntry;
}

// Finish run with outcome
async function finish(runId, outcome) {
  const runPath = path.join(FORGE_ROOT, `runs/${runId}.json`);
  
  // Read current run
  const runRecord = JSON.parse(await fs.readFile(runPath, 'utf8'));
  
  // Update final state
  runRecord.state = outcome; // 'succeeded', 'failed', 'partially_succeeded'
  runRecord.finished_at = new Date().toISOString();
  runRecord.duration_ms = new Date(runRecord.finished_at) - new Date(runRecord.started_at);
  
  // Write final run
  await durability.atomicWriteJson(`runs/${runId}.json`, runRecord, runId);
  
  // Audit log
  await durability.appendAuditLog({
    action: 'run.finish',
    run_id: runId,
    outcome: outcome,
    duration_ms: runRecord.duration_ms
  });
  
  // Event ledger (final entry)
  await durability.appendEventLedger(
    `${runId}-complete`,
    { action: 'finish', outcome: outcome, duration_ms: runRecord.duration_ms },
    'run_lifecycle'
  );
  
  // Release lock
  await durability.releaseLock();
  
  console.log(`✅ Run finished: ${runId} (${outcome})`);
  return runRecord;
}

module.exports = {
  start,
  note,
  finish
};
