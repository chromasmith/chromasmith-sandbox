/**
 * Resilient Provider Factory for Forge Flow 6.4
 * Creates provider instances wrapped with error handling
 */

const { wrapProvider } = require('../resilient-provider-wrapper.cjs');
const { getProvider } = require('./provider-registry.cjs');

/**
 * Create a resilient provider instance
 * 
 * @param {string} providerName - Name of provider (e.g., 'supabase', 'firebase')
 * @param {Object} config - Provider configuration
 * @param {Object} resilienceConfig - Retry and circuit breaker configuration
 * @returns {Object} Wrapped provider instance
 */
function createResilientProvider(providerName, config = {}, resilienceConfig = {}) {
  // Get base provider instance
  const provider = getProvider(providerName, config);
  
  // Wrap with resilience features
  return wrapProvider(provider, resilienceConfig);
}

/**
 * Create multiple resilient providers
 */
function createResilientProviders(providersConfig) {
  const providers = {};
  
  for (const [name, config] of Object.entries(providersConfig)) {
    const { providerType, resilienceConfig, ...providerConfig } = config;
    providers[name] = createResilientProvider(
      providerType || name,
      providerConfig,
      resilienceConfig
    );
  }
  
  return providers;
}

module.exports = {
  createResilientProvider,
  createResilientProviders
};
