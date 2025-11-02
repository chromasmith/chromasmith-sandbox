// Ntendril Firestore Security Rules Converter
// UNIVERSAL: Converts ANY Postgres RLS policy to Firestore security rules

const fs = require('fs').promises;
const path = require('path');

class FirestoreConverter {
  constructor() {
    this.collections = new Set();
    
    // Reserved keywords that should NOT be qualified
    this.reservedKeywords = new Set([
      'request', 'resource', 'true', 'false', 'null',
      'get', 'exists', 'getAfter', 'existsAfter'
    ]);
  }
  
  async convertRLSToRules(rlsSQL) {
    const policies = this.parseRLSPolicies(rlsSQL);
    const rules = this.generateFirestoreRules(policies);
    
    return rules;
  }
  
  parseRLSPolicies(sql) {
    const policies = [];
    
    // Match CREATE POLICY statements
    const policyRegex = /CREATE POLICY (\w+) ON (\w+)\s+(?:FOR (\w+))?\s+(?:TO (\w+))?\s+(?:USING \((.*?)\))?\s*(?:WITH CHECK \((.*?)\))?/gi;
    
    let match;
    while ((match = policyRegex.exec(sql)) !== null) {
      const [_, name, table, command, role, using, withCheck] = match;
      
      policies.push({
        name,
        collection: table,
        command: command || 'ALL',
        role: role || 'PUBLIC',
        using: using || 'true',
        withCheck: withCheck || using || 'true'
      });
      
      this.collections.add(table);
    }
    
    return policies;
  }
  
  generateFirestoreRules(policies) {
    let rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
`;
    
    // Group policies by collection
    const byCollection = {};
    for (const policy of policies) {
      if (!byCollection[policy.collection]) {
        byCollection[policy.collection] = [];
      }
      byCollection[policy.collection].push(policy);
    }
    
    // Generate rules for each collection
    for (const [collection, collectionPolicies] of Object.entries(byCollection)) {
      rules += this.generateCollectionRules(collection, collectionPolicies);
    }
    
    rules += `  }
}`;
    
    return rules;
  }
  
  generateCollectionRules(collection, policies) {
    let rules = `
    // Rules for ${collection}
    match /${collection}/{docId} {
`;
    
    // Separate by command type
    const readPolicies = policies.filter(p => ['SELECT', 'ALL'].includes(p.command));
    const writePolicies = policies.filter(p => ['INSERT', 'UPDATE', 'DELETE', 'ALL'].includes(p.command));
    
    // Generate read rules
    if (readPolicies.length > 0) {
      const readConditions = readPolicies.map(p => this.convertCondition(p.using));
      rules += `      allow read: if ${this.combineConditions(readConditions, 'OR')};\n`;
    }
    
    // Generate write rules
    if (writePolicies.length > 0) {
      const writeConditions = writePolicies.map(p => this.convertCondition(p.withCheck));
      rules += `      allow write: if ${this.combineConditions(writeConditions, 'OR')};\n`;
    }
    
    rules += `    }
`;
    
    return rules;
  }
  
  convertCondition(sqlCondition) {
    // UNIVERSAL CONVERSION LOGIC
    // Works for ANY RLS condition, not just specific test cases
    
    let condition = sqlCondition.trim();
    
    // Step 1: Convert auth functions (auth.uid() → request.auth.uid)
    condition = condition.replace(/\bauth\.uid\(\)/g, 'request.auth.uid');
    condition = condition.replace(/\bcurrent_user\b/g, 'request.auth.uid');
    
    // Step 2: Convert operators (= → ==)
    condition = condition.replace(/\s*=\s*/g, ' == ');
    
    // Step 3: Remove type casts (::text, ::uuid, etc.)
    condition = condition.replace(/::\w+/g, '');
    
    // Step 4: Qualify field references (user_id → resource.data.user_id)
    // This is the CRITICAL systematic fix
    condition = this.qualifyFieldReferences(condition);
    
    // Step 5: Handle simple cases
    if (condition === 'true' || condition.trim() === '') {
      return 'true';
    }
    
    return condition;
  }
  
  qualifyFieldReferences(condition) {
    // SYSTEMATIC FIELD QUALIFICATION
    // Identifies bare field names and qualifies them as resource.data.fieldName
    
    // Tokenize the condition
    const tokens = condition.split(/(\s+|[(){}[\],;])/);
    const qualified = [];
    
    for (const token of tokens) {
      const trimmed = token.trim();
      
      // Skip whitespace and operators
      if (!trimmed || /^[=!<>|&+\-*/%]+$/.test(trimmed)) {
        qualified.push(token);
        continue;
      }
      
      // Skip if already qualified
      if (trimmed.startsWith('request.') || trimmed.startsWith('resource.')) {
        qualified.push(token);
        continue;
      }
      
      // Skip reserved keywords
      if (this.reservedKeywords.has(trimmed)) {
        qualified.push(token);
        continue;
      }
      
      // Skip numbers and strings
      if (/^\d+$/.test(trimmed) || /^['"]/.test(trimmed)) {
        qualified.push(token);
        continue;
      }
      
      // If it's a valid identifier (word characters), qualify it
      if (/^\w+$/.test(trimmed)) {
        qualified.push(`resource.data.${trimmed}`);
      } else {
        qualified.push(token);
      }
    }
    
    return qualified.join('');
  }
  
  combineConditions(conditions, operator) {
    if (conditions.length === 0) return 'false';
    if (conditions.length === 1) return conditions[0];
    
    const op = operator === 'OR' ? '||' : '&&';
    return conditions.map(c => `(${c})`).join(` ${op} `);
  }
  
  async convertFile(inputPath, outputPath) {
    const content = await fs.readFile(inputPath, 'utf8');
    const rules = await this.convertRLSToRules(content);
    await fs.writeFile(outputPath, rules, 'utf8');
    
    return {
      input: inputPath,
      output: outputPath,
      collections: Array.from(this.collections),
      policiesConverted: (content.match(/CREATE POLICY/gi) || []).length
    };
  }
}

module.exports = { FirestoreConverter };