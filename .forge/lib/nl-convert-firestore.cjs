// Ntendril Firestore Security Rules Converter
// Converts Postgres RLS policies to Firestore security rules

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
    let condition = sqlCondition.trim();
    
    // First convert auth functions
    condition = condition.replace(/auth\.uid\(\)/g, 'request.auth.uid');
    condition = condition.replace(/current_user/g, 'request.auth.uid');
    
    // Convert = to == but preserve spacing
    condition = condition.replace(/\s*=\s*/g, ' == ');
    
    // Remove type casts
    condition = condition.replace(/::/g, '');
    
    // Simplify if just true
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
