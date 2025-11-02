/**
 * Security AST → Firestore Rules Generator
 * Converts universal AST into Firestore security rules
 */

const { NodeType, Operation } = require('./security-ast-schema.cjs');

/**
 * Generate Firestore rules from AST
 * @param {Object|Object[]} policies - Single policy or array of policies
 * @returns {string} Firestore rules content
 */
function generateFirestoreRules(policies) {
  // Handle single policy
  if (!Array.isArray(policies)) {
    policies = [policies];
  }
  
  // Group policies by table (collection)
  const byTable = {};
  for (const policy of policies) {
    if (!byTable[policy.table]) {
      byTable[policy.table] = [];
    }
    byTable[policy.table].push(policy);
  }
  
  // Generate rules
  let rules = "rules_version = '2';\n";
  rules += "service cloud.firestore {\n";
  rules += "  match /databases/{database}/documents {\n";
  
  // Generate match block for each table
  for (const [table, tablePolicies] of Object.entries(byTable)) {
    rules += `    match /${table}/{docId} {\n`;
    
    // Group by operation
    const allowRules = {};
    for (const policy of tablePolicies) {
      const firestoreOp = mapOperation(policy.operation);
      const condition = generateCondition(policy.using);
      
      if (!allowRules[firestoreOp]) {
        allowRules[firestoreOp] = [];
      }
      allowRules[firestoreOp].push(condition);
    }
    
    // Emit allow rules
    for (const [op, conditions] of Object.entries(allowRules)) {
      if (conditions.length === 1) {
        rules += `      allow ${op}: if (${conditions[0]});\n`;
      } else {
        // Multiple conditions for same operation - OR them
        const combined = conditions.join(' || ');
        rules += `      allow ${op}: if (${combined});\n`;
      }
    }
    
    rules += "    }\n";
  }
  
  rules += "  }\n";
  rules += "}\n";
  
  return rules;
}

/**
 * Map SQL operation to Firestore operation
 */
function mapOperation(operation) {
  const mapping = {
    'SELECT': 'read',
    'INSERT': 'create',
    'UPDATE': 'update',
    'DELETE': 'delete',
    'ALL': 'read, write'
  };
  return mapping[operation] || 'read';
}

/**
 * Generate condition expression from AST node
 */
function generateCondition(node) {
  if (!node) {
    return 'true';
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
  const op = mapComparisonOp(node.operator);
  return `${left} ${op} ${right}`;
}

/**
 * Map SQL comparison operator to Firestore
 */
function mapComparisonOp(operator) {
  const mapping = {
    '=': '==',
    '!=': '!=',
    '>': '>',
    '<': '<',
    '>=': '>=',
    '<=': '<=',
    'IN': 'in',
    'NOT IN': 'not in',
    'LIKE': '==',  // Firestore doesn't have LIKE, use ==
    'IS NULL': '== null',
    'IS NOT NULL': '!= null'
  };
  return mapping[operator] || '==';
}

/**
 * Generate logical expression
 */
function generateLogical(node) {
  const left = generateCondition(node.left);
  
  if (node.operator === 'NOT') {
    return `!(${left})`;
  }
  
  const right = generateCondition(node.right);
  const op = node.operator.toLowerCase();  // 'AND' → 'and', 'OR' → 'or'
  return `(${left}) ${op} (${right})`;
}

/**
 * Generate auth expression
 */
function generateAuth(node) {
  return `request.auth.${node.auth_field}`;
}

/**
 * Generate field expression
 */
function generateField(node) {
  return `resource.data.${node.field}`;
}

/**
 * Generate literal expression
 */
function generateLiteral(node) {
  if (node.value === null) {
    return 'null';
  }
  if (typeof node.value === 'string') {
    return `'${node.value}'`;
  }
  if (typeof node.value === 'boolean') {
    return node.value ? 'true' : 'false';
  }
  return String(node.value);
}

module.exports = {
  generateFirestoreRules,
  generateCondition,
  mapOperation
};
