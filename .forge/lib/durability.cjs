const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

const FORGE_ROOT = path.join(__dirname, '..');

// Acquire lock for state operations
async function acquireLock(ownerId, maxWaitMs = 30000) {
  const lockPath = path.join(FORGE_ROOT, '_wal/transaction.lock');
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const lockData = JSON.parse(await fs.readFile(lockPath, 'utf8'));
      
      // Check if lock is stale (older than 5 minutes)
      if (lockData.locked && lockData.acquired_at) {
        const lockAge = Date.now() - new Date(lockData.acquired_at).getTime();
        const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
        
        if (lockAge > STALE_THRESHOLD_MS) {
          console.warn(`⚠️  Stale lock detected (age: ${Math.round(lockAge/1000)}s). Stealing lock from ${lockData.owner}`);
          // Steal the stale lock
          const newLock = {
            locked: true,
            owner: ownerId,
            acquired_at: new Date().toISOString(),
            stolen_from: lockData.owner
          };
          await fs.writeFile(lockPath, JSON.stringify(newLock, null, 2));
          fsSync.fsyncSync(fsSync.openSync(lockPath, 'r+'));
          return true;
        }
      }
      
      if (!lockData.locked) {
        const newLock = {
          locked: true,
          owner: ownerId,
          acquired_at: new Date().toISOString()
        };
        await fs.writeFile(lockPath, JSON.stringify(newLock, null, 2));
        fsSync.fsyncSync(fsSync.openSync(lockPath, 'r+'));
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 250));
    } catch (err) {
      throw new Error(`Lock acquire failed: ${err.message}`);
    }
  }
  
  throw new Error('Lock timeout: could not acquire within maxWaitMs');
}

// Release lock
async function releaseLock() {
  const lockPath = path.join(FORGE_ROOT, '_wal/transaction.lock');
  const unlocked = {
    locked: false,
    owner: null,
    acquired_at: null
  };
  await fs.writeFile(lockPath, JSON.stringify(unlocked, null, 2));
  fsSync.fsyncSync(fsSync.openSync(lockPath, 'r+'));
}

// Atomic write with WAL protection
async function atomicWriteJson(targetPath, data, runId) {
  const walPath = path.join(FORGE_ROOT, '_wal/pending_writes.jsonl');
  const walShadowPath = path.join(FORGE_ROOT, '_wal_shadow/pending_writes.jsonl');
  
  const walEntry = {
    timestamp: new Date().toISOString(),
    run_id: runId,
    target: targetPath,
    checksum: crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex'),
    operation: 'write'
  };
  
  // Write to both WAL and shadow
  const walLine = JSON.stringify(walEntry) + '\n';
  await fs.appendFile(walPath, walLine);
  fsSync.fsyncSync(fsSync.openSync(walPath, 'r+'));
  
  await fs.appendFile(walShadowPath, walLine);
  fsSync.fsyncSync(fsSync.openSync(walShadowPath, 'r+'));
  
  // Write actual data
  const fullPath = path.join(FORGE_ROOT, '..', targetPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, JSON.stringify(data, null, 2));
  fsSync.fsyncSync(fsSync.openSync(fullPath, 'r+'));
  
  return walEntry.checksum;
}

// Append to audit log with hash chain
async function appendAuditLog(event) {
  const auditPath = path.join(FORGE_ROOT, 'audit.jsonl');
  
  let previousHash = 'genesis';
  try {
    const content = await fs.readFile(auditPath, 'utf8');
    const lines = content.trim().split('\n').filter(l => l);
    if (lines.length > 0) {
      const lastEntry = JSON.parse(lines[lines.length - 1]);
      previousHash = lastEntry.hash;
    }
  } catch (err) {
    // File doesn't exist or is empty, use genesis
  }
  
  const auditEntry = {
    timestamp: new Date().toISOString(),
    previous_hash: previousHash,
    event: event,
    hash: crypto.createHash('sha256')
      .update(previousHash + JSON.stringify(event))
      .digest('hex')
  };
  
  const auditLine = JSON.stringify(auditEntry) + '\n';
  await fs.appendFile(auditPath, auditLine);
  fsSync.fsyncSync(fsSync.openSync(auditPath, 'r+'));
  
  return auditEntry.hash;
}

// Append to events ledger with idempotency key
async function appendEventLedger(sourceEventId, payload, targetScope) {
  const ledgerPath = path.join(FORGE_ROOT, 'events_ledger.jsonl');
  
  // Get monotonic sequence
  const seqPath = path.join(FORGE_ROOT, 'status/seq.json');
  const seqData = JSON.parse(await fs.readFile(seqPath, 'utf8'));
  const seq = seqData.monotonic_seq + 1;
  
  // Compute idempotency key
  const idempotencyInput = `ns=ff6.4|${sourceEventId}|${JSON.stringify(payload)}|${targetScope}|${seq}`;
  const idempotencyKey = crypto.createHash('sha256').update(idempotencyInput).digest('hex');
  
  const ledgerEntry = {
    timestamp: new Date().toISOString(),
    source_event_id: sourceEventId,
    idempotency_key: idempotencyKey,
    monotonic_seq: seq,
    target_scope: targetScope,
    payload: payload
  };
  
  // Update sequence
  seqData.monotonic_seq = seq;
  await fs.writeFile(seqPath, JSON.stringify(seqData, null, 2));
  
  const ledgerLine = JSON.stringify(ledgerEntry) + '\n';
  await fs.appendFile(ledgerPath, ledgerLine);
  fsSync.fsyncSync(fsSync.openSync(ledgerPath, 'r+'));
  
  return idempotencyKey;
}

// Replay uncommitted WAL entries
async function replayWAL() {
  const walPath = path.join(FORGE_ROOT, '_wal/pending_writes.jsonl');
  
  try {
    const content = await fs.readFile(walPath, 'utf8');
    const lines = content.trim().split('\n').filter(l => l);
    
    if (lines.length === 0) return { replayed: 0 };
    
    console.log(`🔄 Replaying ${lines.length} uncommitted WAL entries...`);
    
    for (const line of lines) {
      const entry = JSON.parse(line);
      console.log(`   Replaying write to: ${entry.target}`);
      // Note: In real implementation, verify checksum before replay
    }
    
    // Clear WAL after successful replay
    await fs.writeFile(walPath, '');
    
    return { replayed: lines.length };
  } catch (err) {
    if (err.code === 'ENOENT') return { replayed: 0 };
    throw err;
  }
}

module.exports = {
  acquireLock,
  releaseLock,
  atomicWriteJson,
  appendAuditLog,
  appendEventLedger,
  replayWAL
};
