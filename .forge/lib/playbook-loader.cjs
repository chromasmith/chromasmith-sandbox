// Playbook Selective Loader
// Loads chunks based on triggers, dependencies, and token budget

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

async function loadManifest() {
  const manifestPath = path.join(__dirname, '../..', 'playbooks', 'manifest.json');
  const content = await fs.readFile(manifestPath, 'utf8');
  return JSON.parse(content);
}

async function loadChunk(chunkFile) {
  const chunkPath = path.join(__dirname, '../..', 'playbooks', chunkFile);
  const content = await fs.readFile(chunkPath, 'utf8');
  return content;
}

function calculateHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function scoreChunk(chunk, triggers = []) {
  // Always-load chunks get max score
  if (chunk.priority === 'always_load') {
    return 1000;
  }
  
  // Trigger-based chunks score by trigger matches
  if (triggers.length === 0) {
    return 0;
  }
  
  const triggerLower = triggers.map(t => t.toLowerCase());
  const matches = chunk.triggers.filter(t => 
    triggerLower.some(tl => tl.includes(t.toLowerCase()) || t.toLowerCase().includes(tl))
  );
  
  // Score: 10 points per trigger match
  return matches.length * 10;
}

function resolveDependencies(chunks, selectedIds) {
  const resolved = new Set(selectedIds);
  let changed = true;
  
  // Keep adding dependencies until no more changes
  while (changed) {
    changed = false;
    for (const chunkId of resolved) {
      const chunk = chunks.find(c => c.id === chunkId);
      if (chunk && chunk.depends) {
        for (const dep of chunk.depends) {
          if (!resolved.has(dep)) {
            resolved.add(dep);
            changed = true;
          }
        }
      }
    }
  }
  
  return Array.from(resolved);
}

async function loadPlaybook(options = {}) {
  const triggers = options.triggers || [];
  const maxTokens = options.maxTokens || 15000;
  const forceLoad = options.forceLoad || [];
  
  const manifest = await loadManifest();
  const chunks = manifest.chunks;
  
  // Step 1: Score all chunks
  const scored = chunks.map(chunk => ({
    ...chunk,
    score: scoreChunk(chunk, triggers)
  }));
  
  // Step 2: Sort by score (highest first)
  scored.sort((a, b) => b.score - a.score);
  
  // Step 3: Select chunks within token budget
  let selectedIds = [];
  let tokenCount = 0;
  
  // First pass: Always-load and force-load (with budget check)
  for (const chunk of scored) {
    if (chunk.priority === 'always_load' || forceLoad.includes(chunk.id)) {
      // Check budget even for always-load
      if (tokenCount + chunk.tokens <= maxTokens) {
        selectedIds.push(chunk.id);
        tokenCount += chunk.tokens;
      } else {
        // Log warning if always-load chunks exceed budget
        console.warn(`Warning: Skipping ${chunk.id} (always_load) - would exceed budget`);
      }
    }
  }
  
  // Second pass: Trigger-based chunks (highest score first)
  for (const chunk of scored) {
    if (chunk.priority === 'trigger_based' && chunk.score > 0) {
      if (tokenCount + chunk.tokens <= maxTokens) {
        selectedIds.push(chunk.id);
        tokenCount += chunk.tokens;
      }
    }
  }
  
  // Step 4: Resolve dependencies
  selectedIds = resolveDependencies(chunks, selectedIds);
  
  // Step 5: Load selected chunks
  const loaded = [];
  for (const chunkId of selectedIds) {
    const chunk = chunks.find(c => c.id === chunkId);
    if (chunk) {
      const content = await loadChunk(chunk.file);
      const hash = calculateHash(content);
      
      loaded.push({
        id: chunk.id,
        file: chunk.file,
        tokens: chunk.tokens,
        priority: chunk.priority,
        content,
        hash
      });
    }
  }
  
  // Sort by dependency order (dependencies first)
  const orderedIds = topologicalSort(chunks, selectedIds);
  const ordered = orderedIds.map(id => loaded.find(c => c.id === id)).filter(Boolean);
  
  return {
    manifest: {
      version: manifest.version,
      total_chunks: chunks.length,
      loaded_chunks: ordered.length,
      token_budget: maxTokens,
      tokens_used: tokenCount
    },
    chunks: ordered,
    timestamp: new Date().toISOString()
  };
}

function topologicalSort(allChunks, selectedIds) {
  const selected = allChunks.filter(c => selectedIds.includes(c.id));
  const sorted = [];
  const visited = new Set();
  
  function visit(chunkId) {
    if (visited.has(chunkId)) return;
    visited.add(chunkId);
    
    const chunk = selected.find(c => c.id === chunkId);
    if (!chunk) return;
    
    // Visit dependencies first
    if (chunk.depends) {
      for (const dep of chunk.depends) {
        if (selectedIds.includes(dep)) {
          visit(dep);
        }
      }
    }
    
    sorted.push(chunkId);
  }
  
  for (const chunkId of selectedIds) {
    visit(chunkId);
  }
  
  return sorted;
}

async function cachePlaybook(playbook) {
  const cachePath = path.join(__dirname, '..', '_cache');
  const cacheFile = path.join(cachePath, 'playbook_session.json');
  
  // Ensure cache directory exists
  await fs.mkdir(cachePath, { recursive: true });
  
  // Write cache (without full content to save space)
  const cacheData = {
    ...playbook,
    chunks: playbook.chunks.map(c => ({
      id: c.id,
      file: c.file,
      tokens: c.tokens,
      hash: c.hash
    }))
  };
  
  await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2), 'utf8');
}

module.exports = { loadPlaybook, cachePlaybook };
