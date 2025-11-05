# Forge Tendrils

**Declarative Adapter Layer for Infrastructure Planning**

Version: 1.0.0  
Mode: Plan-Only (No Provider Calls)  
Phase: 9.1 - Tendrils and Playbooks

---

## Purpose

Forge Tendrils is a **contract-before-code** planning layer for infrastructure provisioning. It accepts declarative Tendril Maps (Trellis JSON) and performs:

- ✅ Schema validation
- ✅ Provider capability checking
- ✅ Multi-phase deployment planning
- ❌ **No actual provider API calls**

This enables you to design and validate infrastructure configurations before committing to real deployments.

---

## Tendril Map (Trellis) Format

A Tendril Map is a JSON manifest that describes your infrastructure requirements:

```json
{
  "version": "1.0",
  "project": {
    "name": "my-app",
    "description": "My awesome application",
    "tags": ["saas", "production"]
  },
  "providers": {
    "database": "supabase",
    "auth": "clerk",
    "storage": "bunny",
    "hosting": "vercel"
  },
  "modules": [
    {
      "name": "core",
      "type": "core",
      "dependencies": []
    },
    {
      "name": "billing",
      "type": "addon",
      "dependencies": ["core"]
    }
  ]
}
```

### Schema Properties

- **version**: Schema version (e.g., "1.0")
- **project**: Project metadata (name, description, tags)
- **providers**: Infrastructure provider selections
  - database: supabase | firebase | mysql | mongodb | dynamodb
  - auth: clerk | auth0 | supabase | firebase
  - storage: bunny | aws-s3 | cloudflare-r2 | azure-blob
  - hosting: vercel | netlify | cloudflare-pages
- **modules**: Application modules with dependencies

---

## Capability Matrix

The capability matrix defines which features each provider supports:

| Provider  | RLS     | Triggers | Functions | Realtime | Storage | Auth  | Vector |
|-----------|---------|----------|-----------|----------|---------|-------|--------|
| Supabase  | ✅ true | ✅ true  | ✅ true   | ✅ true  | ✅ true | ✅ true | ✅ true |
| Firebase  | ⚠️ partial | ✅ true  | ✅ true   | ✅ true  | ✅ true | ✅ true | ❌ false |
| MySQL     | ❌ false | ✅ true  | ✅ true   | ❌ false | ❌ false | ❌ false | ❌ false |
| MongoDB   | ❌ false | ✅ true  | ✅ true   | ✅ true  | ❌ false | ❌ false | ✅ true |
| DynamoDB  | ❌ false | ✅ true  | ❌ false  | ✅ true  | ❌ false | ❌ false | ❌ false |

### Capability Levels

- **true**: Full native support
- **partial**: Limited or alternative implementation
- **false**: Not supported

---

## Plan Generation Process

Forge Tendrils generates step-by-step plans across three phases:

### 1. Provision Phase

Creates infrastructure resources:
- Validate manifest
- Check provider capabilities
- Provision database instance
- Configure authentication
- Provision storage buckets
- Configure hosting platform

### 2. Migration Phase

Sets up database schema:
- Create database schema
- Apply RLS policies (if supported)
- Create triggers (if supported)
- Deploy functions (if supported)
- Seed initial data

### 3. Deployment Phase

Deploys application:
- Build application
- Run test suite
- Deploy to hosting
- Configure custom domain
- Verify deployment health

Each step includes:
- Action name
- Provider
- Estimated time
- Dependencies
- Dry-run flag

---

## API Usage

### Load and Validate Manifest

```javascript
const tendrils = require('./forge-tendrils');

// Load from file
const manifest = tendrils.tendrils_load_manifest('./my-trellis.json');

// Validate against schema
const validation = tendrils.tendrils_validate_manifest(manifest);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

### Check Provider Capabilities

```javascript
// Check specific capability
const supportsRLS = tendrils.capability.check('supabase', 'rls');
// Returns: true

// Get all capabilities for a provider
const caps = tendrils.capability.getProviderCapabilities('supabase');
// Returns: { rls: true, triggers: true, ... }

// Find providers that support a capability
const rlsProviders = tendrils.tendrils_find_providers('rls');
// Returns: { full: ['supabase'], partial: ['firebase'], none: ['mysql', ...] }
```

### Generate Deployment Plan

```javascript
// Generate complete plan for all phases
const exportPlan = tendrils.tendrils_export_plan(manifest, [
  'provision',
  'migrate', 
  'deploy'
]);

if (exportPlan.success) {
  console.log('Project:', exportPlan.project);
  console.log('Total time:', exportPlan.plan.total_estimated_minutes, 'minutes');
  console.log('Warnings:', exportPlan.capability_check.warnings);
  
  // Access individual phases
  console.log('Provision steps:', exportPlan.plan.phases.provision.steps);
  console.log('Migration steps:', exportPlan.plan.phases.migrate.steps);
  console.log('Deployment steps:', exportPlan.plan.phases.deploy.steps);
}
```

### Generate Individual Plans

```javascript
// Just provision
const provisionPlan = tendrils.planning.generateProvisionPlan(manifest);

// Just migration
const migrationPlan = tendrils.planning.generateMigrationPlan(manifest);

// Just deployment
const deploymentPlan = tendrils.planning.generateDeploymentPlan(manifest);
```

### Capability Analysis

```javascript
// Check manifest capabilities
const capCheck = tendrils.tendrils_capability_check(manifest);

console.log('Providers:', capCheck.providers);
console.log('Capabilities:', capCheck.capabilities);
console.log('Warnings:', capCheck.warnings);
console.log('Recommendations:', capCheck.recommendations);
```

---

## No Provider Calls (Plan-Only Mode)

**IMPORTANT**: Forge Tendrils operates in **plan-only mode**. This means:

- ✅ Validates manifests against schema
- ✅ Checks capability matrix
- ✅ Generates deployment plans
- ❌ **Does NOT call any provider APIs**
- ❌ **Does NOT create real infrastructure**
- ❌ **Does NOT deploy anything**

This is intentional! The purpose is to:
1. Design infrastructure declaratively
2. Validate provider compatibility
3. Estimate deployment time
4. Plan multi-phase rollouts
5. Review before execution

---

## Running Tests

```bash
node forge-tendrils/test-tendrils.cjs
```

The test suite validates:
- Manifest loading and validation
- Capability matrix accuracy
- Plan generation for all phases
- Error handling for invalid inputs
- Provider and capability queries

---

## Example: Blog Platform

See `sample-trellis.json` for a complete example of a blog platform using:
- **Database**: Supabase (with RLS, triggers, functions)
- **Auth**: Clerk
- **Storage**: Bunny CDN
- **Hosting**: Vercel

This configuration demonstrates:
- Core modules (content, user-profiles)
- Addon modules (comments, billing, analytics)
- Module dependencies
- Multi-provider infrastructure

---

## Future: Connect to Real Providers

In future phases, Forge Tendrils will gain the ability to:
- Execute plans against real providers
- Track deployment state
- Handle rollbacks
- Perform incremental updates
- Generate Terraform/CDK equivalents

For now, it remains a **planning and validation tool** to ensure infrastructure-as-code quality before execution.

---

## Module Info

```javascript
const info = tendrils.tendrils_info();
console.log(info);
```

Returns:
```json
{
  "name": "forge-tendrils",
  "version": "1.0.0",
  "mode": "plan-only",
  "description": "Declarative adapter layer for infrastructure planning",
  "features": [
    "Tendril Map (Trellis) validation",
    "Provider capability checking",
    "Export plan generation",
    "No actual provider calls"
  ],
  "supported_providers": {
    "database": ["supabase", "firebase", "mysql", "mongodb", "dynamodb"],
    "total": 5
  },
  "supported_capabilities": [
    "auth", "extensions", "functions", "realtime", "rls", "storage", "triggers", "vector"
  ]
}
```

---

## Files

- **trellis.schema.json** - JSON Schema for Tendril Maps
- **index.cjs** - Main module with all public APIs
- **capability-matrix.cjs** - Provider capability definitions
- **plan-generator.cjs** - Deployment plan generator
- **sample-trellis.json** - Example blog platform manifest
- **test-tendrils.cjs** - Comprehensive test suite
- **README.md** - This documentation

---

## License

Part of Forge Flow 7.0 - Chromasmith LLC

---

**Remember**: This is a **planning tool**, not an execution engine. Review plans carefully before implementing with real infrastructure tools.
