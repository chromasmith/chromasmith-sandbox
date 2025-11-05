/**
 * Forge Cairns Metrics Server
 * Lightweight HTTP server for exposing Prometheus metrics
 * 
 * Port: 9001
 * Endpoints:
 *   - GET /metrics (Prometheus text format)
 *   - GET /health (Health check)
 */

const http = require('http');
const { getMetrics } = require('./lib/metrics.cjs');

const PORT = process.env.METRICS_PORT || 9001;
const HOST = process.env.METRICS_HOST || '0.0.0.0';

/**
 * Create HTTP server
 */
const server = http.createServer((req, res) => {
  // CORS headers for cross-origin access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Route handling
  if (req.method === 'GET' && req.url === '/metrics') {
    handleMetrics(req, res);
  } else if (req.method === 'GET' && req.url === '/health') {
    handleHealth(req, res);
  } else if (req.method === 'GET' && req.url === '/') {
    handleRoot(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found', path: req.url }));
  }
});

/**
 * Handle /metrics endpoint
 * Returns metrics in Prometheus text format
 */
function handleMetrics(req, res) {
  try {
    const metrics = getMetrics();
    const prometheus = metrics.exportPrometheus();
    
    res.writeHead(200, { 
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8'
    });
    res.end(prometheus);
  } catch (error) {
    console.error('Error exporting metrics:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Internal Server Error',
      message: error.message 
    }));
  }
}

/**
 * Handle /health endpoint
 * Returns service health status
 */
function handleHealth(req, res) {
  try {
    const metrics = getMetrics();
    const allMetrics = metrics.getAll();
    
    const health = {
      status: 'ok',
      module: 'forge-cairns',
      uptime: allMetrics._system?.uptime || 0,
      timestamp: allMetrics._system?.timestamp || Date.now(),
      metrics_count: Object.keys(allMetrics).length - 1 // Exclude _system
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health, null, 2));
  } catch (error) {
    console.error('Error checking health:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'error',
      module: 'forge-cairns',
      message: error.message 
    }));
  }
}

/**
 * Handle / root endpoint
 * Returns available endpoints
 */
function handleRoot(req, res) {
  const info = {
    service: 'Forge Cairns Metrics Server',
    version: '1.0.0',
    endpoints: {
      metrics: '/metrics',
      health: '/health'
    },
    documentation: {
      metrics: 'Prometheus-formatted metrics for observability',
      health: 'Service health and uptime information'
    }
  };
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(info, null, 2));
}

/**
 * Start server
 */
function startServer() {
  server.listen(PORT, HOST, () => {
    console.log(`Forge Cairns Metrics Server running on http://${HOST}:${PORT}`);
    console.log(`Endpoints:`);
    console.log(`  - GET http://${HOST}:${PORT}/metrics (Prometheus format)`);
    console.log(`  - GET http://${HOST}:${PORT}/health (Health check)`);
    console.log(`  - GET http://${HOST}:${PORT}/ (Service info)`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    console.log('SIGINT received, closing server...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

// Auto-start if run directly
if (require.main === module) {
  startServer();
}

module.exports = {
  server,
  startServer
};
