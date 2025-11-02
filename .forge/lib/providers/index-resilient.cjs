/**
 * Resilient Providers - Main Export
 * Forge Flow 6.4 - T3.2
 */

// Re-export base provider system
const providerRegistry = require('./provider-registry.cjs');
const providerInterface = require('./provider-interface.cjs');
const capabilityMatrix = require('./capability-matrix.cjs');

// Re-export resilient wrapper
const resilientWrapper = require('../resilient-provider-wrapper.cjs');
const resilientFactory = require('./resilient-provider-factory.cjs');

// Re-export individual providers
const SupabaseProvider = require('./provider-supabase.cjs');
const FirebaseProvider = require('./provider-firebase.cjs');
const MySQLProvider = require('./provider-mysql.cjs');
const MongoDBProvider = require('./provider-mongodb.cjs');
const DynamoDBProvider = require('./provider-dynamodb.cjs');

module.exports = {
  // Base system
  ...providerRegistry,
  ...providerInterface,
  ...capabilityMatrix,
  
  // Resilient features
  ...resilientWrapper,
  ...resilientFactory,
  
  // Providers
  SupabaseProvider,
  FirebaseProvider,
  MySQLProvider,
  MongoDBProvider,
  DynamoDBProvider
};
