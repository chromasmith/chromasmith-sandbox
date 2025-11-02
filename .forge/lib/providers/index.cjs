/**
 * Provider Registry Index
 * Auto-registers all available providers
 */

const { registry } = require('./provider-registry.cjs');
const { SupabaseProvider } = require('./provider-supabase.cjs');
const { FirebaseProvider } = require('./provider-firebase.cjs');
const { MySQLProvider } = require('./provider-mysql.cjs');
const { MongoDBProvider } = require('./provider-mongodb.cjs');

// Register providers
registry.register('supabase', SupabaseProvider);
registry.register('firebase', FirebaseProvider);
registry.register('mysql', MySQLProvider);
registry.register('mongodb', MongoDBProvider);

// Export registry for use
module.exports = {
  registry,
  providers: {
    SupabaseProvider,
    FirebaseProvider,
    MySQLProvider,
    MongoDBProvider
  }
};
