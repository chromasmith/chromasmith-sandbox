/**
 * Provider Capability Matrix
 * Documents what features each provider supports
 */

const { Features } = require('./provider-interface.cjs');

/**
 * Capability matrix for all providers
 * true = fully supported
 * false = not supported
 * 'partial' = partially supported (see notes)
 */
const CapabilityMatrix = {
  supabase: {
    [Features.TRANSACTIONS]: true,
    [Features.RELATIONS]: true,
    [Features.JOINS]: true,
    [Features.FULL_TEXT_SEARCH]: true,
    [Features.JSON_FIELDS]: true,
    [Features.ARRAY_FIELDS]: true,
    [Features.ROW_LEVEL_SECURITY]: true,
    [Features.COLUMN_LEVEL_SECURITY]: false,
    [Features.ROLE_BASED_ACCESS]: true,
    [Features.REAL_TIME_SUBSCRIPTIONS]: true,
    [Features.GEOSPATIAL]: true,
    [Features.TIME_SERIES]: 'partial',
    [Features.VECTOR_SEARCH]: true,
    [Features.SCHEMA_MIGRATIONS]: true,
    [Features.ROLLBACK]: true,
    [Features.INDEXES]: true,
    [Features.MATERIALIZED_VIEWS]: true,
    [Features.PARTITIONING]: true,
    notes: 'Postgres-based with full SQL support'
  },
  
  firebase: {
    [Features.TRANSACTIONS]: true,
    [Features.RELATIONS]: false,
    [Features.JOINS]: false,
    [Features.FULL_TEXT_SEARCH]: false,
    [Features.JSON_FIELDS]: true,
    [Features.ARRAY_FIELDS]: true,
    [Features.ROW_LEVEL_SECURITY]: true,
    [Features.COLUMN_LEVEL_SECURITY]: false,
    [Features.ROLE_BASED_ACCESS]: true,
    [Features.REAL_TIME_SUBSCRIPTIONS]: true,
    [Features.GEOSPATIAL]: 'partial',
    [Features.TIME_SERIES]: false,
    [Features.VECTOR_SEARCH]: false,
    [Features.SCHEMA_MIGRATIONS]: false,
    [Features.ROLLBACK]: false,
    [Features.INDEXES]: true,
    [Features.MATERIALIZED_VIEWS]: false,
    [Features.PARTITIONING]: false,
    notes: 'NoSQL document store with security rules'
  },
  
  mysql: {
    [Features.TRANSACTIONS]: true,
    [Features.RELATIONS]: true,
    [Features.JOINS]: true,
    [Features.FULL_TEXT_SEARCH]: true,
    [Features.JSON_FIELDS]: true,
    [Features.ARRAY_FIELDS]: 'partial',
    [Features.ROW_LEVEL_SECURITY]: false,
    [Features.COLUMN_LEVEL_SECURITY]: false,
    [Features.ROLE_BASED_ACCESS]: true,
    [Features.REAL_TIME_SUBSCRIPTIONS]: false,
    [Features.GEOSPATIAL]: true,
    [Features.TIME_SERIES]: false,
    [Features.VECTOR_SEARCH]: false,
    [Features.SCHEMA_MIGRATIONS]: true,
    [Features.ROLLBACK]: true,
    [Features.INDEXES]: true,
    [Features.MATERIALIZED_VIEWS]: false,
    [Features.PARTITIONING]: true,
    notes: 'Traditional SQL database, RLS via views/procedures'
  },
  
  mongodb: {
    [Features.TRANSACTIONS]: true,
    [Features.RELATIONS]: 'partial',
    [Features.JOINS]: 'partial',
    [Features.FULL_TEXT_SEARCH]: true,
    [Features.JSON_FIELDS]: true,
    [Features.ARRAY_FIELDS]: true,
    [Features.ROW_LEVEL_SECURITY]: 'partial',
    [Features.COLUMN_LEVEL_SECURITY]: false,
    [Features.ROLE_BASED_ACCESS]: true,
    [Features.REAL_TIME_SUBSCRIPTIONS]: true,
    [Features.GEOSPATIAL]: true,
    [Features.TIME_SERIES]: true,
    [Features.VECTOR_SEARCH]: true,
    [Features.SCHEMA_MIGRATIONS]: false,
    [Features.ROLLBACK]: false,
    [Features.INDEXES]: true,
    [Features.MATERIALIZED_VIEWS]: false,
    [Features.PARTITIONING]: true,
    notes: 'NoSQL document store with aggregation pipeline'
  },
  
  dynamodb: {
    [Features.TRANSACTIONS]: true,
    [Features.RELATIONS]: false,
    [Features.JOINS]: false,
    [Features.FULL_TEXT_SEARCH]: false,
    [Features.JSON_FIELDS]: true,
    [Features.ARRAY_FIELDS]: true,
    [Features.ROW_LEVEL_SECURITY]: 'partial',
    [Features.COLUMN_LEVEL_SECURITY]: false,
    [Features.ROLE_BASED_ACCESS]: true,
    [Features.REAL_TIME_SUBSCRIPTIONS]: true,
    [Features.GEOSPATIAL]: false,
    [Features.TIME_SERIES]: false,
    [Features.VECTOR_SEARCH]: false,
    [Features.SCHEMA_MIGRATIONS]: false,
    [Features.ROLLBACK]: false,
    [Features.INDEXES]: true,
    [Features.MATERIALIZED_VIEWS]: false,
    [Features.PARTITIONING]: true,
    notes: 'Key-value/document store, security via IAM policies'
  }
};

/**
 * Get capabilities for a provider
 * @param {string} providerName
 * @returns {Object|null}
 */
function getCapabilities(providerName) {
  return CapabilityMatrix[providerName] || null;
}

/**
 * Compare providers by feature support
 * @param {Array<string>} providerNames
 * @param {Array<string>} features
 * @returns {Object}
 */
function compareProviders(providerNames, features) {
  const comparison = {};
  
  for (const feature of features) {
    comparison[feature] = {};
    for (const provider of providerNames) {
      const caps = CapabilityMatrix[provider];
      comparison[feature][provider] = caps ? caps[feature] : false;
    }
  }
  
  return comparison;
}

/**
 * Find providers that support all given features
 * @param {Array<string>} requiredFeatures
 * @returns {Array<string>}
 */
function findProvidersWithFeatures(requiredFeatures) {
  const matches = [];
  
  for (const [provider, caps] of Object.entries(CapabilityMatrix)) {
    const supportsAll = requiredFeatures.every(feature => {
      const support = caps[feature];
      return support === true || support === 'partial';
    });
    
    if (supportsAll) {
      matches.push(provider);
    }
  }
  
  return matches;
}

module.exports = {
  CapabilityMatrix,
  getCapabilities,
  compareProviders,
  findProvidersWithFeatures
};
