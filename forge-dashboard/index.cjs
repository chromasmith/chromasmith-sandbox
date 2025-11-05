#!/usr/bin/env node
/**
 * Forge Dashboard - Web Dashboard for Forge Flow 7.0
 * Serves real-time monitoring views for all forge modules
 * Port: 9003
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 9003;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Import routes
const healthRoutes = require('./routes/health.cjs');
const auditRoutes = require('./routes/audit.cjs');
const dlqRoutes = require('./routes/dlq.cjs');
const eventsRoutes = require('./routes/events.cjs');

// Register API routes
app.use('/api/health', healthRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/dlq', dlqRoutes);
app.use('/api/events', eventsRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('[DASHBOARD ERROR]', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`[FORGE-DASHBOARD] Running on http://localhost:${PORT}`);
  console.log('[FORGE-DASHBOARD] API endpoints:');
  console.log(`  - GET /api/health  (Module health status)`);
  console.log(`  - GET /api/audit   (Audit log)`);
  console.log(`  - GET /api/dlq     (Dead letter queue)`);
  console.log(`  - GET /api/events  (Events timeline)`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[FORGE-DASHBOARD] Shutting down...');
  server.close(() => {
    console.log('[FORGE-DASHBOARD] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[FORGE-DASHBOARD] Shutting down...');
  server.close(() => {
    console.log('[FORGE-DASHBOARD] Server closed');
    process.exit(0);
  });
});

module.exports = app;
