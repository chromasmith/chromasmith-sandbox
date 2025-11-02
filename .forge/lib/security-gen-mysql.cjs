/**
 * Security AST → MySQL Secure Views Generator
 * Converts universal AST into MySQL views with security WHERE clauses
 */

const { NodeType, Operation } = require('./security-ast-schema.cjs');

/**
 * Generate MySQL secure views from AST
 * @param {Object|Object[]} policies - Single policy or array of policies
 * @returns {string} MySQL DDL statements
 */
function generateMySQLViews(policies) {
  // Handle single policy
  if (!Array.isArray(policies)) {
    policies = [policies];
  }
  
  // Group policies by table and operation
  const byTableOp = {};
  for (const policy of policies) {
    const key = `${policy.table}_${policy.operation}`;
    if (!byTableOp[key]) {
      byTableOp[key] = {
        table: policy.table,
        operation: policy.operation,
        conditions: []
      };
    }
    byTableOp[key].conditions.push(policy.using);
  }
  
  let sql = "-- MySQL Secure Views\n";
  sql += "-- Generated from universal security policies\n";
  sql += "-- Usage: SET @current_user_id = 'user-uuid'; SELECT * FROM table_secure;\n\n";
  
  // Generate view for each table/operation combo
  for (const [key, { table, operation, conditions }] of Object.entries(byTableOp)) {
    if (operation === 'SELECT' || operation === 'ALL') {
      sql += generateSecureView(table, conditions);
      sql += "\n";
    }
    
    // For INSERT/UPDATE/DELETE, generate stored procedures
    if (operation === 'INSERT' || operation === 'ALL') {
      sql += generateInsertProcedure(table, conditions);
      sql += "\n";
    }
    
    if (operation === 'UPDATE' || operation === 'ALL') {
      sql += generateUpdateProcedure(table, conditions);
      sql += "\n";
    }
    
    if (operation === 'DELETE' || operation === 'ALL') {
      sql += generateDeleteProcedure(table, conditions);
      sql += "\n";
    }
  }
  
  return sql;
}

/**
 * Generate secure view for SELECT operations
 */
function generateSecureView(table, conditions) {
  let sql = `-- Secure view for table: ${table}\n`;
  sql += `CREATE OR REPLACE VIEW ${table}_secure AS\n`;
  sql += `SELECT * FROM ${table}\n`;
  
  if (conditions.length > 0) {
    const whereClause = conditions.map(c => generateCondition(c)).join(' OR ');
    sql += `WHERE ${whereClause};\n`;
  } else {
    sql += "WHERE TRUE;\n";
  }
  
  return sql;
}

/**
 * Generate stored procedure for INSERT operations
 */
function generateInsertProcedure(table, conditions) {
  let sql = `-- Secure insert procedure for table: ${table}\n`;
  sql += `DELIMITER $$\n`;
  sql += `CREATE OR REPLACE PROCEDURE ${table}_insert_secure()\n`;
  sql += `BEGIN\n`;
  sql += `  -- Check security condition before insert\n`;
  
  if (conditions.length > 0) {
    const condition = generateCondition(conditions[0]);
    sql += `  IF NOT (${condition}) THEN\n`;
    sql += `    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Security policy violation';\n`;
    sql += `  END IF;\n`;
  }
  
  sql += `  -- Perform insert (implementation depends on app)\n`;
  sql += `END$$\n`;
  sql += `DELIMITER ;\n`;
  
  return sql;
}

/**
 * Generate stored procedure for UPDATE operations
 */
function generateUpdateProcedure(table, conditions) {
  let sql = `-- Secure update procedure for table: ${table}\n`;
  sql += `DELIMITER $$\n`;
  sql += `CREATE OR REPLACE PROCEDURE ${table}_update_secure()\n`;
  sql += `BEGIN\n`;
  sql += `  -- Check security condition before update\n`;
  
  if (conditions.length > 0) {
    const condition = generateCondition(conditions[0]);
    sql += `  IF NOT (${condition}) THEN\n`;
    sql += `    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Security policy violation';\n`;
    sql += `  END IF;\n`;
  }
  
  sql += `  -- Perform update (implementation depends on app)\n`;
  sql += `END$$\n`;
  sql += `DELIMITER ;\n`;
  
  return sql;
}

/**
 * Generate stored procedure for DELETE operations
 */
function generateDeleteProcedure(table, conditions) {
  let sql = `-- Secure delete procedure for table: ${table}\n`;
  sql += `DELIMITER $$\n`;
  sql += `CREATE OR REPLACE PROCEDURE ${table}_delete_secure()\n`;
  sql += `BEGIN\n`;
  sql += `  -- Check security condition before delete\n`;
  
  if (conditions.length > 0) {
    const condition = generateCondition(conditions[0]);
    sql += `  IF NOT (${condition}) THEN\n`;
    sql += `    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Security policy violation';\n`;
    sql += `  END IF;\n`;
  }
  
  sql += `  -- Perform delete (implementation depends on app)\n`;
  sql += `END$$\n`;
  sql += `DELIMITER ;\n`;
  
  return sql;
}

/**
 * Generate condition expression from AST node
 */
function generateCondition(node) {
  if (!node) {
    return 'TRUE';
  }
  
  switch (node.type) {
    case NodeType.COMPARISON:
      return generateComparison(node);
    case NodeType.LOGICAL:
      return generateLogical(node);
    case NodeType.AUTH:
      return generateAuth(node);
    case NodeType.FIELD:
      return generateField(node);
    case NodeType.LITERAL:
      return generateLiteral(node);
    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

/**
 * Generate comparison expression
 */
function generateComparison(node) {
  const left = generateCondition(node.left);
  const right = generateCondition(node.right);
  return `${left} ${node.operator} ${right}`;
}

/**
 * Generate logical expression
 */
function generateLogical(node) {
  const left = generateCondition(node.left);
  
  if (node.operator === 'NOT') {
    return `NOT (${left})`;
  }
  
  const right = generateCondition(node.right);
  return `(${left}) ${node.operator} (${right})`;
}

/**
 * Generate auth expression (uses MySQL session variable)
 */
function generateAuth(node) {
  // Map auth fields to session variables
  const varMap = {
    'uid': '@current_user_id',
    'role': '@current_user_role',
    'email': '@current_user_email'
  };
  
  return varMap[node.auth_field] || `@current_${node.auth_field}`;
}

/**
 * Generate field expression
 */
function generateField(node) {
  return node.field;
}

/**
 * Generate literal expression
 */
function generateLiteral(node) {
  if (node.value === null) {
    return 'NULL';
  }
  if (typeof node.value === 'string') {
    return `'${node.value.replace(/'/g, "''")}'`;  // Escape single quotes
  }
  if (typeof node.value === 'boolean') {
    return node.value ? 'TRUE' : 'FALSE';
  }
  return String(node.value);
}

module.exports = {
  generateMySQLViews,
  generateSecureView,
  generateCondition
};
