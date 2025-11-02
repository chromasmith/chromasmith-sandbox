/**
 * Health Server for Forge Flow 6.4
 * Exposes health check and metrics endpoints
 */

const http = require('http');
const { getHealthCheck } = require('./lib/health-check.cjs');
const { getMetrics } = require('./lib/metrics.cjs');
const { getDLQManager } = require('./lib/dlq-manager.cjs');
const { getLogger } = require('./lib/logger.cjs');

const PORT = process.env.PORT || 3100;
const logger = getLogger();
const health = getHealthCheck();
const metrics = getMetrics();
const dlq = getDLQManager();

/**
 * Register example health checks
 */
function registerHealthChecks() {
  // System health
  health.register('system', async () => {
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    
    return {
      ok: true,
      uptime,
      memory: {
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(memory.rss / 1024 / 1024) + 'MB'
      }
    };
  });
  
  // DLQ health
  health.register('dlq', async () => {
    const stats = await dlq.getStats();
    return {
      ok: stats.failed < 100, // Unhealthy if >100 failed
      stats
    };
  });
  
  logger.info('Health checks registered');
}

/**
 * Handle HTTP requests
 */
function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Routes
  if (url.pathname === '/health') {
    handleHealthCheck(req, res);
  } else if (url.pathname === '/health/detailed') {
    handleDetailedHealth(req, res);
  } else if (url.pathname === '/metrics') {
    handleMetrics(req, res);
  } else if (url.pathname === '/metrics/prometheus') {
    handlePrometheus(req, res);
  } else if (url.pathname === '/') {
    handleRoot(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}

/**
 * Quick health check
 */
async function handleHealthCheck(req, res) {
  try {
    const status = health.getAggregateStatus();
    const httpStatus = status.status === 'healthy' ? 200 : 503;
    
    res.writeHead(httpStatus, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: status.status,
      timestamp: status.timestamp,
      services: {
        total: status.total,
        healthy: status.healthy,
        degraded: status.degraded,
        unhealthy: status.unhealthy
      }
    }, null, 2));
  } catch (error) {
    logger.error('Health check failed', { error });
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

/**
 * Detailed health check
 */
async function handleDetailedHealth(req, res) {
  try {
    await health.checkAll();
    const status = health.getAggregateStatus();
    const httpStatus = status.status === 'healthy' ? 200 : 503;
    
    res.writeHead(httpStatus, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status, null, 2));
  } catch (error) {
    logger.error('Detailed health check failed', { error });
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

/**
 * Metrics endpoint
 */
function handleMetrics(req, res) {
  try {
    const allMetrics = metrics.getAll();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(allMetrics, null, 2));
  } catch (error) {
    logger.error('Metrics fetch failed', { error });
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

/**
 * Prometheus metrics endpoint
 */
function handlePrometheus(req, res) {
  try {
    const prometheus = metrics.exportPrometheus();
    
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(prometheus);
  } catch (error) {
    logger.error('Prometheus export failed', { error });
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('# Error exporting metrics\n');
  }
}

/**
 * Root endpoint
 */
function handleRoot(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Forge Flow Health Server</title>
      <style>
        body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
        h1 { color: #333; }
        a { display: block; margin: 10px 0; color: #0066cc; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1>Forge Flow 6.4 Health Server</h1>
      <h2>Available Endpoints:</h2>
      <a href="/health">GET /health - Quick health check</a>
      <a href="/health/detailed">GET /health/detailed - Detailed health status</a>
      <a href="/metrics">GET /metrics - JSON metrics</a>
      <a href="/metrics/prometheus">GET /metrics/prometheus - Prometheus format</a>
    </body>
    </html>
  `);
}

/**
 * Start server
 */
function startServer() {
  registerHealthChecks();
  
  const server = http.createServer(handleRequest);
  
  server.listen(PORT, () => {
    logger.info(`Health server listening on port ${PORT}`);
    console.log(`🚀 Forge Flow Health Server running on http://localhost:${PORT}`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
  
  // Start periodic health checks
  health.start();
}

// Start
startServer();
