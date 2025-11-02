/**
 * Firestore Generator Tests
 * Verify AST → Firestore rules conversion
 */

const { generateFirestoreRules } = require('./security-gen-firestore.cjs');
const { parseRLS } = require('./security-parse-rls.cjs');

console.log('🧪 Testing Firestore Rules Generator...\n');

let passed = 0;
let failed = 0;

// Test 1: Simple auth comparison
try {
  const sql1 = `
    CREATE POLICY "select_own" ON posts
      FOR SELECT
      USING (auth.uid() = user_id);
  `;
  
  const ast = parseRLS(sql1);
  const rules = generateFirestoreRules(ast);
  
  // Verify rules contain expected elements
  if (rules.includes("rules_version = '2'") &&
      rules.includes('service cloud.firestore') &&
      rules.includes('match /posts/{docId}') &&
      rules.includes('allow read: if (request.auth.uid == resource.data.user_id)')) {
    console.log('✅ Test 1: Simple auth comparison');
    console.log('Generated rules:');
    console.log(rules);
    console.log();
    passed++;
  } else {
    throw new Error('Rules missing expected content');
  }
} catch (err) {
  console.error('❌ Test 1 Failed:', err.message);
  failed++;
}

// Test 2: Logical AND
try {
  const sql2 = `
    CREATE POLICY "select_published_own" ON posts
      FOR SELECT
      USING (auth.uid() = user_id AND status = 'published');
  `;
  
  const ast = parseRLS(sql2);
  const rules = generateFirestoreRules(ast);
  
  if (rules.includes('allow read: if ((request.auth.uid == resource.data.user_id) and (resource.data.status == \'published\'))')) {
    console.log('✅ Test 2: Logical AND with literal');
    console.log('Generated rules:');
    console.log(rules);
    console.log();
    passed++;
  } else {
    throw new Error('Rules missing expected AND condition');
  }
} catch (err) {
  console.error('❌ Test 2 Failed:', err.message);
  failed++;
}

// Test 3: Nested logical (OR containing AND)
try {
  const sql3 = `
    CREATE POLICY "select_complex" ON posts
      FOR SELECT
      USING (auth.uid() = user_id OR (role = 'admin' AND active = true));
  `;
  
  const ast = parseRLS(sql3);
  const rules = generateFirestoreRules(ast);
  
  if (rules.includes('or') && rules.includes('and')) {
    console.log('✅ Test 3: Nested logical (OR containing AND)');
    console.log('Generated rules:');
    console.log(rules);
    console.log();
    passed++;
  } else {
    throw new Error('Rules missing nested logical operators');
  }
} catch (err) {
  console.error('❌ Test 3 Failed:', err.message);
  failed++;
}

// Test 4: Multiple operations (INSERT)
try {
  const sql4 = `
    CREATE POLICY "insert_own" ON posts
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  `;
  
  const ast = parseRLS(sql4);
  const rules = generateFirestoreRules(ast);
  
  if (rules.includes('allow create: if (request.auth.uid == resource.data.user_id)')) {
    console.log('✅ Test 4: INSERT maps to create');
    console.log('Generated rules:');
    console.log(rules);
    console.log();
    passed++;
  } else {
    throw new Error('Rules missing create operation');
  }
} catch (err) {
  console.error('❌ Test 4 Failed:', err.message);
  failed++;
}

// Test 5: Multiple policies for same table
try {
  const policies = [
    parseRLS("CREATE POLICY p1 ON posts FOR SELECT USING (auth.uid() = user_id);"),
    parseRLS("CREATE POLICY p2 ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);"),
    parseRLS("CREATE POLICY p3 ON posts FOR UPDATE USING (auth.uid() = user_id);")
  ];
  
  const rules = generateFirestoreRules(policies);
  
  if (rules.includes('allow read') &&
      rules.includes('allow create') &&
      rules.includes('allow update')) {
    console.log('✅ Test 5: Multiple policies combined');
    console.log('Generated rules:');
    console.log(rules);
    console.log();
    passed++;
  } else {
    throw new Error('Rules missing multiple operations');
  }
} catch (err) {
  console.error('❌ Test 5 Failed:', err.message);
  failed++;
}

// Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Tests: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (failed === 0) {
  console.log('✅ All Firestore generator tests passed!');
} else {
  console.error('❌ Some tests failed');
  process.exit(1);
}
