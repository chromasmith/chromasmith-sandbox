// Ntendril Firestore Security Rules Converter
// SYSTEMATIC FIX: Proper RLS parsing with nested parens and flexible whitespace

const fs = require('fs').promises;
const path = require('path');

class FirestoreConverter {
  constructor() {
    this.collections = new Set();
  }
  
  async convertRLSToRules(rlsSQL) {
    const policies = this.parseRLSPolicies(rlsSQL);
    const rules = this.generateFirestoreRules(policies);
    return rules;
  }
  
  parseRLSPolicies(sql) {
    const policies = [];
    
    // SYSTEMATIC FIX: Handle nested parens and flexible whitespace
    // Split by semicolons first, then parse each policy
    const statements = sql.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed.startsWith('CREATE POLICY')) continue;
      
      // Extract components one by one
      const nameMatch = trimmed.match(/CREATE POLICY (\w+)/);
      const tableMatch = trimmed.match(/ON (\w+)/);
      const commandMatch = trimmed.match(/FOR (\w+)/);
      const roleMatch = trimmed.match(/TO (\w+)/);
      
      // Extract USING clause - find the balanced parentheses
      let using = 'true';
      const usingIndex = trimmed.indexOf('USING (');
      if (usingIndex !== -1) {
        using = this.extractBalancedParens(trimmed, usingIndex + 6); // +6 for "USING "
      }
      
      // Extract WITH CHECK clause
      let withCheck = using;
      const checkIndex = trimmed.indexOf('WITH CHECK (');
      if (checkIndex !== -1) {
        withCheck = this.extractBalancedParens(trimmed, checkIndex + 11); // +11 for "WITH CHECK "
      }
      
      if (nameMatch && tableMatch) {
        policies.push({
          name: nameMatch[1],
          collection: tableMatch[1],
          command: commandMatch ? commandMatch[1] : 'ALL',
          role: roleMatch ? roleMatch[1] : 'PUBLIC',
          using,
          withCheck
        });
        
        this.collections.add(tableMatch[1]);
      }
    }
    
    return policies;
  }
  
  extractBalancedParens(str, startIndex) {
    // Extract content between balanced parentheses
    let depth = 0;
    let start = -1;
    
    for (let i = startIndex; i < str.length; i++) {
      if (str[i] === '(') {
        if (depth === 0) start = i + 1;
        depth++;
      } else if (str[i] === ')') {
        depth--;
        if (depth === 0) {
          return str.substring(start, i);
        }
      }
    }
    
    return 'true';
  }
  
  generateFirestoreRules(policies) {
    let rules = `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n`;
    
    const byCollection = {};
    for (const policy of policies) {
      if (!byCollection[policy.collection]) {
        byCollection[policy.collection] = [];
      }
      byCollection[policy.collection].push(policy);
    }
    
    for (const [collection, collectionPolicies] of Object.entries(byCollection)) {
      rules += this.generateCollectionRules(collection, collectionPolicies);
    }
    
    rules += `  }\n}`;
    return rules;
  }
  
  generateCollectionRules(collection, policies) {
    let rules = `\n    // Rules for ${collection}\n    match /${collection}/{docId} {\n`;
    
    const readPolicies = policies.filter(p => ['SELECT', 'ALL'].includes(p.command));
    const writePolicies = policies.filter(p => ['INSERT', 'UPDATE', 'DELETE', 'ALL'].includes(p.command));
    
    if (readPolicies.length > 0) {
      const readConditions = readPolicies.map(p => this.convertCondition(p.using));
      rules += `      allow read: if ${this.combineConditions(readConditions, 'OR')};\n`;
    }
    
    if (writePolicies.length > 0) {
      const writeConditions = writePolicies.map(p => this.convertCondition(p.withCheck));
      rules += `      allow write: if ${this.combineConditions(writeConditions, 'OR')};\n`;
    }
    
    rules += `    }\n`;
    return rules;
  }
  
  convertCondition(sqlCondition) {
    let condition = sqlCondition.trim();
    
    const AUTH_MARKER = '___AUTH___';
    
    // Protect auth references
    condition = condition.replace(/\bauth\.uid\(\)/g, AUTH_MARKER);
    condition = condition.replace(/\bcurrent_user\b/g, AUTH_MARKER);
    
    // Convert operators
    condition = condition.replace(/\s*=\s*/g, ' == ');
    
    // Remove type casts
    condition = condition.replace(/::\w+/g, '');
    
    // Qualify bare field names
    condition = condition.replace(/(?<![.\w])(\w+)(?![.\w])/g, (match) => {
      const reserved = ['true', 'false', 'null'];
      if (reserved.includes(match.toLowerCase())) return match;
      return `resource.data.${match}`;
    });
    
    // Restore auth references
    condition = condition.replace(/___AUTH___/g, 'request.auth.uid');
    
    if (condition === 'true' || condition.trim() === '') {
      return 'true';
    }
    
    return condition;
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