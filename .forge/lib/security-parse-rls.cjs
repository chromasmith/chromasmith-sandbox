/**
 * Supabase RLS → Security AST Parser
 * Converts CREATE POLICY statements into universal AST
 */

const {
  createPolicy,
  createComparison,
  createLogical,
  createAuth,
  createField,
  createLiteral
} = require('./security-ast-utils.cjs');

const { ComparisonOp, LogicalOp, Operation } = require('./security-ast-schema.cjs');

/**
 * Extract balanced parentheses content
 * Reused pattern from nl-convert-firestore.cjs
 */
function extractBalancedParens(str, startIndex) {
  let depth = 0;
  let start = -1;
  
  for (let i = startIndex; i < str.length; i++) {
    if (str[i] === '(') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (str[i] === ')') {
      depth--;
      if (depth === 0) {
        return str.substring(start, i).trim();
      }
    }
  }
  
  return '';  // Unbalanced
}

/**
 * Parse RLS policy SQL into AST
 * @param {string} sql - CREATE POLICY statement
 * @returns {Object} Policy AST
 */
function parseRLS(sql) {
  // Normalize whitespace
  sql = sql.replace(/\s+/g, ' ').trim();
  
  // Extract policy name (handles quoted and unquoted)
  const nameMatch = sql.match(/CREATE POLICY\s+["']?([^"'\s]+)["']?\s+ON/i);
  if (!nameMatch) {
    throw new Error('Could not extract policy name');
  }
  const policyName = nameMatch[1];
  
  // Extract table name
  const tableMatch = sql.match(/ON\s+["']?([^"'\s]+)["']?/i);
  if (!tableMatch) {
    throw new Error('Could not extract table name');
  }
  const tableName = tableMatch[1];
  
  // Extract operation (FOR SELECT|INSERT|UPDATE|DELETE|ALL)
  const opMatch = sql.match(/FOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)/i);
  const operation = opMatch ? opMatch[1].toUpperCase() : 'ALL';
  
  // Extract USING clause
  const usingIndex = sql.indexOf('USING');
  if (usingIndex === -1) {
    throw new Error('Policy must have USING clause');
  }
  
  const usingCondition = extractBalancedParens(sql, usingIndex + 5);
  if (!usingCondition) {
    throw new Error('Could not extract USING condition');
  }
  
  // Extract WITH CHECK clause (optional)
  let withCheckCondition = null;
  const withCheckIndex = sql.indexOf('WITH CHECK');
  if (withCheckIndex !== -1) {
    withCheckCondition = extractBalancedParens(sql, withCheckIndex + 10);
  }
  
  // Parse conditions into AST
  const usingAST = parseCondition(usingCondition);
  const withCheckAST = withCheckCondition ? parseCondition(withCheckCondition) : null;
  
  return createPolicy(policyName, tableName, operation, usingAST, withCheckAST);
}

/**
 * Parse a condition string into AST nodes
 * Handles: comparisons, logical operators, auth checks, fields, literals
 */
function parseCondition(condition) {
  condition = condition.trim();
  
  // Handle logical operators (AND, OR) - split at top level only
  const logicalOp = findTopLevelLogical(condition);
  if (logicalOp) {
    const parts = splitAtTopLevel(condition, logicalOp.operator);
    if (parts.length === 2) {
      return createLogical(
        logicalOp.operator === 'AND' ? LogicalOp.AND : LogicalOp.OR,
        parseCondition(parts[0]),
        parseCondition(parts[1])
      );
    }
  }
  
  // Handle NOT
  if (condition.toUpperCase().startsWith('NOT ')) {
    const inner = condition.substring(4).trim();
    // If inner starts with (, extract balanced content
    if (inner.startsWith('(')) {
      const innerCondition = extractBalancedParens(inner, 0);
      return createLogical(LogicalOp.NOT, parseCondition(innerCondition));
    }
    return createLogical(LogicalOp.NOT, parseCondition(inner));
  }
  
  // Handle comparisons (=, !=, >, <, >=, <=, etc.)
  const comparison = parseComparison(condition);
  if (comparison) {
    return comparison;
  }
  
  throw new Error(`Could not parse condition: ${condition}`);
}

/**
 * Find top-level logical operator (not inside parens)
 */
function findTopLevelLogical(condition) {
  let depth = 0;
  const upper = condition.toUpperCase();
  
  for (let i = 0; i < condition.length; i++) {
    if (condition[i] === '(') depth++;
    else if (condition[i] === ')') depth--;
    else if (depth === 0) {
      // Check for AND
      if (upper.substring(i, i + 4) === ' AND ') {
        return { operator: 'AND', index: i };
      }
      // Check for OR
      if (upper.substring(i, i + 4) === ' OR ') {
        return { operator: 'OR', index: i };
      }
    }
  }
  
  return null;
}

/**
 * Split condition at top-level logical operator
 */
function splitAtTopLevel(condition, operator) {
  let depth = 0;
  const upper = condition.toUpperCase();
  const needle = ` ${operator} `;
  
  for (let i = 0; i < condition.length; i++) {
    if (condition[i] === '(') depth++;
    else if (condition[i] === ')') depth--;
    else if (depth === 0 && upper.substring(i, i + needle.length) === needle) {
      return [
        condition.substring(0, i).trim(),
        condition.substring(i + needle.length).trim()
      ];
    }
  }
  
  return [condition];
}

/**
 * Parse a comparison expression
 * Examples: auth.uid() = user_id, status = 'published', age > 18
 */
function parseComparison(condition) {
  // Try each comparison operator
  const operators = [
    { op: ComparisonOp.GREATER_EQUAL, regex: />=/ },
    { op: ComparisonOp.LESS_EQUAL, regex: /<=/ },
    { op: ComparisonOp.NOT_EQUALS, regex: /!=|<>/ },
    { op: ComparisonOp.EQUALS, regex: /=/ },
    { op: ComparisonOp.GREATER, regex: />/ },
    { op: ComparisonOp.LESS, regex: /</ }
  ];
  
  for (const { op, regex } of operators) {
    const match = condition.match(regex);
    if (match) {
      const splitIndex = condition.indexOf(match[0]);
      const left = condition.substring(0, splitIndex).trim();
      const right = condition.substring(splitIndex + match[0].length).trim();
      
      return createComparison(
        op,
        parseValue(left),
        parseValue(right)
      );
    }
  }
  
  return null;
}

/**
 * Parse a value (auth check, field, or literal)
 */
function parseValue(value) {
  value = value.trim();
  
  // Remove outer parens if present
  if (value.startsWith('(') && value.endsWith(')')) {
    value = value.substring(1, value.length - 1).trim();
  }
  
  // Check for auth.uid()
  if (value === 'auth.uid()') {
    return createAuth('uid');
  }
  
  // Check for other auth functions
  const authMatch = value.match(/^auth\.(\w+)\(\)$/);
  if (authMatch) {
    return createAuth(authMatch[1]);
  }
  
  // Check for string literal
  if ((value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))) {
    return createLiteral(value.substring(1, value.length - 1));
  }
  
  // Check for numeric literal
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return createLiteral(parseFloat(value));
  }
  
  // Check for boolean literal
  if (value.toLowerCase() === 'true') {
    return createLiteral(true);
  }
  if (value.toLowerCase() === 'false') {
    return createLiteral(false);
  }
  
  // Check for NULL
  if (value.toUpperCase() === 'NULL') {
    return createLiteral(null);
  }
  
  // Otherwise, treat as field name
  return createField(value);
}

/**
 * Parse multiple RLS policies from SQL file
 */
function parseRLSFile(sqlContent) {
  // Split by semicolons (but not inside strings/parens)
  const statements = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let depth = 0;
  
  for (let i = 0; i < sqlContent.length; i++) {
    const char = sqlContent[i];
    
    if (!inString) {
      if (char === "'" || char === '"') {
        inString = true;
        stringChar = char;
      } else if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
      } else if (char === ';' && depth === 0) {
        if (current.trim()) {
          statements.push(current.trim());
        }
        current = '';
        continue;
      }
    } else if (char === stringChar && sqlContent[i - 1] !== '\\') {
      inString = false;
    }
    
    current += char;
  }
  
  // Add last statement if any
  if (current.trim()) {
    statements.push(current.trim());
  }
  
  // Parse each CREATE POLICY statement
  const policies = [];
  for (const stmt of statements) {
    if (stmt.toUpperCase().includes('CREATE POLICY')) {
      try {
        policies.push(parseRLS(stmt));
      } catch (err) {
        console.warn(`Warning: Could not parse policy: ${err.message}`);
      }
    }
  }
  
  return policies;
}

module.exports = {
  parseRLS,
  parseRLSFile,
  extractBalancedParens,
  parseCondition,
  parseValue
};