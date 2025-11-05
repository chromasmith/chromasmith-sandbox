/**
 * Events API Route
 * Returns events timeline from .forge/events_ledger.jsonl
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const router = express.Router();

const EVENTS_FILE = path.join(__dirname, '../../.forge/events_ledger.jsonl');

/**
 * Read events from ledger
 */
async function readEvents(options = {}) {
  const {
    module = null,
    type = null,
    limit = 100
  } = options;

  const events = [];

  if (!fs.existsSync(EVENTS_FILE)) {
    return events;
  }

  const fileStream = fs.createReadStream(EVENTS_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        const event = JSON.parse(line);
        
        // Apply filters
        let include = true;
        
        if (module && event.module !== module) {
          include = false;
        }
        
        if (type && event.type !== type) {
          include = false;
        }
        
        if (include) {
          events.push(event);
        }
      } catch (err) {
        console.error('[EVENTS] Error parsing line:', err.message);
      }
    }
  }

  // Sort by timestamp descending (newest first)
  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Limit results
  if (limit > 0) {
    return events.slice(0, limit);
  }

  return events;
}

/**
 * Get event type distribution
 */
function getEventStats(events) {
  const stats = {
    total: events.length,
    byType: {},
    byModule: {}
  };

  for (const event of events) {
    // Type counts
    const type = event.type || 'unknown';
    stats.byType[type] = (stats.byType[type] || 0) + 1;

    // Module counts
    const module = event.module || 'unknown';
    stats.byModule[module] = (stats.byModule[module] || 0) + 1;
  }

  return stats;
}

/**
 * GET /api/events
 * Returns events timeline
 * Query params: module, type, limit
 */
router.get('/', async (req, res) => {
  try {
    const {
      module = null,
      type = null,
      limit = 100
    } = req.query;

    const events = await readEvents({
      module,
      type,
      limit: parseInt(limit)
    });

    res.json({
      events,
      count: events.length
    });
  } catch (err) {
    console.error('[EVENTS] Error:', err);
    res.status(500).json({
      error: 'Failed to retrieve events',
      message: err.message
    });
  }
});

/**
 * GET /api/events/stats
 * Returns event statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const events = await readEvents({ limit: 1000 }); // Get recent 1000 for stats
    const stats = getEventStats(events);
    res.json(stats);
  } catch (err) {
    console.error('[EVENTS] Error:', err);
    res.status(500).json({
      error: 'Failed to retrieve event statistics',
      message: err.message
    });
  }
});

/**
 * GET /api/events/types
 * Returns list of event types
 */
router.get('/types', async (req, res) => {
  try {
    const events = await readEvents({ limit: 1000 });
    const types = new Set();
    
    for (const event of events) {
      if (event.type) {
        types.add(event.type);
      }
    }

    res.json({ types: Array.from(types).sort() });
  } catch (err) {
    console.error('[EVENTS] Error:', err);
    res.status(500).json({
      error: 'Failed to retrieve event types',
      message: err.message
    });
  }
});

/**
 * GET /api/events/modules
 * Returns list of modules with events
 */
router.get('/modules', async (req, res) => {
  try {
    const events = await readEvents({ limit: 1000 });
    const modules = new Set();
    
    for (const event of events) {
      if (event.module) {
        modules.add(event.module);
      }
    }

    res.json({ modules: Array.from(modules).sort() });
  } catch (err) {
    console.error('[EVENTS] Error:', err);
    res.status(500).json({
      error: 'Failed to retrieve module list',
      message: err.message
    });
  }
});

module.exports = router;
