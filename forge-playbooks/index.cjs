/**
 * Forge Playbooks - Main Module
 * Declarative workflow automation for Forge Flow 7.0
 * @module forge-playbooks
 */

const fs = require('fs');
const path = require('path');
const engine = require('./playbook-engine.cjs');

/**
 * Load playbook from JSON file
 * @param {string} playbookPath - Path to playbook JSON file
 * @returns {object} Parsed playbook definition
 */
function playbooks_load(playbookPath) {
  if (!fs.existsSync(playbookPath)) {
    throw new Error(`Playbook not found: ${playbookPath}`);
  }
  
  const content = fs.readFileSync(playbookPath, 'utf8');
  
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse playbook JSON: ${error.message}`);
  }
}

/**
 * Validate playbook against schema
 * @param {object} playbook - Playbook definition object
 * @returns {object} Validation result { valid: boolean, errors: array }
 */
function playbooks_validate(playbook) {
  return engine.validatePlaybook(playbook);
}

/**
 * Execute playbook in dry-run mode (generates plan only)
 * @param {object|string} playbook - Playbook object or path to JSON file
 * @param {object} inputs - Input values for playbook execution
 * @returns {object} Execution plan with all steps and metadata
 */
function playbooks_dry_run(playbook, inputs = {}) {
  // Allow passing path or object
  const playbookObj = typeof playbook === 'string' 
    ? playbooks_load(playbook)
    : playbook;
  
  // Generate execution plan
  const plan = engine.generateExecutionPlan(playbookObj, inputs);
  
  // Emit draft plan to markdown
  const outputPath = path.join(process.cwd(), 'DRAFT_PLAN.md');
  engine.emitDraftPlan(plan, outputPath);
  
  return {
    ...plan,
    plan_file: outputPath
  };
}

/**
 * List all available workflow playbooks
 * @param {string} workflowsDir - Directory containing workflow JSON files
 * @returns {array} List of available workflows with metadata
 */
function playbooks_list_workflows(workflowsDir = path.join(__dirname, 'workflows')) {
  if (!fs.existsSync(workflowsDir)) {
    return [];
  }
  
  const files = fs.readdirSync(workflowsDir)
    .filter(f => f.endsWith('.json'));
  
  return files.map(filename => {
    const filepath = path.join(workflowsDir, filename);
    try {
      const playbook = playbooks_load(filepath);
      return {
        filename,
        name: playbook.name,
        version: playbook.version,
        description: playbook.description,
        tags: playbook.tags || [],
        path: filepath,
        step_count: playbook.steps ? playbook.steps.length : 0
      };
    } catch (error) {
      return {
        filename,
        error: error.message
      };
    }
  });
}

/**
 * Get module information
 * @returns {object} Module metadata and version
 */
function playbooks_info() {
  return {
    module: 'forge-playbooks',
    version: '1.0',
    description: 'Declarative workflow automation engine for Forge Flow 7.0',
    mode: 'DRY_RUN',
    features: [
      'JSON-based workflow definitions',
      'Dependency resolution',
      'Conditional execution',
      'Validation and schema checking',
      'Draft execution plan generation',
      'No actual execution (planning only)'
    ],
    api: {
      playbooks_load: 'Load playbook from JSON file',
      playbooks_validate: 'Validate playbook against schema',
      playbooks_dry_run: 'Generate execution plan (dry-run mode)',
      playbooks_list_workflows: 'List all available workflows',
      playbooks_info: 'Get module information'
    }
  };
}

// Module exports
module.exports = {
  playbooks_load,
  playbooks_validate,
  playbooks_dry_run,
  playbooks_list_workflows,
  playbooks_info
};