const { MySQLConverter } = require('./nl-convert-mysql.cjs');
const { FirestoreConverter } = require('./nl-convert-firestore.cjs');
const fs = require('fs').promises;
const path = require('path');

async function runTests() {
  console.log('🧪 Testing Ntendril Schema Converters\n');
  
  let passed = 0;
  
  // Test 1: MySQL type conversion
  try {
    console.log('Test 1: MySQL type conversion...');
    const mysqlConverter = new MySQLConverter();
    
    const testSQL = `
CREATE TABLE users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);`;
    
    const converted = await mysqlConverter.convertMigration(testSQL);
    
    const hasCharId = converted.includes('CHAR(36)');
    const hasText = converted.includes('TEXT');
    const hasDateTime = converted.includes('DATETIME');
    
    console.log(`  UUID → CHAR(36): ${hasCharId}`);
    console.log(`  text → TEXT: ${hasText}`);
    console.log(`  timestamptz → DATETIME: ${hasDateTime}`);
    
    if (hasCharId && hasText && hasDateTime) {
      console.log('  ✅ MySQL type conversion working\n');
      passed++;
    } else {
      console.log('  ❌ MySQL type conversion failed\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 2: MySQL AUTO_INCREMENT
  try {
    console.log('Test 2: MySQL AUTO_INCREMENT conversion...');
    const mysqlConverter = new MySQLConverter();
    
    const testSQL = `
CREATE SEQUENCE users_id_seq;
CREATE TABLE users (
  id SERIAL PRIMARY KEY
);`;
    
    const converted = await mysqlConverter.convertMigration(testSQL);
    
    const hasAutoIncrement = converted.includes('AUTO_INCREMENT');
    const sequenceCommented = converted.includes('-- Sequence converted');
    
    console.log(`  SERIAL → AUTO_INCREMENT: ${hasAutoIncrement}`);
    console.log(`  Sequence commented: ${sequenceCommented}`);
    
    if (hasAutoIncrement && sequenceCommented) {
      console.log('  ✅ AUTO_INCREMENT conversion working\n');
      passed++;
    } else {
      console.log('  ❌ AUTO_INCREMENT conversion failed\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 3: Firestore rules generation
  try {
    console.log('Test 3: Firestore rules generation...');
    const firestoreConverter = new FirestoreConverter();
    
    const testRLS = `
CREATE POLICY select_own_posts ON posts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY insert_own_posts ON posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);`;
    
    const rules = await firestoreConverter.convertRLSToRules(testRLS);
    
    const hasRulesVersion = rules.includes('rules_version');
    const hasPostsMatch = rules.includes('match /posts/');
    const hasAuthCheck = rules.includes('request.auth.uid');
    
    console.log(`  Rules version: ${hasRulesVersion}`);
    console.log(`  Posts collection: ${hasPostsMatch}`);
    console.log(`  Auth check: ${hasAuthCheck}`);
    
    if (hasRulesVersion && hasPostsMatch && hasAuthCheck) {
      console.log('  ✅ Firestore rules generation working\n');
      passed++;
    } else {
      console.log('  ❌ Firestore rules generation failed\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 4: Firestore condition conversion
  try {
    console.log('Test 4: Firestore condition conversion...');
    const firestoreConverter = new FirestoreConverter();
    
    const sqlCondition = 'auth.uid() = user_id';
    const converted = firestoreConverter.convertCondition(sqlCondition);
    
    console.log(`  SQL: ${sqlCondition}`);
    console.log(`  Firestore: ${converted}`);
    
    const hasRequestAuth = converted.includes('request.auth.uid');
    const hasEquality = converted.includes('==');
    
    if (hasRequestAuth && hasEquality) {
      console.log('  ✅ Condition conversion working\n');
      passed++;
    } else {
      console.log('  ❌ Condition conversion failed\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  // Test 5: Policy grouping by collection
  try {
    console.log('Test 5: Policy grouping by collection...');
    const firestoreConverter = new FirestoreConverter();
    
    const testRLS = `
CREATE POLICY select_posts ON posts FOR SELECT USING (true);
CREATE POLICY insert_posts ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY select_comments ON comments FOR SELECT USING (true);`;
    
    const rules = await firestoreConverter.convertRLSToRules(testRLS);
    
    const hasPosts = rules.includes('match /posts/');
    const hasComments = rules.includes('match /comments/');
    const hasMultipleRules = (rules.match(/allow read/g) || []).length >= 2;
    
    console.log(`  Posts collection: ${hasPosts}`);
    console.log(`  Comments collection: ${hasComments}`);
    console.log(`  Multiple rules: ${hasMultipleRules}`);
    
    if (hasPosts && hasComments && hasMultipleRules) {
      console.log('  ✅ Policy grouping working\n');
      passed++;
    } else {
      console.log('  ❌ Policy grouping failed\n');
    }
  } catch (err) {
    console.log(`  ❌ Test failed: ${err.message}\n`);
  }
  
  console.log(`\n📊 Results: ${passed}/5 passed`);
  return passed === 5;
}

if (require.main === module) {
  runTests().then(success => process.exit(success ? 0 : 1));
}

module.exports = { runTests };