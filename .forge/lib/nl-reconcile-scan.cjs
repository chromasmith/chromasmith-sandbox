// NL Reconciliation Scanner
// Detects drift between GitHub, ForgeView, and .forge/ state

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getFileHash(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 8);
  } catch {
    return null;
  }
}

async function scanForgeStructure() {
  const basePath = path.join(__dirname, '..');
  const issues = [];
  
  // Required directories
  const requiredDirs = [
    '_wal',
    '_schema',
    'lib',
    'maps',
    'runs',
    'status'
  ];
  
  for (const dir of requiredDirs) {
    const dirPath = path.join(basePath, dir);
    if (!(await fileExists(dirPath))) {
      issues.push({
        type: 'missing_directory',
        severity: 'high',
        path: dir,
        fix: 'create_directory',
        confidence: 1.0
      });
    }
  }
  
  // Required files
  const requiredFiles = [
    'verbs.yml',
    'macros.yml',
    'triggers.yml',
    'audit.jsonl'
  ];
  
  for (const file of requiredFiles) {
    const filePath = path.join(basePath, file);
    if (!(await fileExists(filePath))) {
      issues.push({
        type: 'missing_file',
        severity: 'high',
        path: file,
        fix: 'restore_from_template',
        confidence: 0.8
      });
    }
  }
  
  return issues;
}

async function scanMapIntegrity() {
  const basePath = path.join(__dirname, '..');
  const mapsDir = path.join(basePath, 'maps');
  const issues = [];
  
  try {
    const files = await fs.readdir(mapsDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    for (const file of jsonFiles) {
      const filePath = path.join(mapsDir, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const map = JSON.parse(content);
        
        // Check required fields
        const requiredFields = ['id', 'created_at', 'updated_at', 'status'];
        for (const field of requiredFields) {
          if (!map[field]) {
            issues.push({
              type: 'invalid_map',
              severity: 'medium',
              path: `maps/${file}`,
              field,
              fix: 'add_missing_field',
              confidence: 0.9
            });
          }
        }
        
        // Check status enum
        const validStatuses = ['draft', 'active', 'archived', 'deleted'];
        if (map.status && !validStatuses.includes(map.status)) {
          issues.push({
            type: 'invalid_status',
            severity: 'medium',
            path: `maps/${file}`,
            current: map.status,
            fix: 'correct_status_to_active',
            confidence: 0.85
          });
        }
      } catch (err) {
        issues.push({
          type: 'corrupted_map',
          severity: 'high',
          path: `maps/${file}`,
          error: err.message,
          fix: 'quarantine_and_flag',
          confidence: 1.0
        });
      }
    }
  } catch (err) {
    // Maps directory doesn't exist
    issues.push({
      type: 'missing_directory',
      severity: 'high',
      path: 'maps',
      fix: 'create_directory',
      confidence: 1.0
    });
  }
  
  return issues;
}

async function scanWALIntegrity() {
  const basePath = path.join(__dirname, '..');
  const walPath = path.join(basePath, '_wal', 'pending_writes.jsonl');
  const issues = [];
  
  if (await fileExists(walPath)) {
    try {
      const content = await fs.readFile(walPath, 'utf8');
      const lines = content.trim().split('\n').filter(l => l);
      
      if (lines.length > 100) {
        issues.push({
          type: 'wal_bloat',
          severity: 'low',
          path: '_wal/pending_writes.jsonl',
          count: lines.length,
          fix: 'compact_wal',
          confidence: 0.95
        });
      }
      
      // Check each line is valid JSON
      for (let i = 0; i < lines.length; i++) {
        try {
          JSON.parse(lines[i]);
        } catch {
          issues.push({
            type: 'corrupted_wal_entry',
            severity: 'medium',
            path: `_wal/pending_writes.jsonl:${i+1}`,
            fix: 'remove_corrupted_entry',
            confidence: 0.9
          });
        }
      }
    } catch (err) {
      issues.push({
        type: 'unreadable_wal',
        severity: 'high',
        path: '_wal/pending_writes.jsonl',
        fix: 'backup_and_reset',
        confidence: 0.7
      });
    }
  }
  
  return issues;
}

async function scan(options = {}) {
  const mode = options.mode || 'full'; // 'full' or 'quick'
  const timestamp = new Date().toISOString();
  
  const results = {
    timestamp,
    mode,
    issues: [],
    summary: {
      total: 0,
      high: 0,
      medium: 0,
      low: 0,
      auto_fixable: 0
    }
  };
  
  // Run scans based on mode
  if (mode === 'full' || mode === 'quick') {
    const structureIssues = await scanForgeStructure();
    const mapIssues = await scanMapIntegrity();
    const walIssues = await scanWALIntegrity();
    
    results.issues = [...structureIssues, ...mapIssues, ...walIssues];
  }
  
  // Calculate summary
  results.summary.total = results.issues.length;
  results.summary.high = results.issues.filter(i => i.severity === 'high').length;
  results.summary.medium = results.issues.filter(i => i.severity === 'medium').length;
  results.summary.low = results.issues.filter(i => i.severity === 'low').length;
  results.summary.auto_fixable = results.issues.filter(i => i.confidence >= 0.9).length;
  
  return results;
}

module.exports = { scan, scanForgeStructure, scanMapIntegrity, scanWALIntegrity };