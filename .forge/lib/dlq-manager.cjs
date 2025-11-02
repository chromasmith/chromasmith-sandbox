/**
 * Dead Letter Queue Manager for Forge Flow 6.4
 * Enhanced with error taxonomy, replay capability, and diagnostics
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { ForgeFlowError } = require('./error-taxonomy.cjs');

/**
 * Default DLQ configuration
 */
const DEFAULT_CONFIG = {
  basePath: '.forge/_dlq',
  maxRetries: 3,
  retentionDays: 30,
  autoReplay: false,
  replayBatchSize: 10
};

/**
 * DLQ Entry structure
 */
class DLQEntry {
  constructor(operation, error, context = {}) {
    this.id = crypto.randomUUID();
    this.timestamp = new Date().toISOString();
    this.operation = operation; // { verb, params, resource }
    this.error = this.serializeError(error);
    this.context = context; // { run_id, user, session, etc. }
    this.attempts = 1;
    this.lastAttempt = this.timestamp;
    this.status = 'failed'; // failed, replaying, resolved, archived
    this.idempotencyKey = this.calculateIdempotencyKey(operation);
  }
  
  serializeError(error) {
    if (error instanceof ForgeFlowError) {
      return error.toJSON();
    }
    
    return {
      name: error.name || 'Error',
      message: error.message,
      code: error.code || 'UNKNOWN',
      stack: error.stack,
      details: error.details || {}
    };
  }
  
  calculateIdempotencyKey(operation) {
    const payload = JSON.stringify({
      verb: operation.verb,
      params: operation.params,
      resource: operation.resource
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }
  
  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      operation: this.operation,
      error: this.error,
      context: this.context,
      attempts: this.attempts,
      lastAttempt: this.lastAttempt,
      status: this.status,
      idempotencyKey: this.idempotencyKey
    };
  }
}

/**
 * DLQ Manager
 */
class DLQManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map(); // In-memory cache for quick lookups
  }
  
  /**
   * Ensure DLQ directory exists
   */
  async ensureDLQDirectory() {
    try {
      await fs.mkdir(this.config.basePath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  
  /**
   * Add entry to DLQ
   */
  async add(operation, error, context = {}) {
    await this.ensureDLQDirectory();
    
    const entry = new DLQEntry(operation, error, context);
    
    // Check if duplicate based on idempotency key
    const existing = await this.findByIdempotencyKey(entry.idempotencyKey);
    if (existing) {
      // Update existing entry
      existing.attempts++;
      existing.lastAttempt = new Date().toISOString();
      existing.error = entry.error; // Update with latest error
      await this.update(existing);
      return existing;
    }
    
    // Write new entry
    const filePath = this.getEntryPath(entry.id);
    await fs.writeFile(filePath, JSON.stringify(entry.toJSON(), null, 2));
    
    // Update cache
    this.cache.set(entry.id, entry);
    
    // Append to index for quick scanning
    await this.appendToIndex(entry);
    
    return entry;
  }
  
  /**
   * Get entry by ID
   */
  async get(id) {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }
    
    // Read from disk
    const filePath = this.getEntryPath(id);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      
      // Reconstruct entry
      const entry = Object.assign(new DLQEntry({}, new Error()), data);
      this.cache.set(id, entry);
      return entry;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }
  
  /**
   * Find entry by idempotency key
   */
  async findByIdempotencyKey(idempotencyKey) {
    // Check cache
    for (const entry of this.cache.values()) {
      if (entry.idempotencyKey === idempotencyKey) {
        return entry;
      }
    }
    
    // Scan index
    const indexPath = path.join(this.config.basePath, 'index.jsonl');
    try {
      const content = await fs.readFile(indexPath, 'utf8');
      const lines = content.trim().split('\n');
      
      for (const line of lines) {
        const data = JSON.parse(line);
        if (data.idempotencyKey === idempotencyKey) {
          return await this.get(data.id);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    
    return null;
  }
  
  /**
   * Update existing entry
   */
  async update(entry) {
    const filePath = this.getEntryPath(entry.id);
    await fs.writeFile(filePath, JSON.stringify(entry.toJSON(), null, 2));
    this.cache.set(entry.id, entry);
  }
  
  /**
   * List all entries with filters
   */
  async list(filters = {}) {
    await this.ensureDLQDirectory();
    
    const files = await fs.readdir(this.config.basePath);
    const entries = [];
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      if (file === 'index.jsonl') continue;
      
      const id = path.basename(file, '.json');
      const entry = await this.get(id);
      
      if (!entry) continue;
      
      // Apply filters
      if (filters.status && entry.status !== filters.status) continue;
      if (filters.verb && entry.operation.verb !== filters.verb) continue;
      if (filters.errorCode && entry.error.code !== filters.errorCode) continue;
      if (filters.minAttempts && entry.attempts < filters.minAttempts) continue;
      
      entries.push(entry);
    }
    
    return entries;
  }
  
  /**
   * Replay a single entry
   */
  async replay(id, executeFn) {
    const entry = await this.get(id);
    if (!entry) {
      throw new ForgeFlowError('NOT_FOUND', `DLQ entry ${id} not found`);
    }
    
    entry.status = 'replaying';
    await this.update(entry);
    
    try {
      const result = await executeFn(entry.operation, entry.context);
      
      // Mark as resolved
      entry.status = 'resolved';
      await this.update(entry);
      
      return { success: true, result };
      
    } catch (error) {
      // Failed again
      entry.attempts++;
      entry.lastAttempt = new Date().toISOString();
      entry.error = new DLQEntry({}, error).serializeError(error);
      entry.status = 'failed';
      await this.update(entry);
      
      return { success: false, error };
    }
  }
  
  /**
   * Replay batch of entries
   */
  async replayBatch(filters = {}, executeFn) {
    const entries = await this.list({
      ...filters,
      status: 'failed'
    });
    
    const batchSize = this.config.replayBatchSize;
    const batch = entries.slice(0, batchSize);
    
    const results = [];
    
    for (const entry of batch) {
      const result = await this.replay(entry.id, executeFn);
      results.push({
        id: entry.id,
        ...result
      });
    }
    
    return {
      total: entries.length,
      processed: batch.length,
      results
    };
  }
  
  /**
   * Archive old entries
   */
  async archive(filters = {}) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
    
    const entries = await this.list(filters);
    const archived = [];
    
    for (const entry of entries) {
      const entryDate = new Date(entry.timestamp);
      if (entryDate < cutoffDate) {
        entry.status = 'archived';
        await this.update(entry);
        archived.push(entry.id);
      }
    }
    
    return archived;
  }
  
  /**
   * Delete entry
   */
  async delete(id) {
    const filePath = this.getEntryPath(id);
    try {
      await fs.unlink(filePath);
      this.cache.delete(id);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }
  
  /**
   * Get statistics
   */
  async getStats() {
    const entries = await this.list();
    
    const stats = {
      total: entries.length,
      byStatus: {},
      byErrorCode: {},
      byVerb: {},
      avgAttempts: 0,
      oldestEntry: null,
      newestEntry: null
    };
    
    let totalAttempts = 0;
    
    for (const entry of entries) {
      // By status
      stats.byStatus[entry.status] = (stats.byStatus[entry.status] || 0) + 1;
      
      // By error code
      const errorCode = entry.error.code || 'UNKNOWN';
      stats.byErrorCode[errorCode] = (stats.byErrorCode[errorCode] || 0) + 1;
      
      // By verb
      const verb = entry.operation.verb || 'UNKNOWN';
      stats.byVerb[verb] = (stats.byVerb[verb] || 0) + 1;
      
      // Attempts
      totalAttempts += entry.attempts;
      
      // Oldest/newest
      if (!stats.oldestEntry || entry.timestamp < stats.oldestEntry.timestamp) {
        stats.oldestEntry = entry;
      }
      if (!stats.newestEntry || entry.timestamp > stats.newestEntry.timestamp) {
        stats.newestEntry = entry;
      }
    }
    
    stats.avgAttempts = entries.length > 0 ? totalAttempts / entries.length : 0;
    
    return stats;
  }
  
  /**
   * Helper: Get file path for entry
   */
  getEntryPath(id) {
    return path.join(this.config.basePath, `${id}.json`);
  }
  
  /**
   * Helper: Append to index file
   */
  async appendToIndex(entry) {
    const indexPath = path.join(this.config.basePath, 'index.jsonl');
    const line = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp,
      idempotencyKey: entry.idempotencyKey,
      verb: entry.operation.verb,
      status: entry.status
    }) + '\n';
    
    await fs.appendFile(indexPath, line);
  }
}

// Singleton instance
let instance = null;

function getDLQManager(config) {
  if (!instance) {
    instance = new DLQManager(config);
  }
  return instance;
}

module.exports = {
  DLQEntry,
  DLQManager,
  getDLQManager
};
