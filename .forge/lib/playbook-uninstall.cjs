/**
 * Playbook Uninstall System
 * Safe removal with dependency checking and cleanup
 */

const fs = require('fs').promises;
const path = require('path');
const { buildDependencyGraph, canRemove, getRemovalOrder } = require('./playbook-dependencies.cjs');
const { archivePlaybook } = require('./playbook-archive.cjs');

/**
 * Uninstall a playbook
 */
async function uninstallPlaybook(chunkId, manifestPath, options = {}) {
  const {
    force = false,
    skipArchive = false,
    reason = 'manual_uninstall'
  } = options;
  
  // Build dependency graph
  const graph = await buildDependencyGraph(manifestPath);
  
  // Check if safe to remove
  const check = canRemove(graph, chunkId);
  if (!check.safe && !force) {
    throw new Error(
      `Cannot remove ${chunkId}: ${check.reason}. ` +
      `Dependents: ${check.dependents.join(', ')}. ` +
      `Use force=true to override.`
    );
  }
  
  // Archive first (unless skipped)
  let archiveInfo = null;
  if (!skipArchive) {
    archiveInfo = await archivePlaybook(chunkId, manifestPath, reason);
  }
  
  // Read manifest
  const content = await fs.readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(content);
  
  // Find and remove chunk
  const chunkIndex = manifest.chunks.findIndex(c => c.id === chunkId);
  if (chunkIndex === -1) {
    throw new Error(`Chunk ${chunkId} not found`);
  }
  
  const chunk = manifest.chunks[chunkIndex];
  
  // Delete playbook file
  const playbookPath = path.join(path.dirname(manifestPath), chunk.file);
  try {
    await fs.unlink(playbookPath);
  } catch (err) {
    // File might not exist, continue
  }
  
  // Remove from manifest
  manifest.chunks.splice(chunkIndex, 1);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  
  // Log to audit
  const auditEntry = {
    timestamp: new Date().toISOString(),
    operation: 'playbook_uninstall',
    chunk_id: chunkId,
    forced: force,
    archived: !skipArchive,
    archive_path: archiveInfo?.archive_path,
    reason
  };
  
  await appendAudit(auditEntry);
  
  return {
    success: true,
    chunk_id: chunkId,
    archived: !skipArchive,
    archive_info: archiveInfo
  };
}

/**
 * Uninstall multiple playbooks in safe order
 */
async function uninstallMultiple(chunkIds, manifestPath, options = {}) {
  const graph = await buildDependencyGraph(manifestPath);
  const order = getRemovalOrder(graph, chunkIds);
  
  const results = [];
  for (const id of order) {
    try {
      const result = await uninstallPlaybook(id, manifestPath, options);
      results.push(result);
    } catch (err) {
      results.push({
        success: false,
        chunk_id: id,
        error: err.message
      });
      
      if (!options.continueOnError) {
        break;
      }
    }
  }
  
  return results;
}

/**
 * Append to audit log
 */
async function appendAudit(entry) {
  const auditPath = path.join(__dirname, '../audit.jsonl');
  await fs.appendFile(auditPath, JSON.stringify(entry) + '\n');
}

module.exports = {
  uninstallPlaybook,
  uninstallMultiple
};