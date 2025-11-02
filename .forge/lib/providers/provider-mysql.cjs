/**
 * MySQL/PlanetScale Provider Implementation
 * Traditional SQL database with secure views
 */

const { Provider, Features } = require('./provider-interface.cjs');
const { generateMySQLViews } = require('../security-gen-mysql.cjs');

class MySQLProvider extends Provider {
  constructor(config) {
    super(config);
    this.name = 'mysql';
    this.connection = null;
    
    // Set capabilities from matrix
    this.capabilities = {
      [Features.TRANSACTIONS]: true,
      [Features.RELATIONS]: true,
      [Features.JOINS]: true,
      [Features.FULL_TEXT_SEARCH]: true,
      [Features.JSON_FIELDS]: true,
      [Features.ARRAY_FIELDS]: 'partial',
      [Features.ROW_LEVEL_SECURITY]: false,  // Via views/procedures
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
      [Features.PARTITIONING]: true
    };
    
    // Validate required config
    if (!config.host) {
      throw new Error('MySQL host is required');
    }
    if (!config.user) {
      throw new Error('MySQL user is required');
    }
    if (!config.password) {
      throw new Error('MySQL password is required');
    }
    if (!config.database) {
      throw new Error('MySQL database is required');
    }
  }
  
  /**
   * Initialize MySQL connection
   */
  async init() {
    // In real implementation, would use mysql2 package
    // For now, we'll simulate with a mock connection
    this.connection = {
      host: this.config.host,
      user: this.config.user,
      database: this.config.database,
      connected: true,
      query: async (sql, params) => {
        // Mock query execution
        return { results: [], fields: [] };
      },
      execute: async (sql, params) => {
        return { affectedRows: 0, insertId: 0 };
      }
    };
    
    return;
  }
  
  /**
   * Test connection
   */
  async ping() {
    if (!this.connection) {
      throw new Error('Connection not initialized. Call init() first.');
    }
    
    try {
      await this.connection.query('SELECT 1');
      return true;
    } catch (err) {
      return false;
    }
  }
  
  /**
   * Close connection
   */
  async close() {
    if (this.connection && this.connection.end) {
      await this.connection.end();
    }
    this.connection = null;
    return;
  }
  
  // --- Database Operations ---
  
  /**
   * Create a table
   */
  async createTable(schema) {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }
    
    // Build CREATE TABLE SQL
    let sql = `CREATE TABLE IF NOT EXISTS \`${schema.name}\` (\n`;
    
    const columns = schema.columns.map(col => {
      let def = `  \`${col.name}\` ${col.type}`;
      if (col.primaryKey) def += ' PRIMARY KEY';
      if (col.autoIncrement) def += ' AUTO_INCREMENT';
      if (col.notNull) def += ' NOT NULL';
      if (col.unique) def += ' UNIQUE';
      if (col.default !== undefined) {
        const defaultVal = typeof col.default === 'string' 
          ? `'${col.default}'` 
          : col.default;
        def += ` DEFAULT ${defaultVal}`;
      }
      return def;
    });
    
    sql += columns.join(',\n');
    sql += '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;';
    
    await this.connection.query(sql);
    
    return;
  }
  
  /**
   * Drop a table
   */
  async dropTable(tableName) {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }
    
    const sql = `DROP TABLE IF EXISTS \`${tableName}\``;
    await this.connection.query(sql);
    
    return;
  }
  
  /**
   * Insert a row
   */
  async insert(table, data) {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }
    
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => '?').join(', ');
    
    const sql = `
      INSERT INTO \`${table}\` 
      (${columns.map(c => `\`${c}\``).join(', ')}) 
      VALUES (${placeholders})
    `;
    
    const result = await this.connection.execute(sql, values);
    
    return {
      id: result.insertId,
      ...data
    };
  }
  
  /**
   * Query records
   */
  async query(table, filters = {}, options = {}) {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }
    
    let sql = `SELECT * FROM \`${table}\``;
    const params = [];
    
    // Apply filters
    if (Object.keys(filters).length > 0) {
      const conditions = Object.entries(filters).map(([key, value]) => {
        params.push(value);
        return `\`${key}\` = ?`;
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    // Apply orderBy
    if (options.orderBy) {
      const [column, direction = 'ASC'] = options.orderBy.split(':');
      sql += ` ORDER BY \`${column}\` ${direction.toUpperCase()}`;
    }
    
    // Apply limit and offset
    if (options.limit) {
      sql += ` LIMIT ${parseInt(options.limit)}`;
      if (options.offset) {
        sql += ` OFFSET ${parseInt(options.offset)}`;
      }
    }
    
    const { results } = await this.connection.query(sql, params);
    
    return results || [];
  }
  
  /**
   * Update records
   */
  async update(table, filters, data) {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }
    
    const updates = Object.entries(data).map(([key]) => `\`${key}\` = ?`);
    const updateValues = Object.values(data);
    
    let sql = `UPDATE \`${table}\` SET ${updates.join(', ')}`;
    const params = [...updateValues];
    
    // Apply filters
    if (Object.keys(filters).length > 0) {
      const conditions = Object.entries(filters).map(([key]) => {
        return `\`${key}\` = ?`;
      });
      params.push(...Object.values(filters));
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    const result = await this.connection.execute(sql, params);
    
    return result.affectedRows || 0;
  }
  
  /**
   * Delete records
   */
  async delete(table, filters) {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }
    
    let sql = `DELETE FROM \`${table}\``;
    const params = [];
    
    // Apply filters
    if (Object.keys(filters).length > 0) {
      const conditions = Object.entries(filters).map(([key, value]) => {
        params.push(value);
        return `\`${key}\` = ?`;
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    const result = await this.connection.execute(sql, params);
    
    return result.affectedRows || 0;
  }
  
  // --- Security Operations ---
  
  /**
   * Apply security views and procedures
   */
  async applySecurityRules(policies) {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }
    
    // Handle single policy or array
    if (!Array.isArray(policies)) {
      policies = [policies];
    }
    
    // Generate MySQL views and procedures
    const sql = generateMySQLViews(policies);
    
    // Split by statements and execute
    const statements = this.splitStatements(sql);
    
    for (const stmt of statements) {
      if (stmt.trim()) {
        await this.connection.query(stmt);
      }
    }
    
    return;
  }
  
  /**
   * Split SQL into statements (handles DELIMITER)
   * @private
   */
  splitStatements(sql) {
    const statements = [];
    let current = '';
    let delimiter = ';';
    
    const lines = sql.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check for DELIMITER command
      if (trimmed.startsWith('DELIMITER')) {
        const newDelim = trimmed.split(/\s+/)[1];
        if (newDelim) {
          delimiter = newDelim;
        }
        continue;
      }
      
      current += line + '\n';
      
      // Check if line ends with current delimiter
      if (trimmed.endsWith(delimiter)) {
        // Remove delimiter and add statement
        statements.push(
          current.substring(0, current.lastIndexOf(delimiter))
        );
        current = '';
      }
    }
    
    // Add any remaining content
    if (current.trim()) {
      statements.push(current);
    }
    
    return statements;
  }
  
  /**
   * List security views
   */
  async listSecurityRules() {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }
    
    const sql = `
      SELECT 
        TABLE_NAME as view_name,
        VIEW_DEFINITION as definition
      FROM information_schema.VIEWS
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME LIKE '%_secure'
    `;
    
    const { results } = await this.connection.query(sql, [this.config.database]);
    
    return results || [];
  }
  
  /**
   * Remove security view
   */
  async removeSecurityRule(ruleId) {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }
    
    // Rule ID should be view name
    const sql = `DROP VIEW IF EXISTS \`${ruleId}\``;
    await this.connection.query(sql);
    
    return;
  }
  
  // --- Migration Operations ---
  
  /**
   * Run migrations
   */
  async runMigrations(migrations) {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }
    
    for (const migration of migrations) {
      await this.connection.query(migration.sql);
      
      // Record migration
      await this.connection.execute(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, NOW())',
        [migration.id]
      );
    }
    
    return;
  }
  
  /**
   * Get applied migrations
   */
  async getAppliedMigrations() {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }
    
    // Check if migrations table exists
    const checkSql = `
      SELECT COUNT(*) as count
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'schema_migrations'
    `;
    
    const { results: checkResults } = await this.connection.query(
      checkSql,
      [this.config.database]
    );
    
    if (!checkResults[0] || checkResults[0].count === 0) {
      return [];
    }
    
    // Get applied migrations
    const sql = 'SELECT version FROM schema_migrations ORDER BY applied_at';
    const { results } = await this.connection.query(sql);
    
    return (results || []).map(row => row.version);
  }
}

module.exports = { MySQLProvider };
