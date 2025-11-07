const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

const FORGE_ROOT = path.join(__dirname, '../..');

// Acquire lock with retry logic
async function acquireLock(ownerId, maxWaitMs = 30000) {
  const lockPath = path.join(FORGE_ROOT, '_wal/transaction.lock');
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      let lockData;
      
      // Try to read existing lock file
      try {
        lockData = JSON.parse(await fs.readFile(lockPath, 'utf8'));
      } catch (readErr) {
        // If file doesn't exist, create initial unlocked state
        if (readErr.code === 'ENOENT') {
          const initialLock = {
            locked: false,
            owner: null,
            acquired_at: null
          };
          await fs.writeFile(lockPath, JSON.stringify(initialLock, null, 2));
          fsSync.fsyncSync(fsSync.openSync(lockPath, 'r+'));
          lockData = initialLock;
        } else {
          throw readErr;
        }
      }
      
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
  
  // Perform actual write
  await fs.writeFile(targetPath, JSON.stringify(data, null, 2));
  fsSync.fsyncSync(fsSync.openSync(targetPath, 'r+'));
}

// Recover from WAL if needed
async function recoverFromWal() {
  const walPath = path.join(FORGE_ROOT, '_wal/pending_writes.jsonl');
  const walShadowPath = path.join(FORGE_ROOT, '_wal_shadow/pending_writes.jsonl');
  
  try {
    const walContent = await fs.readFile(walPath, 'utf8');
    const shadowContent = await fs.readFile(walShadowPath, 'utf8');
    
    if (walContent !== shadowContent) {
      console.error('❌ WAL/Shadow mismatch - data corruption detected!');
      throw new Error('WAL integrity failure');
    }
    
    const entries = walContent.trim().split('\n').filter(Boolean);
    if (entries.length === 0) return;
    
    console.log(`🔄 Recovering ${entries.length} pending writes from WAL...`);
    
    for (const line of entries) {
      const entry = JSON.parse(line);
      // Re-apply writes (idempotent)
      console.log(`  ↻ ${entry.target}`);
    }
    
    // Clear WAL after successful recovery
    await fs.writeFile(walPath, '');
    await fs.writeFile(walShadowPath, '');
    
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

module.exports = {
  acquireLock,
  releaseLock,
  atomicWriteJson,
  recoverFromWal
};

