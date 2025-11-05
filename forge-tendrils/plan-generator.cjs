/**
 * Forge Tendrils - Plan Generator
 * 
 * Purpose: Generate step-by-step deployment plans
 * Mode: Plan-only (no actual provider calls)
 */

const { checkCapability, getProviderCapabilities } = require('./capability-matrix.cjs');

/**
 * Generate provision plan for infrastructure
 * @param {object} manifest - Tendril Map (Trellis) manifest
 * @returns {object} - Step-by-step provision plan
 */
function generateProvisionPlan(manifest) {
  const plan = {
    phase: 'provision',
    project: manifest.project.name,
    steps: [],
    estimated_time_minutes: 0,
    warnings: []
  };
  
  // Step 1: Validate manifest
  plan.steps.push({
    step: 1,
    action: 'validate',
    description: 'Validate Tendril Map against schema',
    provider: 'local',
    estimated_time_seconds: 5,
    dependencies: [],
    dry_run: true
  });
  
  // Step 2: Check provider capabilities
  plan.steps.push({
    step: 2,
    action: 'capability_check',
    description: 'Verify all providers support required features',
    provider: 'local',
    estimated_time_seconds: 10,
    dependencies: [1],
    dry_run: true
  });
  
  // Step 3: Provision database
  if (manifest.providers.database) {
    const dbProvider = manifest.providers.database;
    plan.steps.push({
      step: 3,
      action: 'provision_database',
      description: `Provision ${dbProvider} database instance`,
      provider: dbProvider,
      estimated_time_seconds: 120,
      dependencies: [2],
      dry_run: false,
      notes: [
        'Creates database instance',
        'Configures connection pooling',
        'Sets up initial schemas'
      ]
    });
    plan.estimated_time_minutes += 2;
  }
  
  // Step 4: Configure authentication
  if (manifest.providers.auth) {
    const authProvider = manifest.providers.auth;
    plan.steps.push({
      step: 4,
      action: 'configure_auth',
      description: `Configure ${authProvider} authentication`,
      provider: authProvider,
      estimated_time_seconds: 60,
      dependencies: [3],
      dry_run: false,
      notes: [
        'Sets up auth providers',
        'Configures OAuth flows',
        'Creates API keys'
      ]
    });
    plan.estimated_time_minutes += 1;
  }
  
  // Step 5: Provision storage
  if (manifest.providers.storage) {
    const storageProvider = manifest.providers.storage;
    plan.steps.push({
      step: 5,
      action: 'provision_storage',
      description: `Provision ${storageProvider} storage buckets`,
      provider: storageProvider,
      estimated_time_seconds: 45,
      dependencies: [2],
      dry_run: false,
      notes: [
        'Creates storage zones/buckets',
        'Configures CDN settings',
        'Sets up access policies'
      ]
    });
    plan.estimated_time_minutes += 1;
  }
  
  // Step 6: Configure hosting
  if (manifest.providers.hosting) {
    const hostingProvider = manifest.providers.hosting;
    plan.steps.push({
      step: 6,
      action: 'configure_hosting',
      description: `Configure ${hostingProvider} hosting`,
      provider: hostingProvider,
      estimated_time_seconds: 90,
      dependencies: [2],
      dry_run: false,
      notes: [
        'Creates project/site',
        'Configures build settings',
        'Sets up environment variables'
      ]
    });
    plan.estimated_time_minutes += 2;
  }
  
  // Check for capability warnings
  if (manifest.providers.database) {
    const caps = getProviderCapabilities(manifest.providers.database);
    if (!caps.rls) {
      plan.warnings.push({
        severity: 'warning',
        message: `${manifest.providers.database} does not support Row-Level Security (RLS). Consider implementing application-level authorization.`
      });
    }
    if (caps.rls === 'partial') {
      plan.warnings.push({
        severity: 'info',
        message: `${manifest.providers.database} has partial RLS support. Review security rules carefully.`
      });
    }
  }
  
  plan.estimated_time_minutes = Math.ceil(plan.estimated_time_minutes);
  return plan;
}

/**
 * Generate migration plan for database
 * @param {object} manifest - Tendril Map (Trellis) manifest
 * @returns {object} - Step-by-step migration plan
 */
function generateMigrationPlan(manifest) {
  const plan = {
    phase: 'migrate',
    project: manifest.project.name,
    steps: [],
    estimated_time_minutes: 0,
    warnings: []
  };
  
  if (!manifest.providers.database) {
    plan.warnings.push({
      severity: 'info',
      message: 'No database provider specified, skipping migration plan'
    });
    return plan;
  }
  
  const dbProvider = manifest.providers.database;
  
  // Step 1: Create base schema
  plan.steps.push({
    step: 1,
    action: 'create_schema',
    description: 'Create database schema and tables',
    provider: dbProvider,
    estimated_time_seconds: 30,
    dependencies: [],
    dry_run: false
  });
  
  // Step 2: Apply RLS policies (if supported)
  if (checkCapability(dbProvider, 'rls') === true) {
    plan.steps.push({
      step: 2,
      action: 'apply_rls',
      description: 'Apply Row-Level Security policies',
      provider: dbProvider,
      estimated_time_seconds: 20,
      dependencies: [1],
      dry_run: false
    });
  }
  
  // Step 3: Create triggers (if supported)
  if (checkCapability(dbProvider, 'triggers')) {
    plan.steps.push({
      step: 3,
      action: 'create_triggers',
      description: 'Create database triggers',
      provider: dbProvider,
      estimated_time_seconds: 15,
      dependencies: [1],
      dry_run: false
    });
  }
  
  // Step 4: Deploy functions (if supported)
  if (checkCapability(dbProvider, 'functions')) {
    plan.steps.push({
      step: 4,
      action: 'deploy_functions',
      description: 'Deploy stored procedures/functions',
      provider: dbProvider,
      estimated_time_seconds: 25,
      dependencies: [1],
      dry_run: false
    });
  }
  
  // Step 5: Seed initial data
  plan.steps.push({
    step: 5,
    action: 'seed_data',
    description: 'Seed initial application data',
    provider: dbProvider,
    estimated_time_seconds: 10,
    dependencies: plan.steps.map(s => s.step),
    dry_run: false
  });
  
  plan.estimated_time_minutes = Math.ceil(
    plan.steps.reduce((sum, step) => sum + step.estimated_time_seconds, 0) / 60
  );
  
  return plan;
}

/**
 * Generate deployment plan for application
 * @param {object} manifest - Tendril Map (Trellis) manifest
 * @returns {object} - Step-by-step deployment plan
 */
function generateDeploymentPlan(manifest) {
  const plan = {
    phase: 'deploy',
    project: manifest.project.name,
    steps: [],
    estimated_time_minutes: 0,
    warnings: []
  };
  
  // Step 1: Build application
  plan.steps.push({
    step: 1,
    action: 'build',
    description: 'Build application for production',
    provider: 'local',
    estimated_time_seconds: 180,
    dependencies: [],
    dry_run: false
  });
  
  // Step 2: Run tests
  plan.steps.push({
    step: 2,
    action: 'test',
    description: 'Run test suite',
    provider: 'local',
    estimated_time_seconds: 60,
    dependencies: [1],
    dry_run: false
  });
  
  // Step 3: Deploy to hosting
  if (manifest.providers.hosting) {
    plan.steps.push({
      step: 3,
      action: 'deploy_hosting',
      description: `Deploy to ${manifest.providers.hosting}`,
      provider: manifest.providers.hosting,
      estimated_time_seconds: 120,
      dependencies: [2],
      dry_run: false
    });
  }
  
  // Step 4: Configure custom domain (if applicable)
  plan.steps.push({
    step: 4,
    action: 'configure_domain',
    description: 'Configure custom domain and SSL',
    provider: manifest.providers.hosting || 'manual',
    estimated_time_seconds: 60,
    dependencies: [3],
    dry_run: false,
    optional: true
  });
  
  // Step 5: Verify deployment
  plan.steps.push({
    step: 5,
    action: 'verify',
    description: 'Verify deployment health',
    provider: 'local',
    estimated_time_seconds: 30,
    dependencies: [3],
    dry_run: false
  });
  
  plan.estimated_time_minutes = Math.ceil(
    plan.steps.reduce((sum, step) => sum + step.estimated_time_seconds, 0) / 60
  );
  
  return plan;
}

/**
 * Generate complete multi-phase plan
 * @param {object} manifest - Tendril Map (Trellis) manifest
 * @param {string[]} phases - Phases to include ['provision', 'migrate', 'deploy']
 * @returns {object} - Complete plan with all phases
 */
function generateCompletePlan(manifest, phases = ['provision', 'migrate', 'deploy']) {
  const plan = {
    project: manifest.project.name,
    phases: {},
    total_estimated_minutes: 0,
    all_warnings: []
  };
  
  if (phases.includes('provision')) {
    plan.phases.provision = generateProvisionPlan(manifest);
    plan.total_estimated_minutes += plan.phases.provision.estimated_time_minutes;
    plan.all_warnings.push(...plan.phases.provision.warnings);
  }
  
  if (phases.includes('migrate')) {
    plan.phases.migrate = generateMigrationPlan(manifest);
    plan.total_estimated_minutes += plan.phases.migrate.estimated_time_minutes;
    plan.all_warnings.push(...plan.phases.migrate.warnings);
  }
  
  if (phases.includes('deploy')) {
    plan.phases.deploy = generateDeploymentPlan(manifest);
    plan.total_estimated_minutes += plan.phases.deploy.estimated_time_minutes;
    plan.all_warnings.push(...plan.phases.deploy.warnings);
  }
  
  return plan;
}

module.exports = {
  generateProvisionPlan,
  generateMigrationPlan,
  generateDeploymentPlan,
  generateCompletePlan
};
