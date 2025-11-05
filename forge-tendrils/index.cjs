/**
 * Forge Tendrils - Main Module
 * 
 * Purpose: Declarative adapter layer for infrastructure planning
 * Mode: Plan-only (no actual provider calls)
 * 
 * This module accepts Tendril Maps (Trellis JSON) and performs:
 * - Schema validation
 * - Capability checking
 * - Export planning
 * - No network calls to providers
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const {
  checkCapability,
  getProviderCapabilities,
  listProviders,
  listCapabilities,
  findProvidersByCapability
} = require('./capability-matrix.cjs');

const {
  generateProvisionPlan,
  generateMigrationPlan,
  generateDeploymentPlan,
  generateCompletePlan
} = require('./plan-generator.cjs');

// Initialize JSON Schema validator
const ajv = new Ajv({ allErrors: true });

/**
 * Load Tendril Map from file
 * @param {string} manifestPath - Path to Trellis JSON file
 * @returns {object} - Parsed manifest
 */
function tendrils_load_manifest(manifestPath) {
  try {
    const absolutePath = path.resolve(manifestPath);
    const content = fs.readFileSync(absolutePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load manifest: ${error.message}`);
  }
}

/**
 * Validate Tendril Map against schema
 * @param {object} manifest - Tendril Map object
 * @returns {object} - Validation result { valid: boolean, errors: [] }
 */
function tendrils_validate_manifest(manifest) {
  try {
    // Load schema
    const schemaPath = path.join(__dirname, 'trellis.schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    
    // Compile and validate
    const validate = ajv.compile(schema);
    const valid = validate(manifest);
    
    return {
      valid,
      errors: valid ? [] : validate.errors.map(err => ({
        path: err.instancePath,
        message: err.message,
        params: err.params
      }))
    };
  } catch (error) {
    return {
      valid: false,
      errors: [{ message: `Schema validation error: ${error.message}` }]
    };
  }
}

/**
 * Check provider capabilities for a manifest
 * @param {object} manifest - Tendril Map object
 * @returns {object} - Capability check results
 */
function tendrils_capability_check(manifest) {
  const result = {
    project: manifest.project.name,
    providers: {},
    capabilities: {},
    warnings: [],
    recommendations: []
  };
  
  // Check each provider
  for (const [type, provider] of Object.entries(manifest.providers || {})) {
    if (!provider) continue;
    
    try {
      result.providers[type] = {
        name: provider,
        supported: listProviders().includes(provider),
        capabilities: provider ? getProviderCapabilities(provider) : {}
      };
      
      // Check for common capability concerns
      if (type === 'database') {
        const rlsSupport = checkCapability(provider, 'rls');
        
        if (rlsSupport === false) {
          result.warnings.push({
            severity: 'warning',
            provider,
            message: `${provider} does not support Row-Level Security. Implement authorization at application level.`
          });
        } else if (rlsSupport === 'partial') {
          result.warnings.push({
            severity: 'info',
            provider,
            message: `${provider} has partial RLS support. Review security rules implementation.`
          });
        }
        
        // Check for realtime
        if (!checkCapability(provider, 'realtime')) {
          result.recommendations.push({
            provider,
            message: `${provider} lacks native realtime. Consider websocket layer or polling.`
          });
        }
      }
    } catch (error) {
      result.providers[type] = {
        name: provider,
        supported: false,
        error: error.message
      };
    }
  }
  
  // Build capability matrix for all selected providers
  const allCapabilities = listCapabilities();
  for (const cap of allCapabilities) {
    result.capabilities[cap] = {};
    
    for (const [type, providerInfo] of Object.entries(result.providers)) {
      if (providerInfo.supported && providerInfo.capabilities) {
        result.capabilities[cap][type] = providerInfo.capabilities[cap] || false;
      }
    }
  }
  
  return result;
}

/**
 * Generate export plan for target providers
 * @param {object} manifest - Tendril Map object
 * @param {string[]} targets - Target phases ['provision', 'migrate', 'deploy']
 * @returns {object} - Complete export plan
 */
function tendrils_export_plan(manifest, targets = ['provision', 'migrate', 'deploy']) {
  // First validate the manifest
  const validation = tendrils_validate_manifest(manifest);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      message: 'Manifest validation failed. Fix errors before generating plan.'
    };
  }
  
  // Check capabilities
  const capabilityCheck = tendrils_capability_check(manifest);
  
  // Generate plans
  const plan = generateCompletePlan(manifest, targets);
  
  return {
    success: true,
    project: manifest.project.name,
    validation,
    capability_check: capabilityCheck,
    plan,
    notes: [
      'This is a PLAN-ONLY mode export',
      'No actual provider calls will be made',
      'Review plan before executing with real infrastructure',
      'Estimated times are approximate'
    ]
  };
}

/**
 * Get info about a specific provider
 * @param {string} provider - Provider name
 * @returns {object} - Provider info and capabilities
 */
function tendrils_provider_info(provider) {
  try {
    return {
      name: provider,
      supported: listProviders().includes(provider),
      capabilities: getProviderCapabilities(provider)
    };
  } catch (error) {
    return {
      name: provider,
      supported: false,
      error: error.message
    };
  }
}

/**
 * Find providers that support a specific capability
 * @param {string} capability - Capability to search for
 * @returns {object} - Providers grouped by support level
 */
function tendrils_find_providers(capability) {
  try {
    return {
      capability,
      providers: findProvidersByCapability(capability)
    };
  } catch (error) {
    return {
      capability,
      error: error.message
    };
  }
}

/**
 * Get complete module info
 * @returns {object} - Module metadata
 */
function tendrils_info() {
  return {
    name: 'forge-tendrils',
    version: '1.0.0',
    mode: 'plan-only',
    description: 'Declarative adapter layer for infrastructure planning',
    features: [
      'Tendril Map (Trellis) validation',
      'Provider capability checking',
      'Export plan generation',
      'No actual provider calls'
    ],
    supported_providers: {
      database: listProviders(),
      total: listProviders().length
    },
    supported_capabilities: listCapabilities()
  };
}

// Export all public functions
module.exports = {
  // Core functions
  tendrils_load_manifest,
  tendrils_validate_manifest,
  tendrils_capability_check,
  tendrils_export_plan,
  
  // Utility functions
  tendrils_provider_info,
  tendrils_find_providers,
  tendrils_info,
  
  // Direct access to sub-modules (for advanced usage)
  capability: {
    check: checkCapability,
    getProviderCapabilities,
    listProviders,
    listCapabilities,
    findProvidersByCapability
  },
  
  planning: {
    generateProvisionPlan,
    generateMigrationPlan,
    generateDeploymentPlan,
    generateCompletePlan
  }
};
