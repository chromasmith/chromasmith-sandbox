/**
 * Unified Provider Interface
 * Abstract interface that all backend providers must implement
 */

/**
 * Base Provider Interface
 * All providers must implement these methods
 */
class Provider {
  constructor(config) {
    this.config = config;
    this.name = 'base';
    this.capabilities = {};
  }
  
  /**
   * Initialize the provider connection
   * @returns {Promise<void>}
   */
  async init() {
    throw new Error('init() must be implemented by provider');
  }
  
  /**
   * Test the provider connection
   * @returns {Promise<boolean>}
   */
  async ping() {
    throw new Error('ping() must be implemented by provider');
  }
  
  /**
   * Close provider connection
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('close() must be implemented by provider');
  }
  
  // --- Database Operations ---
  
  /**
   * Create a table/collection
   * @param {Object} schema - Table schema definition
   * @returns {Promise<void>}
   */
  async createTable(schema) {
    throw new Error('createTable() must be implemented by provider');
  }
  
  /**
   * Drop a table/collection
   * @param {string} tableName
   * @returns {Promise<void>}
   */
  async dropTable(tableName) {
    throw new Error('dropTable() must be implemented by provider');
  }
  
  /**
   * Insert a row/document
   * @param {string} table - Table/collection name
   * @param {Object} data - Data to insert
   * @returns {Promise<Object>} Inserted record with ID
   */
  async insert(table, data) {
    throw new Error('insert() must be implemented by provider');
  }
  
  /**
   * Query records
   * @param {string} table - Table/collection name
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options (limit, offset, orderBy)
   * @returns {Promise<Array>}
   */
  async query(table, filters = {}, options = {}) {
    throw new Error('query() must be implemented by provider');
  }
  
  /**
   * Update records
   * @param {string} table - Table/collection name
   * @param {Object} filters - Which records to update
   * @param {Object} data - Data to update
   * @returns {Promise<number>} Number of records updated
   */
  async update(table, filters, data) {
    throw new Error('update() must be implemented by provider');
  }
  
  /**
   * Delete records
   * @param {string} table - Table/collection name
   * @param {Object} filters - Which records to delete
   * @returns {Promise<number>} Number of records deleted
   */
  async delete(table, filters) {
    throw new Error('delete() must be implemented by provider');
  }
  
  // --- Security Operations ---
  
  /**
   * Apply security rules/policies
   * @param {Object} policies - Security AST policies
   * @returns {Promise<void>}
   */
  async applySecurityRules(policies) {
    throw new Error('applySecurityRules() must be implemented by provider');
  }
  
  /**
   * List current security rules
   * @returns {Promise<Array>}
   */
  async listSecurityRules() {
    throw new Error('listSecurityRules() must be implemented by provider');
  }
  
  /**
   * Remove security rules
   * @param {string} ruleId - Rule identifier
   * @returns {Promise<void>}
   */
  async removeSecurityRule(ruleId) {
    throw new Error('removeSecurityRule() must be implemented by provider');
  }
  
  // --- Migration Operations ---
  
  /**
   * Run database migrations
   * @param {Array} migrations - Migration scripts
   * @returns {Promise<void>}
   */
  async runMigrations(migrations) {
    throw new Error('runMigrations() must be implemented by provider');
  }
  
  /**
   * Check which migrations have been applied
   * @returns {Promise<Array>} List of applied migration IDs
   */
  async getAppliedMigrations() {
    throw new Error('getAppliedMigrations() must be implemented by provider');
  }
  
  // --- Feature Capability Check ---
  
  /**
   * Check if provider supports a feature
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  supports(feature) {
    return this.capabilities[feature] === true;
  }
  
  /**
   * Get provider capabilities
   * @returns {Object} Capability map
   */
  getCapabilities() {
    return { ...this.capabilities };
  }
}

/**
 * Feature constants
 */
const Features = {
  // Core database features
  TRANSACTIONS: 'transactions',
  RELATIONS: 'relations',
  JOINS: 'joins',
  FULL_TEXT_SEARCH: 'fullTextSearch',
  JSON_FIELDS: 'jsonFields',
  ARRAY_FIELDS: 'arrayFields',
  
  // Security features
  ROW_LEVEL_SECURITY: 'rowLevelSecurity',
  COLUMN_LEVEL_SECURITY: 'columnLevelSecurity',
  ROLE_BASED_ACCESS: 'roleBasedAccess',
  
  // Advanced features
  REAL_TIME_SUBSCRIPTIONS: 'realTimeSubscriptions',
  GEOSPATIAL: 'geospatial',
  TIME_SERIES: 'timeSeries',
  VECTOR_SEARCH: 'vectorSearch',
  
  // Migration features
  SCHEMA_MIGRATIONS: 'schemaMigrations',
  ROLLBACK: 'rollback',
  
  // Performance features
  INDEXES: 'indexes',
  MATERIALIZED_VIEWS: 'materializedViews',
  PARTITIONING: 'partitioning'
};

module.exports = {
  Provider,
  Features
};
