/**
 * Playbook Dependency Analyzer
 * Detects dependencies between playbooks to prevent unsafe removal
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Build dependency graph from manifest
 */
async function buildDependencyGraph(manifestPath) {
  const content = await fs.readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(content);
  
  const graph = {
    nodes: new Map(),
    edges: []
  };
  
  // Add all chunks as nodes
  for (const chunk of manifest.chunks) {
    graph.nodes.set(chunk.id, {
      id: chunk.id,
      file: chunk.file,
      depends: chunk.depends || [],
      dependents: []  // Will populate this
    });
  }
  
  // Build edges and populate dependents
  for (const chunk of manifest.chunks) {
    if (chunk.depends && chunk.depends.length > 0) {
      for (const depId of chunk.depends) {
        graph.edges.push({ from: chunk.id, to: depId });
        
        const depNode = graph.nodes.get(depId);
        if (depNode) {
          depNode.dependents.push(chunk.id);
        }
      }
    }
  }
  
  return graph;
}

/**
 * Check if a playbook can be safely removed
 */
function canRemove(graph, chunkId) {
  const node = graph.nodes.get(chunkId);
  if (!node) {
    return { safe: false, reason: 'Chunk not found' };
  }
  
  if (node.dependents.length > 0) {
    return {
      safe: false,
      reason: 'Other playbooks depend on this',
      dependents: node.dependents
    };
  }
  
  return { safe: true };
}

/**
 * Get removal order (reverse topological sort)
 */
function getRemovalOrder(graph, chunkIds) {
  const visited = new Set();
  const order = [];
  
  function visit(id) {
    if (visited.has(id)) return;
    visited.add(id);
    
    const node = graph.nodes.get(id);
    if (!node) return;
    
    // Visit dependents first
    for (const depId of node.dependents) {
      if (chunkIds.includes(depId)) {
        visit(depId);
      }
    }
    
    order.push(id);
  }
  
  for (const id of chunkIds) {
    visit(id);
  }
  
  return order;
}

/**
 * Detect circular dependencies
 */
function detectCircular(graph) {
  const visited = new Set();
  const recursionStack = new Set();
  const cycles = [];
  
  function visit(id, path = []) {
    if (recursionStack.has(id)) {
      cycles.push([...path, id]);
      return;
    }
    
    if (visited.has(id)) return;
    
    visited.add(id);
    recursionStack.add(id);
    
    const node = graph.nodes.get(id);
    if (node) {
      for (const depId of node.depends) {
        visit(depId, [...path, id]);
      }
    }
    
    recursionStack.delete(id);
  }
  
  for (const id of graph.nodes.keys()) {
    visit(id);
  }
  
  return cycles;
}

module.exports = {
  buildDependencyGraph,
  canRemove,
  getRemovalOrder,
  detectCircular
};