# 🎭 Forge Playbooks

**Declarative workflow automation for Forge Flow 7.0**

Forge Playbooks is a dry-run workflow engine that generates execution plans from JSON-based workflow definitions. It provides dependency resolution, conditional execution, and validation without actually executing any actions.

## 📋 Purpose

Forge Playbooks enables declarative workflow automation through:

- **JSON-based playbook definitions** - Human-readable workflow specifications
- **Dry-run mode only** - Generates plans without executing actions
- **Dependency resolution** - Automatic step ordering based on dependencies
- **Validation** - Schema-based validation with detailed error reporting
- **Conditional execution** - Steps can be conditionally included
- **Draft plan generation** - Creates markdown execution plans for review

## 🎯 Playbook Format

A playbook is a JSON file that defines a workflow with inputs, steps, and outputs:

```json
{
  "name": "workflow-name",
  "version": "1.0",
  "description": "Workflow description",
  "author": "Your Name",
  "tags": ["tag1", "tag2"],
  
  "inputs": {
    "input_name": {
      "type": "string",
      "description": "Input description",
      "required": true,
      "default": "default_value"
    }
  },
  
  "steps": [
    {
      "id": "step1",
      "action": "module.function",
      "description": "Step description",
      "params": {
        "param1": "value1"
      },
      "dependencies": ["previous_step"],
      "condition": {
        "if": "variable_name",
        "equals": "expected_value"
      },
      "on_error": "fail",
      "timeout_seconds": 300
    }
  ],
  
  "outputs": {
    "output_name": {
      "description": "Output description",
      "from_step": "step_id"
    }
  }
}
```

### Step Properties

- **id** (required) - Unique step identifier
- **action** (required) - Action to perform in `module.function` format
- **description** (required) - Human-readable step description
- **params** (optional) - Parameters for the action
- **dependencies** (optional) - Array of step IDs that must complete first
- **condition** (optional) - Conditional execution rules
- **on_error** (optional) - Error handling: `fail`, `continue`, or `skip_remaining`
- **timeout_seconds** (optional) - Step timeout (default: 300)

### Condition Types

**Variable existence:**
```json
{ "if": "variable_name" }
```

**Equality check:**
```json
{ "if": "variable_name", "equals": "expected_value" }
```

**Existence check:**
```json
{ "exists": "variable_name" }
```

## 🏃 Dry-Run Mode

Forge Playbooks operates **exclusively in dry-run mode**. It does not execute any actual actions. Instead, it:

1. Validates the playbook structure
2. Checks dependencies for circular references
3. Resolves step execution order
4. Generates a detailed execution plan
5. Outputs a `DRAFT_PLAN.md` file for review

This makes it safe to experiment with workflow definitions without risk of unintended execution.

## 🔧 API Usage

### Load a playbook

```javascript
const playbooks = require('./forge-playbooks');

// Load from file
const workflow = playbooks.playbooks_load('./workflows/deploy-feature.json');
```

### Validate a playbook

```javascript
const result = playbooks.playbooks_validate(workflow);

if (result.valid) {
  console.log('Playbook is valid');
} else {
  console.log('Validation errors:', result.errors);
}
```

### Generate execution plan (dry-run)

```javascript
const inputs = {
  branch_name: 'feature/new-feature',
  environment: 'preview',
  skip_tests: false,
  notify_slack: true
};

const plan = playbooks.playbooks_dry_run(workflow, inputs);
console.log('Execution plan:', plan);
console.log('Draft plan saved to:', plan.plan_file);
```

### List available workflows

```javascript
const workflows = playbooks.playbooks_list_workflows();

workflows.forEach(w => {
  console.log(`${w.name} v${w.version} - ${w.description}`);
  console.log(`  Steps: ${w.step_count}`);
  console.log(`  Tags: ${w.tags.join(', ')}`);
});
```

### Get module information

```javascript
const info = playbooks.playbooks_info();
console.log(info);
```

## 📚 Workflow Examples

### Deploy Feature

Deploy a feature branch to a preview environment.

**File:** `workflows/deploy-feature.json`

**Steps:**
1. Validate branch exists
2. Run test suite (conditional)
3. Build artifacts
4. Deploy to preview environment
5. Send Slack notification (conditional)

**Usage:**
```javascript
const workflow = playbooks.playbooks_load('./workflows/deploy-feature.json');
const plan = playbooks.playbooks_dry_run(workflow, {
  branch_name: 'feature/new-ui',
  environment: 'preview',
  skip_tests: false,
  notify_slack: true
});
```

### Publish Content

Publish content to CMS with cache invalidation.

**File:** `workflows/publish-content.json`

**Steps:**
1. Validate content structure
2. Verify publish schedule (conditional)
3. Generate SEO metadata
4. Publish to CMS
5. Invalidate CDN cache (conditional)

**Usage:**
```javascript
const workflow = playbooks.playbooks_load('./workflows/publish-content.json');
const plan = playbooks.playbooks_dry_run(workflow, {
  content_path: '/articles/new-post.md',
  content_type: 'article',
  draft_mode: false,
  invalidate_cdn: true
});
```

## 🧪 Testing

Run the comprehensive test suite (23 tests):

```bash
node test-playbooks.cjs
```

### Test Categories

- **Schema Validation** - Validates playbook structure against JSON schema
- **Dependency Resolution** - Tests circular dependency detection and step ordering
- **Condition Evaluation** - Tests conditional execution logic
- **Plan Generation** - Validates execution plan creation
- **Workflow Examples** - Tests example workflows load and validate
- **Error Handling** - Tests error scenarios and edge cases
- **Module API** - Tests all public API functions

## 🎨 Draft Plan Output

When you run a dry-run, a `DRAFT_PLAN.md` file is generated:

```markdown
# 📋 Playbook Execution Plan

**Playbook:** deploy-feature v1.0
**Mode:** DRY_RUN
**Generated:** 2025-11-05T00:00:00.000Z

## 🎯 Inputs

- **branch_name:** "feature/new-ui"
- **environment:** "preview"
- **skip_tests:** false
- **notify_slack:** true

## 📝 Execution Steps

### 1. Validate feature branch exists

- **ID:** `validate_branch`
- **Action:** `git.check_branch`
- **Error Handling:** fail
- **Timeout:** 30s

### 2. Execute test suite

- **ID:** `run_tests`
- **Action:** `ci.run_tests`
- **Dependencies:** validate_branch
- **Condition:** {"if":"skip_tests","equals":false}
- **Error Handling:** fail
- **Timeout:** 600s

...

## 📌 Notes

- This is a DRY RUN execution plan
- No actual actions will be performed
- Review carefully before converting to live execution
```

## 🏗️ Architecture

### Core Components

**playbook-schema.json** - JSON Schema definition for playbook validation

**playbook-engine.cjs** - Core execution engine with functions:
- `validatePlaybook()` - Validates against schema
- `checkDependencies()` - Checks for circular dependencies
- `resolveStepOrder()` - Orders steps by dependencies
- `evaluateCondition()` - Evaluates conditional expressions
- `generateExecutionPlan()` - Creates execution plan
- `emitDraftPlan()` - Writes markdown plan file

**index.cjs** - Public API exports:
- `playbooks_load()` - Load playbook from file
- `playbooks_validate()` - Validate playbook structure
- `playbooks_dry_run()` - Generate execution plan
- `playbooks_list_workflows()` - List available workflows
- `playbooks_info()` - Get module metadata

### Dependencies

- **ajv** - JSON schema validation
- **fs** - File system operations (Node.js built-in)
- **path** - Path manipulation (Node.js built-in)

## 🚀 Integration with Forge Flow 7.0

Forge Playbooks integrates with the broader Forge Flow 7.0 ecosystem:

- **Forge Tokens** - Design token extraction and management
- **Forge Tendrils** - Live component synchronization
- **Forge Playbooks** - Workflow automation (this module)

Together, these modules enable fully declarative, natural language-driven development.

## ⚠️ Important Notes

### Dry-Run Only

**This module does NOT execute any actions.** It only generates execution plans. To actually run workflows, you would need:

1. An execution runtime (not included)
2. Action modules (not included)
3. Proper authentication and permissions
4. Additional error handling and recovery

### Safety First

Because this is dry-run only, you can:
- Experiment with workflow definitions safely
- Validate complex dependency chains
- Test conditional logic without side effects
- Generate documentation from playbooks
- Review execution plans before implementation

### Future Enhancements

Potential future additions (not in scope for MVP):

- Execution runtime with actual action modules
- Visual workflow editor
- Real-time execution monitoring
- Rollback and recovery mechanisms
- Workflow versioning and history
- Integration with CI/CD platforms

## 📝 Version

**Forge Playbooks v1.0**

Part of Forge Flow 7.0 MVP (Phase 9: Tendrils and Playbooks)

---

Built with ❤️ by Chromasmith for the Forge Flow ecosystem