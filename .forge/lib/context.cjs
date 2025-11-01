const durability = require('./durability.cjs');
const fs = require('fs').promises;
const path = require('path');

const FORGE_ROOT = path.join(__dirname, '..');
const MAX_HOT_INDEX = 50;

// Calculate context score for a map
function calculateScore(map, currentContext = {}) {
  const now = Date.now();
  
  // Freshness weight (0-1)
  const ageMs = now - new Date(map.updated_at || map.created_at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const freshnessWeight = Math.max(0, 1 - (ageDays / 90)); // Decay over 90 days
  
  // Tags match weight (0-1)
  const contextTags = currentContext.tags || [];
  const mapTags = map.tags || [];
  const matchingTags = mapTags.filter(t => contextTags.includes(t)).length;
  const tagsMatchWeight = contextTags.length > 0 
    ? matchingTags / contextTags.length 
    : 0.5;
  
  // Semantic relevance (stub for now, would use embeddings)
  const semanticRelevance = 0.5; // Placeholder
  
  // Base score calculation
  const baseScore = (0.4 * freshnessWeight) + 
                   (0.2 * tagsMatchWeight) + 
                   (0.4 * semanticRelevance);
  
  // Playbook boost
  const playbookBoost = map.playbook_required ? 0.15 : 0;
  
  // Final normalized score
  const totalScore = Math.min(1.0, baseScore + playbookBoost);
  
  return {
    total: totalScore,
    breakdown: {
      freshness: freshnessWeight,
      tags_match: tagsMatchWeight,
      semantic: semanticRelevance,
      playbook_boost: playbookBoost
    }
  };
}

// Load map index
async function loadMapIndex() {
  const indexPath = path.join(FORGE_ROOT, 'context/map_index_with_triggers.json');
  try {
    const content = await fs.readFile(indexPath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    return { maps: [], version: '6.4', updated_at: new Date().toISOString() };
  }
}

// Save map index
async function saveMapIndex(index, runId) {
  await durability.atomicWriteJson(
    'context/map_index_with_triggers.json',
    index,
    runId
  );
}

// Load hot index
async function loadHotIndex() {
  const hotPath = path.join(FORGE_ROOT, 'context/hot_index.json');
  try {
    const content = await fs.readFile(hotPath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    return { entries: [], updated_at: new Date().toISOString() };
  }
}

// Update hot index (keep top 50 by access count)
async function updateHotIndex(mapId, runId) {
  const hotIndex = await loadHotIndex();
  
  // Find or create entry
  let entry = hotIndex.entries.find(e => e.map_id === mapId);
  if (entry) {
    entry.access_count++;
    entry.last_accessed = new Date().toISOString();
  } else {
    entry = {
      map_id: mapId,
      access_count: 1,
      first_accessed: new Date().toISOString(),
      last_accessed: new Date().toISOString()
    };
    hotIndex.entries.push(entry);
  }
  
  // Sort by access count and keep top 50
  hotIndex.entries.sort((a, b) => b.access_count - a.access_count);
  hotIndex.entries = hotIndex.entries.slice(0, MAX_HOT_INDEX);
  hotIndex.updated_at = new Date().toISOString();
  
  await durability.atomicWriteJson('context/hot_index.json', hotIndex, runId);
  
  return hotIndex;
}

// Create or update a map
async function upsertMap(mapId, mapData, runId) {
  const index = await loadMapIndex();
  
  // Remove existing entry if updating
  index.maps = index.maps.filter(m => m.id !== mapId);
  
  // Add new entry with metadata
  const mapEntry = {
    id: mapId,
    ...mapData,
    updated_at: new Date().toISOString(),
    version: mapData.version || 1
  };
  
  index.maps.push(mapEntry);
  index.updated_at = new Date().toISOString();
  
  // Save index
  await saveMapIndex(index, runId);
  
  // Update hot index
  await updateHotIndex(mapId, runId);
  
  // Audit log
  await durability.appendAuditLog({
    action: 'context.upsertMap',
    map_id: mapId,
    run_id: runId
  });
  
  return mapEntry;
}

// Get top N maps by score
async function getTopMaps(contextHint = {}, limit = 8) {
  const index = await loadMapIndex();
  
  // Calculate scores for all maps
  const scoredMaps = index.maps.map(map => ({
    ...map,
    score: calculateScore(map, contextHint)
  }));
  
  // Sort by score and return top N
  scoredMaps.sort((a, b) => b.score.total - a.score.total);
  
  return scoredMaps.slice(0, limit);
}

// Check if map is in hot index
async function isHot(mapId) {
  const hotIndex = await loadHotIndex();
  return hotIndex.entries.some(e => e.map_id === mapId);
}

module.exports = {
  calculateScore,
  loadMapIndex,
  saveMapIndex,
  loadHotIndex,
  updateHotIndex,
  upsertMap,
  getTopMaps,
  isHot
};