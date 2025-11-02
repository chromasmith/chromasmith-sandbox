/**
 * Playbook Archive System
 * Archives and restores playbooks with full metadata
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const ARCHIVE_BASE = path.join(__dirname, '../_archive/playbooks');

/**
 * Archive a playbook
 */
async function archivePlaybook(chunkId, manifestPath, reason = 'manual') {
  // Read manifest
  const content = await fs.readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(content);
  
  // Find chunk
  const chunk = manifest.chunks.find(c => c.id === chunkId);
  if (!chunk) {
    throw new Error(`Chunk ${chunkId} not found in manifest`);
  }
  
  // Create archive directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveDir = path.join(ARCHIVE_BASE, `${chunkId}_${timestamp}`);
  await fs.mkdir(archiveDir, { recursive: true });
  
  // Copy playbook file
  const playbookPath = path.join(path.dirname(manifestPath), chunk.file);
  const playbookContent = await fs.readFile(playbookPath, 'utf-8');
  await fs.writeFile(
    path.join(archiveDir, path.basename(chunk.file)),
    playbookContent
  );
  
  // Create metadata
  const metadata = {
    chunk_id: chunkId,
    archived_at: new Date().toISOString(),
    reason,
    chunk_metadata: chunk,
    manifest_version: manifest.version
  };
  
  await fs.writeFile(
    path.join(archiveDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  
  return {
    archive_path: archiveDir,
    metadata
  };
}

/**
 * List archived playbooks
 */
async function listArchives() {
  try {
    await fs.mkdir(ARCHIVE_BASE, { recursive: true });
    const entries = await fs.readdir(ARCHIVE_BASE);
    
    const archives = [];
    for (const entry of entries) {
      const metaPath = path.join(ARCHIVE_BASE, entry, 'metadata.json');
      try {
        const content = await fs.readFile(metaPath, 'utf-8');
        const metadata = JSON.parse(content);
        archives.push({
          directory: entry,
          ...metadata
        });
      } catch (err) {
        // Skip invalid archives
      }
    }
    
    return archives.sort((a, b) => 
      b.archived_at.localeCompare(a.archived_at)
    );
  } catch (err) {
    return [];
  }
}

/**
 * Restore a playbook from archive
 */
async function restorePlaybook(archiveName, manifestPath) {
  const archiveDir = path.join(ARCHIVE_BASE, archiveName);
  
  // Read metadata
  const metaContent = await fs.readFile(
    path.join(archiveDir, 'metadata.json'),
    'utf-8'
  );
  const metadata = JSON.parse(metaContent);
  
  // Read current manifest
  const manifestContent = await fs.readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestContent);
  
  // Check if chunk already exists
  if (manifest.chunks.find(c => c.id === metadata.chunk_id)) {
    throw new Error(`Chunk ${metadata.chunk_id} already exists in manifest`);
  }
  
  // Restore playbook file
  const fileName = path.basename(metadata.chunk_metadata.file);
  const archiveFile = path.join(archiveDir, fileName);
  const restorePath = path.join(
    path.dirname(manifestPath),
    metadata.chunk_metadata.file
  );
  
  const content = await fs.readFile(archiveFile, 'utf-8');
  await fs.writeFile(restorePath, content);
  
  // Add back to manifest
  manifest.chunks.push(metadata.chunk_metadata);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  
  return {
    restored: true,
    chunk_id: metadata.chunk_id,
    file: restorePath
  };
}

/**
 * Delete archive
 */
async function deleteArchive(archiveName) {
  const archiveDir = path.join(ARCHIVE_BASE, archiveName);
  await fs.rm(archiveDir, { recursive: true, force: true });
}

module.exports = {
  archivePlaybook,
  listArchives,
  restorePlaybook,
  deleteArchive
};