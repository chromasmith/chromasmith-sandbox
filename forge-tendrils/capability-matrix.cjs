/**
 * Forge Tendrils - Provider Capability Matrix
 * 
 * Purpose: Define which features each provider supports
 * Mode: Plan-only (no actual provider calls)
 */

const CAPABILITY_MATRIX = {
  // Database providers
  supabase: {
    rls: true,              // Row-Level Security
    triggers: true,         // Database triggers
    functions: true,        // Stored procedures/functions
    realtime: true,         // Realtime subscriptions
    storage: true,          // File storage
    auth: true,             // Built-in authentication
    extensions: true,       // PostgreSQL extensions
    vector: true            // Vector/embeddings support
  },
  
  firebase: {
    rls: 'partial',         // Security rules (not true RLS)
    triggers: true,         // Cloud Functions triggers
    functions: true,        // Cloud Functions
    realtime: true,         // Realtime database
    storage: true,          // Cloud Storage
    auth: true,             // Firebase Auth
    extensions: false,      // No extension system
    vector: false           // No native vector support
  },
  
  mysql: {
    rls: false,             // No native RLS
    triggers: true,         // Database triggers
    functions: true,        // Stored procedures
    realtime: false,        // No native realtime
    storage: false,         // No integrated storage
    auth: false,            // No built-in auth
    extensions: false,      // Limited plugin system
    vector: false           // No native vector support
  },
  
  mongodb: {
    rls: false,             // No RLS (use aggregation pipeline)
    triggers: true,         // Database triggers
    functions: true,        // Atlas Functions
    realtime: true,         // Change streams
    storage: false,         // No integrated storage
    auth: false,            // No built-in auth
    extensions: false,      // No extension system
    vector: true            // Vector search support
  },
  
  dynamodb: {
    rls: false,             // No RLS (use IAM policies)
    triggers: true,         // DynamoDB Streams + Lambda
    functions: false,       // No stored procedures
    realtime: true,         // DynamoDB Streams
    storage: false,         // Separate S3 service
    auth: false,            // Separate Cognito service
    extensions: false,      // No extension system
    vector: false           // No native vector support
  }
};

/**
 * Check if a provider supports a specific capability
 * @param {string} provider - Provider name
 * @param {string} capability - Capability to check
 * @returns {boolean|string} - true, false, or 'partial'
 */
function checkCapability(provider, capability) {
  if (!CAPABILITY_MATRIX[provider]) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  
  if (!(capability in CAPABILITY_MATRIX[provider])) {
    throw new Error(`Unknown capability: ${capability}`);
  }
  
  return CAPABILITY_MATRIX[provider][capability];
}

/**
 * Get all capabilities for a provider
 * @param {string} provider - Provider name
 * @returns {object} - Capability map
 */
function getProviderCapabilities(provider) {
  if (!CAPABILITY_MATRIX[provider]) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  
  return { ...CAPABILITY_MATRIX[provider] };
}

/**
 * List all available providers
 * @returns {string[]} - Provider names
 */
function listProviders() {
  return Object.keys(CAPABILITY_MATRIX);
}

/**
 * List all capabilities
 * @returns {string[]} - Capability names
 */
function listCapabilities() {
  const caps = new Set();
  for (const provider of Object.values(CAPABILITY_MATRIX)) {
    for (const cap of Object.keys(provider)) {
      caps.add(cap);
    }
  }
  return Array.from(caps).sort();
}

/**
 * Find providers that support a specific capability
 * @param {string} capability - Capability to check
 * @returns {object} - Providers grouped by support level
 */
function findProvidersByCapability(capability) {
  const result = {
    full: [],      // Full support (true)
    partial: [],   // Partial support ('partial')
    none: []       // No support (false)
  };
  
  for (const [provider, capabilities] of Object.entries(CAPABILITY_MATRIX)) {
    const support = capabilities[capability];
    
    if (support === true) {
      result.full.push(provider);
    } else if (support === 'partial') {
      result.partial.push(provider);
    } else if (support === false) {
      result.none.push(provider);
    }
  }
  
  return result;
}

module.exports = {
  CAPABILITY_MATRIX,
  checkCapability,
  getProviderCapabilities,
  listProviders,
  listCapabilities,
  findProvidersByCapability
};
