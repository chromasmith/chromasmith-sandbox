/**
 * Forge Flow 6.4 - Repository CRUD Verbs
 * Read, write, list operations for Forge Maps
 * Integrates with: durability (WAL, audit), context (scoring)
 */

const fs = require('fs').promises;
const path = require('path');
const durability = require('./durability.cjs');
const context = require('./context.cjs');

const FORGE_ROOT = path.join(__dirname, '..');
const MAPS_ROOT = path.join(FORGE_ROOT, 'maps');

/**
 * Read a map by ID
 * @param {string} mapId - Map identifier
 * @returns {object} Map data
 */
async function read(mapId) {
  const mapPath = path.join(MAPS_ROOT, `${mapId}.json`);
  
  try {
    const content = await fs.readFile(mapPath, 'utf8');
    const map = JSON.parse(content);
    
    // Update hot index on read
    await context.updateHotIndex(mapId, `read-${Date.now()}`);
    
    return map;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Map not found: ${mapId}`);
    }
    throw new Error(`Failed to read map ${mapId}: ${error.message}`);
  }
}

/**
 * Write/update a map
 * @param {string} mapId - Map identifier
 * @param {object} mapData - Map content
 * @param {string} runId - Run ID for tracking
 * @returns {void}
 */
async function write(mapId, mapData, runId) {
  // Ensure maps directory exists
  await fs.mkdir(MAPS_ROOT, { recursive: true });
  
  // Add/update metadata
  const now = new Date().toISOString();
  const map = {
    ...mapData,
    id: mapId,
    updated_at: now,
    created_at: mapData.created_at || now
  };
  
  // Write via durability layer (WAL + fsync)
  const targetPath = `maps/${mapId}.json`;
  await durability.atomicWriteJson(targetPath, map, runId);
  
  // Update context system
  await context.upsertMap(mapId, map, runId);
  
  // Audit log
  await durability.appendAuditLog({
    action: 'repo.write',
    map_id: mapId,
    run_id: runId,
    timestamp: now
  });
}

/**
 * List maps with optional filters
 * @param {object} filters - Filter criteria { tags: [], status: 'active' }
 * @returns {array} Array of map metadata
 */
async function list(filters = {}) {
  try {
    // Ensure maps directory exists
    await fs.mkdir(MAPS_ROOT, { recursive: true });
    
    const files = await fs.readdir(MAPS_ROOT);
    const mapFiles = files.filter(f => f.endsWith('.json'));
    
    const maps = [];
    for (const file of mapFiles) {
      try {
        const mapPath = path.join(MAPS_ROOT, file);
        const content = await fs.readFile(mapPath, 'utf8');
        const map = JSON.parse(content);
        
        // Apply filters
        let match = true;
        
        if (filters.tags && filters.tags.length > 0) {
          const mapTags = map.tags || [];
          match = filters.tags.some(tag => mapTags.includes(tag));
        }
        
        if (filters.status && map.status !== filters.status) {
          match = false;
        }
        
        if (match) {
          maps.push({
            id: map.id,
            tags: map.tags || [],
            status: map.status || 'active',
            created_at: map.created_at,
            updated_at: map.updated_at
          });
        }
      } catch (err) {
        console.warn(`Skipping malformed map: ${file}`);
      }
    }
    
    return maps;
  } catch (error) {
    throw new Error(`Failed to list maps: ${error.message}`);
  }
}

module.exports = {
  read,
  write,
  list
};