/**
 * Audit API Route
 * Returns audit log entries from .forge/audit.jsonl
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const router = express.Router();

const AUDIT_FILE = path.join(__dirname, '../../.forge/audit.jsonl');

/**
 * Read audit log with pagination
 */
async function readAuditLog(options = {}) {
  const {
    module = null,
    page = 1,
    perPage = 20,
    dateFrom = null,
    dateTo = null
  } = options;

  const entries = [];

  if (!fs.existsSync(AUDIT_FILE)) {
    return {
      entries: [],
      total: 0,
      page,
      perPage,
      totalPages: 0
    };
  }

  // Read all entries (reversed for newest first)
  const fileStream = fs.createReadStream(AUDIT_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const allEntries = [];
  for await (const line of rl) {
    if (line.trim()) {
      try {
        const entry = JSON.parse(line);
        
        // Apply filters
        let include = true;
        
        if (module && entry.module !== module) {
          include = false;
        }
        
        if (dateFrom && new Date(entry.timestamp) < new Date(dateFrom)) {
          include = false;
        }
        
        if (dateTo && new Date(entry.timestamp) > new Date(dateTo)) {
          include = false;
        }
        
        if (include) {
          allEntries.push(entry);
        }
      } catch (err) {
        console.error('[AUDIT] Error parsing line:', err.message);
      }
    }
  }

  // Sort by timestamp descending (newest first)
  allEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Pagination
  const total = allEntries.length;
  const totalPages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const paginatedEntries = allEntries.slice(start, end);

  return {
    entries: paginatedEntries,
    total,
    page,
    perPage,
    totalPages
  };
}

/**
 * GET /api/audit
 * Returns paginated audit log
 * Query params: module, page, perPage, dateFrom, dateTo
 */
router.get('/', async (req, res) => {
  try {
    const {
      module = null,
      page = 1,
      perPage = 20,
      dateFrom = null,
      dateTo = null
    } = req.query;

    const result = await readAuditLog({
      module,
      page: parseInt(page),
      perPage: parseInt(perPage),
      dateFrom,
      dateTo
    });

    res.json(result);
  } catch (err) {
    console.error('[AUDIT] Error:', err);
    res.status(500).json({
      error: 'Failed to retrieve audit log',
      message: err.message
    });
  }
});

/**
 * GET /api/audit/modules
 * Returns list of modules that have audit entries
 */
router.get('/modules', async (req, res) => {
  try {
    const modules = new Set();

    if (!fs.existsSync(AUDIT_FILE)) {
      return res.json({ modules: [] });
    }

    const fileStream = fs.createReadStream(AUDIT_FILE);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (line.trim()) {
        try {
          const entry = JSON.parse(line);
          if (entry.module) {
            modules.add(entry.module);
          }
        } catch (err) {
          // Skip invalid lines
        }
      }
    }

    res.json({ modules: Array.from(modules).sort() });
  } catch (err) {
    console.error('[AUDIT] Error:', err);
    res.status(500).json({
      error: 'Failed to retrieve module list',
      message: err.message
    });
  }
});

module.exports = router;
