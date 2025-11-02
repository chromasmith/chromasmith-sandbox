/**
 * Supabase Provider Implementation
 * Postgres-based provider with full RLS support
 */

const { Provider, Features } = require('./provider-interface.cjs');
const { parseRLS } = require('../security-parse-rls.cjs');

class SupabaseProvider extends Provider {
  constructor(config) {
    super(config);
    this.name = 'supabase';
    this.client = null;
    
    // Set capabilities from matrix
    this.capabilities = {
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
      [Features.PARTITIONING]: true
    };
    
    // Validate required config
    if (!config.url) {
      throw new Error('Supabase URL is required');
    }
    if (!config.key) {
      throw new Error('Supabase anon/service key is required');
    }
  }
  
  /**
   * Initialize Supabase client
   */
  async init() {
    // In real implementation, would import @supabase/supabase-js
    // For now, we'll simulate with a mock client
    this.client = {
      url: this.config.url,
      key: this.config.key,
      initialized: true,
      from: (table) => ({
        select: () => ({ data: [], error: null }),
        insert: () => ({ data: {}, error: null }),
        update: () => ({ data: {}, error: null }),
        delete: () => ({ data: {}, error: null })
      }),
      rpc: () => ({ data: null, error: null })
    };
    
    return;
  }
  
  /**
   * Test connection
   */
  async ping() {
    if (!this.client) {
      throw new Error('Client not initialized. Call init() first.');
    }
    
    // Test with a simple query
    try {
      const { error } = await this.client.rpc('ping');
      return !error;
    } catch (err) {
      return false;
    }
  }
  
  /**
   * Close connection
   */
  async close() {
    this.client = null;
    return;
  }
  
  // --- Database Operations ---
  
  /**
   * Create a table
   */
  async createTable(schema) {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    
    // Build CREATE TABLE SQL
    let sql = `CREATE TABLE ${schema.name} (\n`;
    
    const columns = schema.columns.map(col => {
      let def = `  ${col.name} ${col.type}`;
      if (col.primaryKey) def += ' PRIMARY KEY';
      if (col.notNull) def += ' NOT NULL';
      if (col.unique) def += ' UNIQUE';
      if (col.default !== undefined) def += ` DEFAULT ${col.default}`;
      return def;
    });
    
    sql += columns.join(',\n');
    sql += '\n);';
    
    // Execute via RPC (in real implementation)
    const { error } = await this.client.rpc('exec_sql', { sql });
    
    if (error) {
      throw new Error(`Failed to create table: ${error.message}`);
    }
    
    return;
  }
  
  /**
   * Drop a table
   */
  async dropTable(tableName) {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    
    const sql = `DROP TABLE IF EXISTS ${tableName};`;
    const { error } = await this.client.rpc('exec_sql', { sql });
    
    if (error) {
      throw new Error(`Failed to drop table: ${error.message}`);
    }
    
    return;
  }
  
  /**
   * Insert a row
   */
  async insert(table, data) {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    
    const { data: result, error } = await this.client
      .from(table)
      .insert(data)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Insert failed: ${error.message}`);
    }
    
    return result;
  }
  
  /**
   * Query records
   */
  async query(table, filters = {}, options = {}) {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    
    let query = this.client.from(table).select('*');
    
    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    
    // Apply options
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }
    
    if (options.orderBy) {
      const [column, direction = 'asc'] = options.orderBy.split(':');
      query = query.order(column, { ascending: direction === 'asc' });
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Update records
   */
  async update(table, filters, data) {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    
    let query = this.client.from(table).update(data);
    
    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    
    const { error, count } = await query;
    
    if (error) {
      throw new Error(`Update failed: ${error.message}`);
    }
    
    return count || 0;
  }
  
  /**
   * Delete records
   */
  async delete(table, filters) {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    
    let query = this.client.from(table).delete();
    
    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    
    const { error, count } = await query;
    
    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
    
    return count || 0;
  }
  
  // --- Security Operations ---
  
  /**
   * Apply RLS policies
   */
  async applySecurityRules(policies) {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    
    // Handle single policy or array
    if (!Array.isArray(policies)) {
      policies = [policies];
    }
    
    // For each policy AST, generate SQL and execute
    for (const policy of policies) {
      // If it's an AST object, convert to SQL
      let sql;
      if (policy.type === 'policy') {
        sql = this.astToRLSSQL(policy);
      } else if (typeof policy === 'string') {
        // Already SQL
        sql = policy;
      } else {
        throw new Error('Policy must be AST object or SQL string');
      }
      
      const { error } = await this.client.rpc('exec_sql', { sql });
      
      if (error) {
        throw new Error(`Failed to apply policy: ${error.message}`);
      }
    }
    
    return;
  }
  
  /**
   * Convert AST to RLS SQL
   * @private
   */
  astToRLSSQL(policy) {
    let sql = `CREATE POLICY "${policy.id}" ON ${policy.table}`;
    sql += `\n  FOR ${policy.operation}`;
    sql += `\n  USING (${this.conditionToSQL(policy.using)})`;
    
    if (policy.withCheck) {
      sql += `\n  WITH CHECK (${this.conditionToSQL(policy.withCheck)})`;
    }
    
    sql += ';';
    return sql;
  }
  
  /**
   * Convert AST condition to SQL
   * @private
   */
  conditionToSQL(node) {
    if (!node) return 'true';
    
    switch (node.type) {
      case 'comparison':
        return `${this.valueToSQL(node.left)} ${node.operator} ${this.valueToSQL(node.right)}`;
      case 'logical':
        if (node.operator === 'NOT') {
          return `NOT (${this.conditionToSQL(node.left)})`;
        }
        return `(${this.conditionToSQL(node.left)}) ${node.operator} (${this.conditionToSQL(node.right)})`;
      case 'auth':
        return `auth.${node.auth_field}()`;
      case 'field':
        return node.field;
      case 'literal':
        if (node.value === null) return 'NULL';
        if (typeof node.value === 'string') return `'${node.value}'`;
        if (typeof node.value === 'boolean') return node.value ? 'true' : 'false';
        return String(node.value);
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }
  
  /**
   * Convert AST value to SQL
   * @private
   */
  valueToSQL(node) {
    return this.conditionToSQL(node);
  }
  
  /**
   * List security rules
   */
  async listSecurityRules() {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    
    const sql = `
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      ORDER BY tablename, policyname;
    `;
    
    const { data, error } = await this.client.rpc('exec_sql', { sql });
    
    if (error) {
      throw new Error(`Failed to list policies: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Remove security rule
   */
  async removeSecurityRule(ruleId) {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    
    // Parse ruleId as "table.policy_name"
    const [table, policyName] = ruleId.split('.');
    
    if (!table || !policyName) {
      throw new Error('Rule ID must be in format "table.policy_name"');
    }
    
    const sql = `DROP POLICY IF EXISTS "${policyName}" ON ${table};`;
    const { error } = await this.client.rpc('exec_sql', { sql });
    
    if (error) {
      throw new Error(`Failed to remove policy: ${error.message}`);
    }
    
    return;
  }
  
  // --- Migration Operations ---
  
  /**
   * Run migrations
   */
  async runMigrations(migrations) {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    
    for (const migration of migrations) {
      const { error } = await this.client.rpc('exec_sql', { sql: migration.sql });
      
      if (error) {
        throw new Error(`Migration ${migration.id} failed: ${error.message}`);
      }
    }
    
    return;
  }
  
  /**
   * Get applied migrations
   */
  async getAppliedMigrations() {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    
    // Check if migrations table exists
    const checkSql = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_migrations'
      );
    `;
    
    const { data: exists } = await this.client.rpc('exec_sql', { sql: checkSql });
    
    if (!exists) {
      return [];
    }
    
    // Get applied migrations
    const sql = 'SELECT version FROM schema_migrations ORDER BY version;';
    const { data, error } = await this.client.rpc('exec_sql', { sql });
    
    if (error) {
      throw new Error(`Failed to get migrations: ${error.message}`);
    }
    
    return (data || []).map(row => row.version);
  }
}

module.exports = { SupabaseProvider };