/**
 * Health API Route
 * Returns current health status of all forge modules
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const STATUS_DIR = path.join(__dirname, '../../.forge/status');

// Module list
const MODULES = [
  'forge-core',
  'forge-speak',
  'forge-guard',
  'forge-build',
  'forge-view',
  'forge-cairns',
  'forge-health',
  'forge-pulse',
  'forge-tokens',
  'forge-stubs',
  'forge-tendrils',
  'forge-playbooks'
];

/**
 * GET /api/health
 * Returns health status for all modules
 */
router.get('/', async (req, res) => {
  try {
    const healthData = {
      timestamp: new Date().toISOString(),
      modules: [],
      summary: {
        total: MODULES.length,
        healthy: 0,
        degraded: 0,
        down: 0
      }
    };

    // Read health status for each module
    for (const module of MODULES) {
      const statusFile = path.join(STATUS_DIR, `${module}.json`);
      let moduleStatus = {
        name: module,
        status: 'unknown',
        circuitBreaker: 'CLOSED',
        safeMode: false,
        lastCheck: null,
        lastSuccess: null,
        errorCount: 0,
        message: 'No status file found'
      };

      try {
        if (fs.existsSync(statusFile)) {
          const data = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
          moduleStatus = {
            name: module,
            status: data.status || 'unknown',
            circuitBreaker: data.circuitBreaker || 'CLOSED',
            safeMode: data.safeMode || false,
            lastCheck: data.lastCheck || null,
            lastSuccess: data.lastSuccess || null,
            errorCount: data.errorCount || 0,
            message: data.message || 'OK'
          };

          // Update summary counts
          if (moduleStatus.status === 'healthy') {
            healthData.summary.healthy++;
          } else if (moduleStatus.status === 'degraded') {
            healthData.summary.degraded++;
          } else {
            healthData.summary.down++;
          }
        } else {
          healthData.summary.down++;
        }
      } catch (err) {
        console.error(`[HEALTH] Error reading status for ${module}:`, err.message);
        moduleStatus.message = `Error reading status: ${err.message}`;
        healthData.summary.down++;
      }

      healthData.modules.push(moduleStatus);
    }

    res.json(healthData);
  } catch (err) {
    console.error('[HEALTH] Error:', err);
    res.status(500).json({
      error: 'Failed to retrieve health data',
      message: err.message
    });
  }
});

module.exports = router;
