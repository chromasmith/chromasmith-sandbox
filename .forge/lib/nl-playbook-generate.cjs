// NL Playbook Generator
// Generates complete playbook files from natural language descriptions

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { discover } = require('./nl-verb-discover.cjs');

function sanitizeFileName(description) {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
}

function generatePlaybookCode(name, description, verbSequence) {
  const hasRun = verbSequence.some(v => v.startsWith('run.'));
  const templateCode = hasRun ? generateRunOrchestrated(name, description, verbSequence) : generateSimple(name, description, verbSequence);
  return templateCode;
}

function generateRunOrchestrated(name, description, verbSequence) {
  return `// Generated Playbook: ${name}
// Description: ${description}
// Generated: ${new Date().toISOString()}

const run = require('./run.cjs');
const repo = require('./repo.cjs');
const context = require('./context.cjs');
const incident = require('./incident.cjs');
const validate = require('./validate.cjs');

async function ${toCamelCase(name)}(params = {}) {
  const runId = await run.start({
    playbook: '${name}',
    description: '${description}',
    params
  });
  
  try {
    await run.note(runId, { step: 'started', params });
    
    // TODO: Implement playbook logic using these verbs:
    // ${verbSequence.filter(v => !v.startsWith('run.')).join(', ')}
    
    await run.note(runId, { step: 'completed' });
    await run.finish(runId, 'succeeded');
    
    return { success: true, runId };
  } catch (error) {
    await run.note(runId, { step: 'failed', error: error.message });
    await run.finish(runId, 'failed');
    throw error;
  }
}

async function runTests() {
  console.log('🧪 Testing ${name}\\n');
  try {
    const result = await ${toCamelCase(name)}({ test: true });
    console.log('✅ Playbook executed successfully');
    console.log(\`   Run ID: \${result.runId}\`);
    return true;
  } catch (error) {
    console.log('❌ Playbook failed');
    console.log(\`   Error: \${error.message}\`);
    return false;
  }
}

if (require.main === module) {
  runTests().then(success => process.exit(success ? 0 : 1));
}

module.exports = { ${toCamelCase(name)}, runTests };
`;
}

function generateSimple(name, description, verbSequence) {
  return `// Generated Playbook: ${name}
// Description: ${description}
// Generated: ${new Date().toISOString()}

const repo = require('./repo.cjs');
const context = require('./context.cjs');
const validate = require('./validate.cjs');

async function ${toCamelCase(name)}(params = {}) {
  try {
    // TODO: Implement playbook logic using these verbs:
    // ${verbSequence.join(', ')}
    
    return { success: true };
  } catch (error) {
    throw error;
  }
}

async function runTests() {
  console.log('🧪 Testing ${name}\\n');
  try {
    const result = await ${toCamelCase(name)}({ test: true });
    console.log('✅ Playbook executed successfully');
    return true;
  } catch (error) {
    console.log('❌ Playbook failed');
    console.log(\`   Error: \${error.message}\`);
    return false;
  }
}

if (require.main === module) {
  runTests().then(success => process.exit(success ? 0 : 1));
}

module.exports = { ${toCamelCase(name)}, runTests };
`;
}

function toCamelCase(str) {
  return str
    .split('-')
    .map((word, index) => 
      index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join('');
}

async function validateSyntax(code, tempFile) {
  // Write to temp file and validate syntax
  const tempPath = path.join(__dirname, tempFile);
  await fs.writeFile(tempPath, code, 'utf8');
  
  try {
    await execAsync(`node --check ${tempPath}`);
    await fs.unlink(tempPath);
    return { valid: true };
  } catch (error) {
    await fs.unlink(tempPath);
    return { 
      valid: false, 
      error: error.message,
      suggestion: 'Check for escaped template literals or syntax errors'
    };
  }
}

async function generate(description, options = {}) {
  // Step 1: Discover verbs
  const discovery = await discover(description);
  
  // Step 2: Generate playbook name
  const name = options.name || `playbook-${sanitizeFileName(description)}`;
  
  // Step 3: Generate code
  const code = generatePlaybookCode(name, description, discovery.analysis.verbs);
  
  // Step 4: Validate syntax
  const tempFileName = `_temp_validate_${Date.now()}.cjs`;
  const validation = await validateSyntax(code, tempFileName);
  
  if (!validation.valid) {
    throw new Error(`Syntax validation failed: ${validation.error}. ${validation.suggestion}`);
  }
  
  // Step 5: Write file (if not dry-run)
  const fileName = `${name}.cjs`;
  const filePath = path.join(__dirname, fileName);
  
  if (!options.dryRun) {
    await fs.writeFile(filePath, code, 'utf8');
  }
  
  return {
    name,
    fileName,
    filePath,
    description,
    discovery: discovery.analysis,
    generated: new Date().toISOString(),
    code: options.includeCode ? code : undefined
  };
}

module.exports = { generate };