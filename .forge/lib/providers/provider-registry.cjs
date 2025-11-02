/**
 * Provider Registry
 * Discovers, registers, and instantiates providers
 */

const { Provider } = require('./provider-interface.cjs');

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
  }
  
  /**
   * Register a provider
   * @param {string} name - Provider name (e.g., 'supabase', 'firebase')
   * @param {Class} ProviderClass - Provider class that extends Provider
   */
  register(name, ProviderClass) {
    // Validate that ProviderClass extends Provider
    if (!(ProviderClass.prototype instanceof Provider)) {
      throw new Error(`Provider ${name} must extend Provider base class`);
    }
    
    this.providers.set(name, ProviderClass);
  }
  
  /**
   * Get a provider class
   * @param {string} name - Provider name
   * @returns {Class|null}
   */
  get(name) {
    return this.providers.get(name) || null;
  }
  
  /**
   * Create a provider instance
   * @param {string} name - Provider name
   * @param {Object} config - Provider configuration
   * @returns {Provider}
   */
  create(name, config) {
    const ProviderClass = this.get(name);
    if (!ProviderClass) {
      throw new Error(`Provider '${name}' not found. Available: ${this.listAvailable().join(', ')}`);
    }
    
    return new ProviderClass(config);
  }
  
  /**
   * List available providers
   * @returns {Array<string>}
   */
  listAvailable() {
    return Array.from(this.providers.keys());
  }
  
  /**
   * Check if a provider is registered
   * @param {string} name - Provider name
   * @returns {boolean}
   */
  has(name) {
    return this.providers.has(name);
  }
}

// Global registry instance
const registry = new ProviderRegistry();

module.exports = {
  ProviderRegistry,
  registry
};
