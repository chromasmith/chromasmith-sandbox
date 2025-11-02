/**
 * Security Policy AST Schema v1.0
 * Universal representation of database security policies
 * 
 * Supports: Supabase RLS, Firebase Rules, MySQL, DynamoDB, MongoDB
 */

// AST Node Types
const NodeType = {
  POLICY: 'policy',
  CONDITION: 'condition',
  COMPARISON: 'comparison',
  LOGICAL: 'logical',
  FUNCTION: 'function',
  FIELD: 'field',
  LITERAL: 'literal',
  AUTH: 'auth'
};

// Comparison Operators
const ComparisonOp = {
  EQUALS: '=',
  NOT_EQUALS: '!=',
  GREATER: '>',
  LESS: '<',
  GREATER_EQUAL: '>=',
  LESS_EQUAL: '<=',
  IN: 'IN',
  NOT_IN: 'NOT IN',
  LIKE: 'LIKE',
  IS_NULL: 'IS NULL',
  IS_NOT_NULL: 'IS NOT NULL'
};

// Logical Operators
const LogicalOp = {
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT'
};

// CRUD Operations
const Operation = {
  SELECT: 'SELECT',
  INSERT: 'INSERT',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  ALL: 'ALL'
};

/**
 * Policy AST Structure
 * @typedef {Object} PolicyNode
 * @property {string} type - Always 'policy'
 * @property {string} id - Policy name
 * @property {string} table - Table/collection name
 * @property {string} operation - SELECT|INSERT|UPDATE|DELETE|ALL
 * @property {ConditionNode} using - USING clause condition
 * @property {ConditionNode} [withCheck] - WITH CHECK clause condition (optional)
 */

/**
 * Condition AST Node (recursive)
 * @typedef {Object} ConditionNode
 * @property {string} type - 'comparison'|'logical'|'function'|'field'|'literal'|'auth'
 * @property {string} [operator] - Comparison or logical operator
 * @property {ConditionNode|string|number} [left] - Left operand
 * @property {ConditionNode|string|number} [right] - Right operand
 * @property {string} [field] - Field name (for type='field')
 * @property {*} [value] - Literal value (for type='literal')
 * @property {string} [auth_field] - Auth field like 'uid' (for type='auth')
 */

// Example AST for: auth.uid() = user_id
const exampleAST = {
  type: NodeType.POLICY,
  id: 'select_own_posts',
  table: 'posts',
  operation: Operation.SELECT,
  using: {
    type: NodeType.COMPARISON,
    operator: ComparisonOp.EQUALS,
    left: {
      type: NodeType.AUTH,
      auth_field: 'uid'
    },
    right: {
      type: NodeType.FIELD,
      field: 'user_id'
    }
  }
};

module.exports = {
  NodeType,
  ComparisonOp,
  LogicalOp,
  Operation,
  exampleAST
};