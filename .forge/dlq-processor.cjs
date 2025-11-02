/**
 * DLQ Processor for Forge Flow 6.4
 * Automatically processes and retries failed operations
 */

const { getDLQManager } = require('./lib/dlq-manager.cjs');
const { getLogger } = require('./lib/logger.cjs');
const { getMetrics } = require('./lib/metrics.cjs');

const logger = getLogger();
const metrics = getMetrics();
const dlq = getDLQManager();

const BATCH_SIZE = parseInt(process.env.DLQ_BATCH_SIZE || '10');
const INTERVAL = parseInt(process.env.DLQ_INTERVAL || '60000'); // 1 minute

/**
 * Process DLQ entries
 */
async function processDLQ() {
  logger.info('Starting DLQ processing cycle');
  
  try {
    // Get failed entries
    const entries = await dlq.list({ status: 'failed', maxResults: BATCH_SIZE });
    
    if (entries.length === 0) {
      logger.debug('No failed DLQ entries to process');
      return;
    }
    
    logger.info(`Processing ${entries.length} DLQ entries`);
    
    // Process each entry
    for (const entry of entries) {
      try {
        // Skip if too many attempts
        if (entry.attempts >= 5) {
          logger.warn(`Archiving entry ${entry.id} after ${entry.attempts} attempts`);
          await dlq.archive();
          continue;
        }
        
        // Attempt replay (with mock executor for now)
        const result = await dlq.replay(entry.id, async (operation) => {
          logger.info(`Replaying operation: ${operation.verb}`, { operation });
          // TODO: Implement actual operation execution
          return { success: true };
        });
        
        if (result.success) {
          logger.info(`Successfully replayed entry ${entry.id}`);
          metrics.increment('dlq_replay_success', { verb: entry.operation.verb });
        } else {
          logger.warn(`Failed to replay entry ${entry.id}`);
          metrics.increment('dlq_replay_failure', { verb: entry.operation.verb });
        }
        
      } catch (error) {
        logger.error(`Error processing entry ${entry.id}`, { error });
        metrics.increment('dlq_process_error');
      }
    }
    
    // Get stats
    const stats = await dlq.getStats();
    logger.info('DLQ stats', stats);
    
    metrics.set('dlq_failed_count', {}, stats.byStatus.failed || 0);
    metrics.set('dlq_resolved_count', {}, stats.byStatus.resolved || 0);
    
  } catch (error) {
    logger.error('DLQ processing failed', { error });
    metrics.increment('dlq_cycle_error');
  }
}

/**
 * Start processor
 */
function startProcessor() {
  logger.info('DLQ Processor starting', { batchSize: BATCH_SIZE, interval: INTERVAL });
  
  // Initial run
  processDLQ();
  
  // Schedule periodic runs
  const intervalId = setInterval(processDLQ, INTERVAL);
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    clearInterval(intervalId);
    process.exit(0);
  });
}

// Start
startProcessor();
