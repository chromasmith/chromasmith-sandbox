// Ntendril Firestore Security Rules Converter
// SYSTEMATIC FIX: Proper field qualification without breaking paths

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
    
    // Step 1: Convert auth - do this FIRST and PROTECT it
    condition = condition.replace(/\bauth\.uid\(\)/g, '<<REQUEST_AUTH_UID>>');
    condition = condition.replace(/\bcurrent_user\b/g, '<<REQUEST_AUTH_UID>>');
    
    // Step 2: Convert operators
    condition = condition.replace(/\s*=\s*/g, ' == ');
    
    // Step 3: Remove type casts
    condition = condition.replace(/::\w+/g, '');
    
    // Step 4: Qualify bare field names (but NOT parts of paths)
    // Use negative lookbehind/lookahead to avoid matching words that are part of paths
    condition = condition.replace(/(?<![.\w])(\w+)(?![.\w])/g, (match) => {
      // Skip if it's a protected placeholder
      if (match.startsWith('<<')) return match;
      
      // Skip reserved words
      const reserved = ['true', 'false', 'null', 'REQUEST', 'AUTH', 'UID'];
      if (reserved.includes(match.toUpperCase())) return match;
      
      // Qualify as resource.data.fieldName
      return `resource.data.${match}`;
    });
    
    // Step 5: Restore protected auth references
    condition = condition.replace(/<<REQUEST_AUTH_UID>>/g, 'request.auth.uid');
    
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
