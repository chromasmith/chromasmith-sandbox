/**
 * DLQ (Dead Letter Queue) API Route
 * Returns failed operations from .forge/_dlq/*.jsonl
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const router = express.Router();

const DLQ_DIR = path.join(__dirname, '../../.forge/_dlq');

/**
 * Read all DLQ entries
 */
async function readDLQEntries() {
  const entries = [];

  if (!fs.existsSync(DLQ_DIR)) {
    return entries;
  }

  const files = fs.readdirSync(DLQ_DIR).filter(f => f.endsWith('.jsonl'));

  for (const file of files) {
    const filePath = path.join(DLQ_DIR, file);
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (line.trim()) {
        try {
          const entry = JSON.parse(line);
          entry.sourceFile = file;
          entries.push(entry);
        } catch (err) {
          console.error(`[DLQ] Error parsing line in ${file}:`, err.message);
        }
      }
    }
  }

  // Sort by timestamp descending (newest first)
  entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return entries;
}

/**
 * Calculate DLQ statistics
 */
function calculateStats(entries) {
  const stats = {
    total: entries.length,
    byStatus: {
      failed: 0,
      replaying: 0,
      resolved: 0
    },
    byError: {},
    byModule: {}
  };

  for (const entry of entries) {
    // Status counts
    const status = entry.status || 'failed';
    if (stats.byStatus[status] !== undefined) {
      stats.byStatus[status]++;
    }

    // Error type counts
    const errorType = entry.error?.type || 'unknown';
    stats.byError[errorType] = (stats.byError[errorType] || 0) + 1;

    // Module counts
    const module = entry.module || 'unknown';
    stats.byModule[module] = (stats.byModule[module] || 0) + 1;
  }

  return stats;
}

/**
 * GET /api/dlq
 * Returns DLQ statistics and entries
 * Query params: status, module, limit
 */
router.get('/', async (req, res) => {
  try {
    const {
      status = null,
      module = null,
      limit = 100
    } = req.query;

    let entries = await readDLQEntries();

    // Apply filters
    if (status) {
      entries = entries.filter(e => e.status === status);
    }
    
    if (module) {
      entries = entries.filter(e => e.module === module);
    }

    // Limit results
    const limitNum = parseInt(limit);
    if (limitNum > 0) {
      entries = entries.slice(0, limitNum);
    }

    const stats = calculateStats(await readDLQEntries()); // Stats from all entries

    res.json({
      stats,
      entries,
      count: entries.length
    });
  } catch (err) {
    console.error('[DLQ] Error:', err);
    res.status(500).json({
      error: 'Failed to retrieve DLQ data',
      message: err.message
    });
  }
});

/**
 * GET /api/dlq/stats
 * Returns only DLQ statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const entries = await readDLQEntries();
    const stats = calculateStats(entries);
    res.json(stats);
  } catch (err) {
    console.error('[DLQ] Error:', err);
    res.status(500).json({
      error: 'Failed to retrieve DLQ statistics',
      message: err.message
    });
  }
});

/**
 * GET /api/dlq/:id
 * Returns specific DLQ entry by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const entries = await readDLQEntries();
    const entry = entries.find(e => e.id === id);

    if (!entry) {
      return res.status(404).json({
        error: 'DLQ entry not found',
        id
      });
    }

    res.json(entry);
  } catch (err) {
    console.error('[DLQ] Error:', err);
    res.status(500).json({
      error: 'Failed to retrieve DLQ entry',
      message: err.message
    });
  }
});

module.exports = router;
