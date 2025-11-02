// Ntendril Firestore Security Rules Converter
// FINAL SYSTEMATIC FIX: Symbol-based placeholders that won't match word patterns

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
    
    // Use symbol-based marker that can't match \w+
    const AUTH_MARKER = '___AUTH___';
    
    // Step 1: Protect auth references with non-word marker
    condition = condition.replace(/\bauth\.uid\(\)/g, AUTH_MARKER);
    condition = condition.replace(/\bcurrent_user\b/g, AUTH_MARKER);
    
    // Step 2: Convert operators
    condition = condition.replace(/\s*=\s*/g, ' == ');
    
    // Step 3: Remove type casts
    condition = condition.replace(/::\w+/g, '');
    
    // Step 4: Qualify bare field names (won't match marker with underscores)
    condition = condition.replace(/(?<![.\w])(\w+)(?![.\w])/g, (match) => {
      // Skip reserved words
      const reserved = ['true', 'false', 'null'];
      if (reserved.includes(match.toLowerCase())) return match;
      
      // Qualify as resource.data.fieldName
      return `resource.data.${match}`;
    });
    
    // Step 5: Restore auth references
    condition = condition.replace(/___AUTH___/g, 'request.auth.uid');
    
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
