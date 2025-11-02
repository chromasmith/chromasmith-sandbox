// Ntendril Firestore Security Rules Converter
// UNIVERSAL: Converts ANY Postgres RLS policy to Firestore security rules

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
    // SYSTEMATIC UNIVERSAL CONVERSION
    
    let condition = sqlCondition.trim();
    
    // Step 1: Convert auth functions FIRST
    condition = condition.replace(/\bauth\.uid\(\)/g, 'request.auth.uid');
    condition = condition.replace(/\bcurrent_user\b/g, 'request.auth.uid');
    
    // Step 2: Convert operators
    condition = condition.replace(/\s*=\s*/g, ' == ');
    
    // Step 3: Remove type casts
    condition = condition.replace(/::\w+/g, '');
    
    // Step 4: Qualify bare field references
    // Match word identifiers that are NOT already qualified
    condition = condition.replace(/\b(\w+)\b/g, (match) => {
      // Skip if already part of a qualified path
      const beforeMatch = condition.substring(0, condition.indexOf(match));
      if (beforeMatch.endsWith('request.') || 
          beforeMatch.endsWith('resource.') || 
          beforeMatch.endsWith('data.')) {
        return match;
      }
      
      // Skip reserved keywords
      const reserved = ['request', 'resource', 'data', 'auth', 'uid', 'true', 'false', 'null'];
      if (reserved.includes(match)) {
        return match;
      }
      
      // Qualify as resource.data.fieldName
      return `resource.data.${match}`;
    });
    
    // Step 5: Clean up any double-qualifications that slipped through
    condition = condition.replace(/resource\.data\.resource\.data\./g, 'resource.data.');
    condition = condition.replace(/request\.auth\.request\.auth\./g, 'request.auth.');
    
    // Step 6: Handle simple cases
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