/**
 * Forge Playbooks - Dry-Run Execution Engine
 * Generates execution plans without actually running workflows
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

/**
 * Validate playbook against schema
 * @param {object} playbook - Playbook definition
 * @returns {object} { valid: boolean, errors: array }
 */
function validatePlaybook(playbook) {
  const schemaPath = path.join(__dirname, 'playbook-schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);
  const valid = validate(playbook);
  
  return {
    valid,
    errors: validate.errors || []
  };
}

/**
 * Check step dependencies for circular references
 * @param {array} steps - Array of step definitions
 * @returns {object} { valid: boolean, issues: array }
 */
function checkDependencies(steps) {
  const issues = [];
  const stepIds = new Set(steps.map(s => s.id));
  
  // Check that all dependencies reference valid step IDs
  steps.forEach(step => {
    if (step.dependencies) {
      step.dependencies.forEach(dep => {
        if (!stepIds.has(dep)) {
          issues.push(`Step "${step.id}" depends on non-existent step "${dep}"`);
        }
      });
    }
  });
  
  // Check for circular dependencies
  const visited = new Set();
  const recursionStack = new Set();
  
  function hasCycle(stepId, depMap) {
    visited.add(stepId);
    recursionStack.add(stepId);
    
    const deps = depMap.get(stepId) || [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        if (hasCycle(dep, depMap)) return true;
      } else if (recursionStack.has(dep)) {
        return true;
      }
    }
    
    recursionStack.delete(stepId);
    return false;
  }
  
  const depMap = new Map();
  steps.forEach(step => {
    depMap.set(step.id, step.dependencies || []);
  });
  
  for (const step of steps) {
    if (!visited.has(step.id)) {
      if (hasCycle(step.id, depMap)) {
        issues.push(`Circular dependency detected involving step "${step.id}"`);
      }
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Evaluate condition against context
 * @param {object} condition - Condition definition
 * @param {object} context - Execution context
 * @returns {boolean} Whether condition is met
 */
function evaluateCondition(condition, context) {
  if (!condition) return true;
  
  // Check combined condition (if + equals) first - most specific
  if (condition.if && condition.equals !== undefined) {
    return context[condition.if] === condition.equals;
  }
  
  // Check simple existence conditions
  if (condition.exists) {
    return context[condition.exists] !== undefined;
  }
  
  // Check standalone if condition (variable existence)
  if (condition.if) {
    return context[condition.if] !== undefined;
  }
  
  return true;
}

/**
 * Resolve step execution order based on dependencies
 * @param {array} steps - Array of step definitions
 * @returns {array} Steps in execution order
 */
function resolveStepOrder(steps) {
  const ordered = [];
  const completed = new Set();
  const stepMap = new Map(steps.map(s => [s.id, s]));
  
  function canExecute(step) {
    if (!step.dependencies || step.dependencies.length === 0) return true;
    return step.dependencies.every(dep => completed.has(dep));
  }
  
  let remaining = [...steps];
  let prevCount = -1;
  
  while (remaining.length > 0 && remaining.length !== prevCount) {
    prevCount = remaining.length;
    const ready = remaining.filter(canExecute);
    
    ready.forEach(step => {
      ordered.push(step);
      completed.add(step.id);
    });
    
    remaining = remaining.filter(s => !completed.has(s.id));
  }
  
  if (remaining.length > 0) {
    throw new Error(`Unable to resolve execution order for steps: ${remaining.map(s => s.id).join(', ')}`);
  }
  
  return ordered;
}

/**
 * Generate execution plan (dry-run mode)
 * @param {object} playbook - Playbook definition
 * @param {object} inputs - Input values
 * @returns {object} Execution plan
 */
function generateExecutionPlan(playbook, inputs = {}) {
  // Validate playbook
  const validation = validatePlaybook(playbook);
  if (!validation.valid) {
    throw new Error(`Playbook validation failed: ${JSON.stringify(validation.errors)}`);
  }
  
  // Check dependencies
  const depCheck = checkDependencies(playbook.steps);
  if (!depCheck.valid) {
    throw new Error(`Dependency check failed: ${depCheck.issues.join('; ')}`);
  }
  
  // Resolve execution order
  const orderedSteps = resolveStepOrder(playbook.steps);
  
  // Build execution plan
  const plan = {
    playbook: playbook.name,
    version: playbook.version,
    mode: 'DRY_RUN',
    timestamp: new Date().toISOString(),
    inputs,
    steps: orderedSteps.map((step, index) => ({
      sequence: index + 1,
      id: step.id,
      action: step.action,
      description: step.description,
      params: step.params || {},
      dependencies: step.dependencies || [],
      condition: step.condition || null,
      on_error: step.on_error || 'fail',
      timeout_seconds: step.timeout_seconds || 300,
      estimated_duration: '~5s'
    })),
    outputs: playbook.outputs || {},
    warnings: [],
    notes: [
      'This is a DRY RUN execution plan',
      'No actual actions will be performed',
      'Review carefully before converting to live execution'
    ]
  };
  
  // Check for missing inputs
  if (playbook.inputs) {
    Object.entries(playbook.inputs).forEach(([key, config]) => {
      if (config.required && inputs[key] === undefined) {
        plan.warnings.push(`Required input "${key}" is missing`);
      }
    });
  }
  
  return plan;
}

/**
 * Emit draft plan to markdown file
 * @param {object} plan - Execution plan
 * @param {string} outputPath - Path to output file
 */
function emitDraftPlan(plan, outputPath = './DRAFT_PLAN.md') {
  const lines = [];
  
  lines.push(`# 📋 Playbook Execution Plan`);
  lines.push(``);
  lines.push(`**Playbook:** ${plan.playbook} v${plan.version}`);
  lines.push(`**Mode:** ${plan.mode}`);
  lines.push(`**Generated:** ${plan.timestamp}`);
  lines.push(``);
  
  if (Object.keys(plan.inputs).length > 0) {
    lines.push(`## 🎯 Inputs`);
    lines.push(``);
    Object.entries(plan.inputs).forEach(([key, value]) => {
      lines.push(`- **${key}:** ${JSON.stringify(value)}`);
    });
    lines.push(``);
  }
  
  lines.push(`## 📝 Execution Steps`);
  lines.push(``);
  plan.steps.forEach(step => {
    lines.push(`### ${step.sequence}. ${step.description}`);
    lines.push(``);
    lines.push(`- **ID:** \`${step.id}\``);
    lines.push(`- **Action:** \`${step.action}\``);
    if (step.dependencies.length > 0) {
      lines.push(`- **Dependencies:** ${step.dependencies.join(', ')}`);
    }
    if (step.condition) {
      lines.push(`- **Condition:** ${JSON.stringify(step.condition)}`);
    }
    lines.push(`- **Error Handling:** ${step.on_error}`);
    lines.push(`- **Timeout:** ${step.timeout_seconds}s`);
    lines.push(``);
  });
  
  if (plan.warnings.length > 0) {
    lines.push(`## ⚠️ Warnings`);
    lines.push(``);
    plan.warnings.forEach(warning => {
      lines.push(`- ${warning}`);
    });
    lines.push(``);
  }
  
  lines.push(`## 📌 Notes`);
  lines.push(``);
  plan.notes.forEach(note => {
    lines.push(`- ${note}`);
  });
  lines.push(``);
  
  const content = lines.join('\n');
  fs.writeFileSync(outputPath, content, 'utf8');
  
  return outputPath;
}

module.exports = {
  validatePlaybook,
  checkDependencies,
  evaluateCondition,
  resolveStepOrder,
  generateExecutionPlan,
  emitDraftPlan
};

