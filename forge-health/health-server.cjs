#!/usr/bin/env node
// Health server for forge-health module
// Lightweight HTTP server on port 9002 with zero external dependencies

const http = require('http');
const health = require('./index.cjs');
const breaker = require('./breaker-registry.cjs');

const PORT = process.env.HEALTH_PORT || 9002;
const HOST = process.env.HEALTH_HOST || '0.0.0.0';

// Server instance
let server = null;

/**
 * Handle health check endpoint
 */
function handleHealth(req, res) {
  const status = health.health_get_status();
  
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify(status, null, 2));
}

/**
 * Handle detailed health endpoint
 */
function handleDetailedHealth(req, res) {
  const status = health.health_get_status();
  const allBreakers = breaker.getAllBreakers();
  const safeMode = health.health_get_safe_mode();
  
  const detailed = {
    ...status,
    breakers: allBreakers,
    safeMode: safeMode,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    node: process.version
  };
  
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(JSON.stringify(detailed, null, 2));
}

/**
 * Handle info page
 */
function handleInfo(req, res) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>forge-health</title>
  <style>
    body {
      font-family: monospace;
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 1rem;
      background: #1a1a1a;
      color: #e0e0e0;
    }
    h1 { color: #4fc3f7; }
    h2 { color: #81c784; margin-top: 2rem; }
    a { color: #4fc3f7; }
    pre {
      background: #2a2a2a;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
    }
    .status {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-weight: bold;
    }
    .healthy { background: #2e7d32; }
    .degraded { background: #f57c00; }
    .unhealthy { background: #c62828; }
  </style>
</head>
<body>
  <h1>🏥 forge-health</h1>
  <p>Health monitoring and circuit breaker system for Forge Flow 7.0</p>
  
  <h2>Endpoints</h2>
  <ul>
    <li><a href="/health">/health</a> - Basic health status (JSON)</li>
    <li><a href="/health/detailed">/health/detailed</a> - Detailed status with breakers (JSON)</li>
    <li><a href="/">/</a> - This info page</li>
  </ul>
  
  <h2>Current Status</h2>
  <div id="status">Loading...</div>
  
  <h2>Circuit Breaker States</h2>
  <ul>
    <li><strong>CLOSED</strong> - Service healthy, requests flowing normally</li>
    <li><strong>OPEN</strong> - Service unhealthy after 3 failures, blocking requests</li>
    <li><strong>HALF_OPEN</strong> - Testing after 60s timeout, one success closes breaker</li>
  </ul>
  
  <h2>Safe Mode Integration</h2>
  <p>When any breaker is OPEN, safe mode activates automatically to protect infrastructure.</p>
  <p>forge-guard honors safe mode and blocks write operations until breakers recover.</p>
  
  <script>
    fetch('/health')
      .then(r => r.json())
      .then(data => {
        const statusEl = document.getElementById('status');
        const statusClass = data.status === 'healthy' ? 'healthy' : 
                           data.status === 'degraded' ? 'degraded' : 'unhealthy';
        statusEl.innerHTML = \`
          <span class="status \${statusClass}">\${data.status.toUpperCase()}</span>
          <pre>\${JSON.stringify(data, null, 2)}</pre>
        \`;
      })
      .catch(err => {
        document.getElementById('status').innerHTML = 
          '<span class="status unhealthy">ERROR</span><p>' + err.message + '</p>';
      });
  </script>
</body>
</html>`;
  
  res.writeHead(200, {
    'Content-Type': 'text/html',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.end(html);
}

/**
 * Request handler
 */
function handleRequest(req, res) {
  const url = req.url;
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // Route requests
  if (url === '/health') {
    handleHealth(req, res);
  } else if (url === '/health/detailed') {
    handleDetailedHealth(req, res);
  } else if (url === '/') {
    handleInfo(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}

/**
 * Start the server
 */
function start() {
  server = http.createServer(handleRequest);
  
  server.listen(PORT, HOST, () => {
    console.log(`[forge-health] Server running at http://${HOST}:${PORT}`);
    console.log(`[forge-health] Health endpoint: http://${HOST}:${PORT}/health`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/**
 * Graceful shutdown
 */
function shutdown() {
  console.log('[forge-health] Shutting down gracefully...');
  
  if (server) {
    server.close(() => {
      console.log('[forge-health] Server closed');
      process.exit(0);
    });
    
    // Force exit after 5 seconds
    setTimeout(() => {
      console.log('[forge-health] Forcing shutdown');
      process.exit(1);
    }, 5000);
  } else {
    process.exit(0);
  }
}

// Start if run directly
if (require.main === module) {
  start();
}

module.exports = { start, shutdown };
