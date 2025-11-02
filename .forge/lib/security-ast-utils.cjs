/**
 * Security AST Utilities
 * Helper functions for building and manipulating security policy ASTs
 */

const { NodeType, ComparisonOp, LogicalOp, Operation } = require('./security-ast-schema.cjs');

/**
 * Create a policy node
 */
function createPolicy(id, table, operation, using, withCheck = null) {
  return {
    type: NodeType.POLICY,
    id,
    table,
    operation,
    using,
    withCheck
  };
}

/**
 * Create a comparison node
 */
function createComparison(operator, left, right) {
  return {
    type: NodeType.COMPARISON,
    operator,
    left,
    right
  };
}

/**
 * Create a logical node (AND, OR, NOT)
 */
function createLogical(operator, left, right = null) {
  return {
    type: NodeType.LOGICAL,
    operator,
    left,
    right: operator === LogicalOp.NOT ? null : right
  };
}

/**
 * Create an auth node
 */
function createAuth(authField = 'uid') {
  return {
    type: NodeType.AUTH,
    auth_field: authField
  };
}

/**
 * Create a field node
 */
function createField(fieldName) {
  return {
    type: NodeType.FIELD,
    field: fieldName
  };
}

/**
 * Create a literal node
 */
function createLiteral(value) {
  return {
    type: NodeType.LITERAL,
    value
  };
}

/**
 * Validate AST structure
 */
function validateAST(ast) {
  if (!ast || typeof ast !== 'object') {
    throw new Error('AST must be an object');
  }
  
  if (ast.type !== NodeType.POLICY) {
    throw new Error('Root AST node must be a policy');
  }
  
  if (!ast.id || !ast.table || !ast.operation || !ast.using) {
    throw new Error('Policy must have id, table, operation, and using');
  }
  
  // Recursively validate condition nodes
  validateCondition(ast.using);
  if (ast.withCheck) {
    validateCondition(ast.withCheck);
  }
  
  return true;
}

function validateCondition(node) {
  if (!node || typeof node !== 'object') {
    throw new Error('Condition must be an object');
  }
  
  const validTypes = Object.values(NodeType);
  if (!validTypes.includes(node.type)) {
    throw new Error(`Invalid node type: ${node.type}`);
  }
  
  // Type-specific validation
  if (node.type === NodeType.COMPARISON && (!node.operator || !node.left || !node.right)) {
    throw new Error('Comparison node must have operator, left, and right');
  }
  
  if (node.type === NodeType.LOGICAL && (!node.operator || !node.left)) {
    throw new Error('Logical node must have operator and left');
  }
  
  // Recurse into nested conditions
  if (node.left && typeof node.left === 'object') {
    validateCondition(node.left);
  }
  if (node.right && typeof node.right === 'object') {
    validateCondition(node.right);
  }
  
  return true;
}

/**
 * Pretty print AST for debugging
 */
function printAST(ast, indent = 0) {
  const spaces = '  '.repeat(indent);
  
  if (ast.type === NodeType.POLICY) {
    console.log(`${spaces}POLICY: ${ast.id}`);
    console.log(`${spaces}  Table: ${ast.table}`);
    console.log(`${spaces}  Operation: ${ast.operation}`);
    console.log(`${spaces}  Using:`);
    printAST(ast.using, indent + 2);
    if (ast.withCheck) {
      console.log(`${spaces}  With Check:`);
      printAST(ast.withCheck, indent + 2);
    }
  } else if (ast.type === NodeType.COMPARISON) {
    console.log(`${spaces}COMPARISON: ${ast.operator}`);
    console.log(`${spaces}  Left:`);
    printAST(ast.left, indent + 2);
    console.log(`${spaces}  Right:`);
    printAST(ast.right, indent + 2);
  } else if (ast.type === NodeType.LOGICAL) {
    console.log(`${spaces}LOGICAL: ${ast.operator}`);
    console.log(`${spaces}  Left:`);
    printAST(ast.left, indent + 2);
    if (ast.right) {
      console.log(`${spaces}  Right:`);
      printAST(ast.right, indent + 2);
    }
  } else if (ast.type === NodeType.AUTH) {
    console.log(`${spaces}AUTH: ${ast.auth_field}`);
  } else if (ast.type === NodeType.FIELD) {
    console.log(`${spaces}FIELD: ${ast.field}`);
  } else if (ast.type === NodeType.LITERAL) {
    console.log(`${spaces}LITERAL: ${JSON.stringify(ast.value)}`);
  }
}

module.exports = {
  createPolicy,
  createComparison,
  createLogical,
  createAuth,
  createField,
  createLiteral,
  validateAST,
  printAST
};