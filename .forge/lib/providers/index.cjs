/**
 * Provider Registry Index
 * Auto-registers all available providers
 */

const { registry } = require('./provider-registry.cjs');
const { SupabaseProvider } = require('./provider-supabase.cjs');
const { FirebaseProvider } = require('./provider-firebase.cjs');

// Register providers
registry.register('supabase', SupabaseProvider);
registry.register('firebase', FirebaseProvider);

// Export registry for use
module.exports = {
  registry,
  providers: {
    SupabaseProvider,
    FirebaseProvider
  }
};
