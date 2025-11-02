/**
 * MongoDB Provider Implementation
 * Document store with aggregation pipeline and schema validation
 */

const { Provider, Features } = require('./provider-interface.cjs');

class MongoDBProvider extends Provider {
  constructor(config) {
    super(config);
    this.name = 'mongodb';
    this.client = null;
    this.db = null;
    
    // Set capabilities from matrix
    this.capabilities = {
      [Features.TRANSACTIONS]: true,
      [Features.RELATIONS]: 'partial',  // Via $lookup
      [Features.JOINS]: 'partial',  // Via aggregation pipeline
      [Features.FULL_TEXT_SEARCH]: true,
      [Features.JSON_FIELDS]: true,
      [Features.ARRAY_FIELDS]: true,
      [Features.ROW_LEVEL_SECURITY]: 'partial',  // Via Atlas rules
      [Features.COLUMN_LEVEL_SECURITY]: false,
      [Features.ROLE_BASED_ACCESS]: true,
      [Features.REAL_TIME_SUBSCRIPTIONS]: true,  // Via Change Streams
      [Features.GEOSPATIAL]: true,
      [Features.TIME_SERIES]: true,
      [Features.VECTOR_SEARCH]: true,
      [Features.SCHEMA_MIGRATIONS]: false,  // Schemaless
      [Features.ROLLBACK]: false,
      [Features.INDEXES]: true,
      [Features.MATERIALIZED_VIEWS]: false,
      [Features.PARTITIONING]: true  // Via sharding
    };
    
    // Validate required config
    if (!config.uri && !config.host) {
      throw new Error('MongoDB URI or host is required');
    }
    if (!config.database) {
      throw new Error('MongoDB database name is required');
    }
  }
  
  /**
   * Initialize MongoDB connection
   */
  async init() {
    // In real implementation, would use mongodb package
    // For now, we'll simulate with a mock client
    this.client = {
      uri: this.config.uri || `mongodb://${this.config.host}`,
      connected: true,
      db: (name) => ({
        collection: (collectionName) => ({
          find: async (query) => ({
            toArray: async () => []
          }),
          findOne: async (query) => null,
          insertOne: async (doc) => ({
            insertedId: 'mock-id',
            acknowledged: true
          }),
          insertMany: async (docs) => ({
            insertedIds: docs.map((_, i) => `mock-id-${i}`),
            acknowledged: true
          }),
          updateOne: async (filter, update) => ({
            matchedCount: 1,
            modifiedCount: 1,
            acknowledged: true
          }),
          updateMany: async (filter, update) => ({
            matchedCount: 0,
            modifiedCount: 0,
            acknowledged: true
          }),
          deleteOne: async (filter) => ({
            deletedCount: 1,
            acknowledged: true
          }),
          deleteMany: async (filter) => ({
            deletedCount: 0,
            acknowledged: true
          }),
          aggregate: (pipeline) => ({
            toArray: async () => []
          }),
          createIndex: async (keys, options) => 'mock-index',
          drop: async () => true
        })
      })
    };
    
    this.db = this.client.db(this.config.database);
    
    return;
  }
  
  /**
   * Test connection
   */
  async ping() {
    if (!this.client) {
      throw new Error('Client not initialized. Call init() first.');
    }
    
    try {
      await this.db.collection('_ping').findOne({});
      return true;
    } catch (err) {
      return false;
    }
  }
  
  /**
   * Close connection
   */
  async close() {
    if (this.client && this.client.close) {
      await this.client.close();
    }
    this.client = null;
    this.db = null;
    return;
  }
  
  // --- Database Operations ---
  
  /**
   * Create a collection with schema validation
   */
  async createTable(schema) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    // Build JSON Schema validator from schema definition
    const validator = this.buildValidator(schema);
    
    // MongoDB creates collections implicitly, but we can set validation
    await this.db.createCollection(schema.name, {
      validator: {
        $jsonSchema: validator
      },
      validationLevel: 'strict'
    });
    
    // Create indexes if specified
    if (schema.indexes) {
      const collection = this.db.collection(schema.name);
      for (const index of schema.indexes) {
        await collection.createIndex(
          index.fields,
          { unique: index.unique || false }
        );
      }
    }
    
    return;
  }
  
  /**
   * Build JSON Schema validator from schema definition
   * @private
   */
  buildValidator(schema) {
    const properties = {};
    const required = [];
    
    for (const col of schema.columns) {
      const prop = {};
      
      // Map types to BSON types
      const typeMap = {
        'string': 'string',
        'int': 'int',
        'integer': 'int',
        'bigint': 'long',
        'float': 'double',
        'double': 'double',
        'boolean': 'bool',
        'date': 'date',
        'timestamp': 'date',
        'json': 'object',
        'array': 'array'
      };
      
      prop.bsonType = typeMap[col.type.toLowerCase()] || 'string';
      
      if (col.description) {
        prop.description = col.description;
      }
      
      properties[col.name] = prop;
      
      if (col.notNull) {
        required.push(col.name);
      }
    }
    
    return {
      bsonType: 'object',
      required,
      properties
    };
  }
  
  /**
   * Drop a collection
   */
  async dropTable(tableName) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    await this.db.collection(tableName).drop();
    return;
  }
  
  /**
   * Insert a document
   */
  async insert(table, data) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    const result = await this.db.collection(table).insertOne(data);
    
    return {
      id: result.insertedId.toString(),
      ...data
    };
  }
  
  /**
   * Query documents
   */
  async query(table, filters = {}, options = {}) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    let cursor = this.db.collection(table).find(filters);
    
    // Apply options
    if (options.orderBy) {
      const [field, direction = 'asc'] = options.orderBy.split(':');
      cursor = cursor.sort({ [field]: direction === 'desc' ? -1 : 1 });
    }
    
    if (options.limit) {
      cursor = cursor.limit(parseInt(options.limit));
    }
    
    if (options.offset) {
      cursor = cursor.skip(parseInt(options.offset));
    }
    
    const results = await cursor.toArray();
    
    // Convert _id to id for consistency
    return results.map(doc => ({
      ...doc,
      id: doc._id.toString(),
      _id: undefined
    }));
  }
  
  /**
   * Update documents
   */
  async update(table, filters, data) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    const result = await this.db.collection(table).updateMany(
      filters,
      { $set: data }
    );
    
    return result.modifiedCount;
  }
  
  /**
   * Delete documents
   */
  async delete(table, filters) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    const result = await this.db.collection(table).deleteMany(filters);
    
    return result.deletedCount;
  }
  
  // --- Security Operations ---
  
  /**
   * Apply MongoDB Atlas security rules
   */
  async applySecurityRules(policies) {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    
    // MongoDB security is typically configured via Atlas UI or API
    // For now, we'll store the policies for reference
    this.securityPolicies = Array.isArray(policies) ? policies : [policies];
    
    // In real implementation, would use MongoDB Atlas Admin API
    // to apply role-based access control rules
    
    return;
  }
  
  /**
   * List security rules
   */
  async listSecurityRules() {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    
    // Return stored policies
    return this.securityPolicies || [];
  }
  
  /**
   * Remove security rule
   */
  async removeSecurityRule(ruleId) {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    
    if (!this.securityPolicies) {
      return;
    }
    
    this.securityPolicies = this.securityPolicies.filter(
      p => p.id !== ruleId
    );
    
    return;
  }
  
  // --- Migration Operations ---
  
  /**
   * Run data migrations
   */
  async runMigrations(migrations) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    // MongoDB migrations are typically data transformations
    for (const migration of migrations) {
      if (typeof migration.fn === 'function') {
        await migration.fn(this.db);
      }
      
      // Record migration
      await this.db.collection('_migrations').insertOne({
        version: migration.id,
        appliedAt: new Date()
      });
    }
    
    return;
  }
  
  /**
   * Get applied migrations
   */
  async getAppliedMigrations() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    try {
      const docs = await this.db
        .collection('_migrations')
        .find({})
        .sort({ appliedAt: 1 })
        .toArray();
      
      return docs.map(doc => doc.version);
    } catch (err) {
      return [];
    }
  }
}

module.exports = { MongoDBProvider };
