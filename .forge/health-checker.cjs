/**
 * Health Checker for Forge Flow 6.4
 * Monitors service health and triggers alerts
 */

const { getHealthCheck } = require('./lib/health-check.cjs');
const { getLogger } = require('./lib/logger.cjs');
const { getMetrics } = require('./lib/metrics.cjs');

const logger = getLogger();
const metrics = getMetrics();
const health = getHealthCheck();

const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || '30000'); // 30 seconds

/**
 * Register services to monitor
 */
function registerServices() {
  // Example: Monitor system resources
  health.register('cpu', async () => {
    const usage = process.cpuUsage();
    const percent = (usage.user + usage.system) / 1000000; // Convert to seconds
    
    return {
      ok: percent < 80, // Unhealthy if >80%
      usage: percent.toFixed(2) + '%'
    };
  });
  
  // Example: Monitor memory
  health.register('memory', async () => {
    const mem = process.memoryUsage();
    const heapPercent = (mem.heapUsed / mem.heapTotal) * 100;
    
    return {
      ok: heapPercent < 90, // Unhealthy if >90%
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
      percent: heapPercent.toFixed(1) + '%'
    };
  });
  
  logger.info('Health checks registered');
}

/**
 * Run health checks
 */
async function runChecks() {
  try {
    await health.checkAll();
    const status = health.getAggregateStatus();
    
    logger.debug('Health check completed', {
      status: status.status,
      healthy: status.healthy,
      degraded: status.degraded,
      unhealthy: status.unhealthy
    });
    
    // Update metrics
    metrics.set('system_health_score', {}, 
      status.status === 'healthy' ? 1 : 
      status.status === 'degraded' ? 0.5 : 0
    );
    
    // Alert if unhealthy
    if (status.status === 'unhealthy') {
      logger.warn('System is unhealthy', { status });
      metrics.increment('health_alert_triggered');
    }
    
  } catch (error) {
    logger.error('Health check failed', { error });
    metrics.increment('health_check_error');
  }
}

/**
 * Start health checker
 */
function startChecker() {
  logger.info('Health Checker starting', { interval: CHECK_INTERVAL });
  
  registerServices();
  
  // Initial run
  runChecks();
  
  // Schedule periodic checks
  const intervalId = setInterval(runChecks, CHECK_INTERVAL);
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    clearInterval(intervalId);
    health.stop();
    process.exit(0);
  });
}

// Start
startChecker();
