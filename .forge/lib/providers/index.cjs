/**
 * Provider Registry Index
 * Auto-registers all available providers
 */

const { registry } = require('./provider-registry.cjs');
const { SupabaseProvider } = require('./provider-supabase.cjs');

// Register Supabase provider
registry.register('supabase', SupabaseProvider);

// Export registry for use
module.exports = {
  registry,
  providers: {
    SupabaseProvider
  }
};