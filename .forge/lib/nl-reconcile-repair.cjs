// NL Reconciliation Repair
// Auto-fixes drift issues with confidence thresholds

const fs = require('fs').promises;
const path = require('path');

async function repairMissingDirectory(issue) {
  const basePath = path.join(__dirname, '..');
  const dirPath = path.join(basePath, issue.path);
  
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return { success: true, action: 'created_directory', path: issue.path };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function repairInvalidStatus(issue) {
  const basePath = path.join(__dirname, '..');
  const filePath = path.join(basePath, issue.path);
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const map = JSON.parse(content);
    
    // Correct status to 'active'
    map.status = 'active';
    map.updated_at = new Date().toISOString();
    
    await fs.writeFile(filePath, JSON.stringify(map, null, 2), 'utf8');
    return { success: true, action: 'corrected_status', path: issue.path, new_status: 'active' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function repairMissingField(issue) {
  const basePath = path.join(__dirname, '..');
  const filePath = path.join(basePath, issue.path);
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const map = JSON.parse(content);
    
    // Add missing field with sensible default
    const now = new Date().toISOString();
    if (issue.field === 'created_at' && !map.created_at) {
      map.created_at = now;
    }
    if (issue.field === 'updated_at' && !map.updated_at) {
      map.updated_at = now;
    }
    if (issue.field === 'status' && !map.status) {
      map.status = 'active';
    }
    if (issue.field === 'id' && !map.id) {
      // Can't auto-fix missing ID - requires manual intervention
      return { success: false, error: 'Cannot auto-generate ID - requires manual fix' };
    }
    
    await fs.writeFile(filePath, JSON.stringify(map, null, 2), 'utf8');
    return { success: true, action: 'added_field', path: issue.path, field: issue.field };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function repair(scanResults, options = {}) {
  const autoFix = options.autoFix !== false; // Default true
  const confidenceThreshold = options.confidenceThreshold || 0.9;
  const dryRun = options.dryRun || false;
  
  const results = {
    timestamp: new Date().toISOString(),
    dry_run: dryRun,
    attempted: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    repairs: []
  };
  
  if (!autoFix) {
    results.skipped = scanResults.issues.length;
    return results;
  }
  
  for (const issue of scanResults.issues) {
    // Skip low-confidence repairs
    if (issue.confidence < confidenceThreshold) {
      results.skipped++;
      results.repairs.push({
        issue: issue.type,
        path: issue.path,
        action: 'skipped',
        reason: `confidence ${issue.confidence} < threshold ${confidenceThreshold}`
      });
      continue;
    }
    
    if (dryRun) {
      results.repairs.push({
        issue: issue.type,
        path: issue.path,
        action: 'would_repair',
        fix: issue.fix
      });
      continue;
    }
    
    results.attempted++;
    
    let repairResult;
    switch (issue.fix) {
      case 'create_directory':
        repairResult = await repairMissingDirectory(issue);
        break;
      case 'correct_status_to_active':
        repairResult = await repairInvalidStatus(issue);
        break;
      case 'add_missing_field':
        repairResult = await repairMissingField(issue);
        break;
      default:
        repairResult = { success: false, error: 'Unknown fix type' };
    }
    
    if (repairResult.success) {
      results.succeeded++;
    } else {
      results.failed++;
    }
    
    results.repairs.push({
      issue: issue.type,
      path: issue.path,
      ...repairResult
    });
  }
  
  return results;
}

module.exports = { repair };