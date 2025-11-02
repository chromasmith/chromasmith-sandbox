/**
 * Health Check System for Forge Flow 6.4
 * Monitor MCP services and auto-restart unhealthy ones
 */

const { getLogger } = require('./logger.cjs');
const { getMetrics } = require('./metrics.cjs');

/**
 * Health status
 */
const HealthStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  UNKNOWN: 'unknown'
};

/**
 * Health check result
 */
class HealthCheckResult {
  constructor(name, status, details = {}) {
    this.name = name;
    this.status = status;
    this.timestamp = new Date().toISOString();
    this.details = details;
    this.responseTime = details.responseTime || 0;
  }
  
  isHealthy() {
    return this.status === HealthStatus.HEALTHY;
  }
  
  isDegraded() {
    return this.status === HealthStatus.DEGRADED;
  }
  
  isUnhealthy() {
    return this.status === HealthStatus.UNHEALTHY;
  }
}

/**
 * Health check configuration
 */
const DEFAULT_CONFIG = {
  interval: 30000,           // Check every 30 seconds
  timeout: 5000,             // 5 second timeout
  unhealthyThreshold: 3,     // Mark unhealthy after 3 failures
  healthyThreshold: 2,       // Mark healthy after 2 successes
  autoRestart: true,         // Auto-restart unhealthy services
  restartCooldown: 60000     // Wait 60s between restarts
};

/**
 * Individual service health checker
 */
class ServiceHealthChecker {
  constructor(name, checkFn, config = {}) {
    this.name = name;
    this.checkFn = checkFn;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.currentStatus = HealthStatus.UNKNOWN;
    this.lastCheck = null;
    this.lastRestart = null;
    this.restartCount = 0;
  }
  
  /**
   * Execute health check
   */
  async check() {
    const start = Date.now();
    
    try {
      // Run check with timeout
      const result = await Promise.race([
        this.checkFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('TIMEOUT')), this.config.timeout)
        )
      ]);
      
      const responseTime = Date.now() - start;
      
      // Check passed
      this.consecutiveFailures = 0;
      this.consecutiveSuccesses++;
      
      // Update status if threshold met
      if (this.consecutiveSuccesses >= this.config.healthyThreshold) {
        this.currentStatus = HealthStatus.HEALTHY;
      }
      
      this.lastCheck = new HealthCheckResult(
        this.name,
        this.currentStatus,
        { ...result, responseTime }
      );
      
      return this.lastCheck;
      
    } catch (error) {
      const responseTime = Date.now() - start;
      
      // Check failed
      this.consecutiveSuccesses = 0;
      this.consecutiveFailures++;
      
      // Update status if threshold met
      if (this.consecutiveFailures >= this.config.unhealthyThreshold) {
        this.currentStatus = HealthStatus.UNHEALTHY;
      } else if (this.consecutiveFailures > 0) {
        this.currentStatus = HealthStatus.DEGRADED;
      }
      
      this.lastCheck = new HealthCheckResult(
        this.name,
        this.currentStatus,
        { error: error.message, responseTime }
      );
      
      return this.lastCheck;
    }
  }
  
  /**
   * Check if service needs restart
   */
  needsRestart() {
    if (!this.config.autoRestart) return false;
    if (!this.isUnhealthy()) return false;
    
    // Check cooldown
    if (this.lastRestart) {
      const elapsed = Date.now() - new Date(this.lastRestart).getTime();
      if (elapsed < this.config.restartCooldown) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Mark service as restarted
   */
  markRestarted() {
    this.lastRestart = new Date().toISOString();
    this.restartCount++;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.currentStatus = HealthStatus.UNKNOWN;
  }
  
  /**
   * Get current status
   */
  getStatus() {
    return {
      name: this.name,
      status: this.currentStatus,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastCheck: this.lastCheck,
      restartCount: this.restartCount,
      lastRestart: this.lastRestart
    };
  }
  
  isHealthy() {
    return this.currentStatus === HealthStatus.HEALTHY;
  }
  
  isDegraded() {
    return this.currentStatus === HealthStatus.DEGRADED;
  }
  
  isUnhealthy() {
    return this.currentStatus === HealthStatus.UNHEALTHY;
  }
}

/**
 * Aggregate health check manager
 */
class HealthCheckManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.services = new Map();
    this.logger = getLogger();
    this.metrics = getMetrics();
    this.intervalId = null;
    this.restartHandlers = new Map();
  }
  
  /**
   * Register a service health check
   */
  register(name, checkFn, config = {}) {
    const checker = new ServiceHealthChecker(
      name,
      checkFn,
      { ...this.config, ...config }
    );
    
    this.services.set(name, checker);
    this.logger.info(`Registered health check for ${name}`);
  }
  
  /**
   * Register restart handler for a service
   */
  onRestart(name, handler) {
    this.restartHandlers.set(name, handler);
  }
  
  /**
   * Check all services
   */
  async checkAll() {
    const results = [];
    
    for (const [name, checker] of this.services) {
      const result = await checker.check();
      results.push(result);
      
      // Update metrics
      this.metrics.set('service_health', 
        { service: name },
        result.isHealthy() ? 1 : 0
      );
      
      this.metrics.record('health_check_duration_ms',
        { service: name },
        result.responseTime
      );
      
      // Check if restart needed
      if (checker.needsRestart()) {
        await this.restartService(name);
      }
    }
    
    return results;
  }
  
  /**
   * Restart a service
   */
  async restartService(name) {
    const checker = this.services.get(name);
    if (!checker) return;
    
    this.logger.warn(`Restarting unhealthy service: ${name}`, {
      consecutiveFailures: checker.consecutiveFailures,
      restartCount: checker.restartCount
    });
    
    this.metrics.increment('service_restart', { service: name });
    
    // Call restart handler if registered
    const handler = this.restartHandlers.get(name);
    if (handler) {
      try {
        await handler();
        checker.markRestarted();
        this.logger.info(`Successfully restarted ${name}`);
      } catch (error) {
        this.logger.error(`Failed to restart ${name}`, { error });
      }
    } else {
      this.logger.warn(`No restart handler registered for ${name}`);
      checker.markRestarted();
    }
  }
  
  /**
   * Get aggregate health status
   */
  getAggregateStatus() {
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;
    let unknown = 0;
    
    for (const checker of this.services.values()) {
      switch (checker.currentStatus) {
        case HealthStatus.HEALTHY:
          healthy++;
          break;
        case HealthStatus.DEGRADED:
          degraded++;
          break;
        case HealthStatus.UNHEALTHY:
          unhealthy++;
          break;
        default:
          unknown++;
      }
    }
    
    // Determine overall status
    let overallStatus;
    if (unhealthy > 0) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (degraded > 0) {
      overallStatus = HealthStatus.DEGRADED;
    } else if (healthy === this.services.size && this.services.size > 0) {
      overallStatus = HealthStatus.HEALTHY;
    } else {
      overallStatus = HealthStatus.UNKNOWN;
    }
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      total: this.services.size,
      healthy,
      degraded,
      unhealthy,
      unknown,
      services: this.getAllStatuses()
    };
  }
  
  /**
   * Get all service statuses
   */
  getAllStatuses() {
    const statuses = {};
    for (const [name, checker] of this.services) {
      statuses[name] = checker.getStatus();
    }
    return statuses;
  }
  
  /**
   * Start periodic health checks
   */
  start() {
    if (this.intervalId) {
      this.logger.warn('Health checks already running');
      return;
    }
    
    this.logger.info(`Starting health checks (interval: ${this.config.interval}ms)`);
    
    // Run immediately
    this.checkAll();
    
    // Then run periodically
    this.intervalId = setInterval(() => {
      this.checkAll();
    }, this.config.interval);
  }
  
  /**
   * Stop periodic health checks
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('Stopped health checks');
    }
  }
}

// Singleton instance
let instance = null;

function getHealthCheck(config) {
  if (!instance) {
    instance = new HealthCheckManager(config);
  }
  return instance;
}

module.exports = {
  HealthStatus,
  HealthCheckResult,
  ServiceHealthChecker,
  HealthCheckManager,
  getHealthCheck
};
